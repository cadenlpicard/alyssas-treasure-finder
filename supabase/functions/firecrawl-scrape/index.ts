import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY')
    if (!FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not set in Supabase secrets')
    }

    const { url } = await req.json()
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('Scraping URL with Firecrawl:', url)
    
    // Use Firecrawl API directly
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 8000,
        blockAds: true,
        actions: [
          {
            type: 'wait',
            milliseconds: 3000
          },
          {
            type: 'scroll',
            direction: 'down'
          },
          {
            type: 'wait', 
            milliseconds: 2000
          }
        ]
      })
    })

    const responseData = await scrapeResponse.json()

    if (!scrapeResponse.ok) {
      console.error('Scrape failed:', responseData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData.error || 'Failed to scrape website' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    console.log('Scrape successful')
    
    return new Response(
      JSON.stringify({ 
        success: true,
        data: responseData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error in firecrawl-scrape function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})