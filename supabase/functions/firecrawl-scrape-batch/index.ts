import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import FirecrawlApp from 'https://esm.sh/@mendable/firecrawl-js@1.29.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  urls: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Batch firecrawl scrape request received');
    
    const { urls }: ScrapeRequest = await req.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No URLs provided' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not found in environment');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    console.log(`Starting batch scrape for ${urls.length} URLs`);
    const app = new FirecrawlApp({ apiKey });

    // Process URLs in parallel batches of 3 to avoid overwhelming the service
    const batchSize = 3;
    const allResults = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} URLs`);
      
      const batchPromises = batch.map(async (url) => {
        try {
          console.log(`Scraping URL: ${url}`);
          
          const scrapeResult = await app.scrapeUrl(url, {
            formats: ['markdown'],
            timeout: 30000,
            waitFor: 2000
          });

          if (!scrapeResult.success) {
            console.error(`Failed to scrape ${url}:`, scrapeResult.error);
            return {
              url,
              success: false,
              error: scrapeResult.error || 'Unknown scraping error'
            };
          }

          console.log(`Successfully scraped ${url}`);
          return {
            url,
            success: true,
            data: scrapeResult.data
          };
        } catch (error) {
          console.error(`Error scraping ${url}:`, error);
          return {
            url,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
      
      // Add a small delay between batches to be respectful
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Batch scraping completed. ${allResults.filter(r => r.success).length}/${allResults.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: allResults,
        totalProcessed: allResults.length,
        successCount: allResults.filter(r => r.success).length
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('Error in batch firecrawl scrape:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
});