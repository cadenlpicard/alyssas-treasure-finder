import { supabase } from '@/integrations/supabase/client';

interface ErrorResponse {
  success: false;
  error: string;
}

interface ScrapeResponse {
  success: true;
  data: any;
}

type FirecrawlResponse = ScrapeResponse | ErrorResponse;

export class FirecrawlService {
  static async crawlWebsite(url: string): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      console.log('Making scrape request via Supabase edge function for:', url);
      
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { url }
      });

      if (error) {
        console.error('Edge function error:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to call Firecrawl service' 
        };
      }

      if (!data.success) {
        console.error('Scrape failed:', data.error);
        return { 
          success: false, 
          error: data.error || 'Failed to scrape website' 
        };
      }

      console.log('Scrape successful via edge function');
      
      // Parse estate sales from the markdown content
      const parsedSales = this.parseEstateSales(data.data.markdown || '');
      
      // Convert scrape response to match expected crawl format
      const formattedData = {
        success: true,
        status: 'completed',
        completed: parsedSales.length,
        total: parsedSales.length,
        creditsUsed: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        data: parsedSales
      };
      
      return { 
        success: true,
        data: formattedData
      };
    } catch (error) {
      console.error('Error during scrape:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to connect to Firecrawl service' 
      };
    }
  }

  static parseEstateSales(markdown: string): any[] {
    console.log('Raw markdown content length:', markdown.length);
    console.log('Full markdown content:', markdown);
    const sales: any[] = [];
    
    // Split by image patterns - each estate sale starts with [![](
    const saleBlocks = markdown.split(/(?=\[!\[\]\(https:\/\/picturescdn\.estatesales\.net)/);
    
    console.log(`Found ${saleBlocks.length} potential sale blocks`);
    console.log('First few blocks:', saleBlocks.slice(0, 3));
    
    for (let i = 1; i < saleBlocks.length; i++) { // Skip first block (header content)
      const block = saleBlocks[i];
      
      // Skip if this doesn't contain estatesales.net URL (not a real sale)
      if (!block.includes('estatesales.net') || !block.includes('**')) {
        continue;
      }
      
      const sale: any = {};
      
      // Extract title - look for **title** pattern, clean up escapes
      const titleMatch = block.match(/\*\*(.*?)\*\*/);
      if (titleMatch) {
        sale.title = titleMatch[1].trim()
          .replace(/\\\\/g, '')
          .replace(/\\n/g, ' ')
          .replace(/\s+/g, ' ');
      }
      
      // Extract company - look for "Listed by" pattern
      const companyMatch = block.match(/Listed by ([^\\]+)/);
      if (companyMatch) {
        sale.company = companyMatch[1].trim();
      } else if (block.includes('Privately Listed Sale')) {
        sale.company = 'Privately Listed Sale';
      }
      
      // Extract picture count and last modified
      const pictureMatch = block.match(/(\d+)\s+Pictures/);
      if (pictureMatch) {
        sale.pictureCount = pictureMatch[1];
      }
      
      const modifiedMatch = block.match(/Last modified ([^.]+)/);
      if (modifiedMatch) {
        sale.lastModified = modifiedMatch[1].trim();
      }
      
      // Extract address - look for city, state patterns in the markdown
      const lines = block.split(/\\\\|\n/);
      let addressFound = false;
      
      for (const line of lines) {
        const cleanLine = line.trim();
        
        // Look for full address with MI and zip
        if (cleanLine.includes('MI ') && /\d{5}/.test(cleanLine)) {
          sale.address = cleanLine;
          addressFound = true;
          break;
        }
        // Look for street addresses
        if (!addressFound && /^\d+\s+[a-zA-Z\s]+(?:rd|drive|dr\.?|street|st\.?|ave|avenue|lane|ln\.?|ct|court|way|blvd|boulevard|pkwy|parkway)/i.test(cleanLine)) {
          sale.streetAddress = cleanLine;
        }
        // Look for city names followed by MI
        if (!addressFound && /^[A-Z][a-z\s]+,?\s*MI\s*\d{5}/.test(cleanLine)) {
          sale.address = cleanLine;
          addressFound = true;
          break;
        }
      }
      
      // Extract distance
      const distanceMatch = block.match(/(\d+\s+miles?\s+away|Less than \d+ miles away|Nearby[^\\]*)/);
      if (distanceMatch) {
        sale.distance = distanceMatch[1].trim();
      }
      
      // Extract dates - look for month patterns
      const dateMatch = block.match(/((?:Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun)\s+\d+(?:,\s+\d+)?(?:,\s*(?:Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun)\s+\d+)*)/);
      if (dateMatch) {
        sale.date = dateMatch[1].trim();
      }
      
      // Extract times
      const timeMatch = block.match(/(\d+(?:am|pm)\s+to\s+\d+(?:am|pm))/);
      if (timeMatch) {
        sale.time = timeMatch[1].trim();
      }
      
      // Extract status
      const statusMatch = block.match(/(Going on Now!|Starts Tomorrow!|Ends Today!|Resuming Today|Starts at)/);
      if (statusMatch) {
        sale.status = statusMatch[1].trim();
      }
      
      // Extract URL - look for the final estatesales.net link
      const urlMatch = block.match(/\]\((https:\/\/www\.estatesales\.net\/[^)]+)\)/);
      if (urlMatch) {
        sale.url = urlMatch[1];
      }
      
      // Extract featured status
      if (block.includes('Regionally Featured')) {
        sale.featured = 'Regional';
      } else if (block.includes('Nationally Featured')) {
        sale.featured = 'National';
      }
      
      // Store markdown for this sale
      sale.markdown = block;
      
      // Build a description from available info
      const descParts = [];
      if (sale.company) descParts.push(`Listed by ${sale.company}`);
      if (sale.lastModified) descParts.push(`Last modified ${sale.lastModified}`);
      if (sale.pictureCount) descParts.push(`${sale.pictureCount} pictures`);
      if (sale.time) descParts.push(`${sale.time}`);
      if (sale.status) descParts.push(sale.status);
      sale.description = descParts.join(' • ');
      
      // Only add sales that have at least a title
      if (sale.title && sale.title.length > 0) {
        sales.push(sale);
        console.log(`Parsed sale: "${sale.title}" at ${sale.address || sale.streetAddress}`);
      }
    }
    
    console.log(`Successfully parsed ${sales.length} estate sales`);
    return sales;
  }
}