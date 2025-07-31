import FirecrawlApp from '@mendable/firecrawl-js';

interface ErrorResponse {
  success: false;
  error: string;
}

interface CrawlStatusResponse {
  success: true;
  status: string;
  completed: number;
  total: number;
  creditsUsed: number;
  expiresAt: string;
  data: any[];
}

type CrawlResponse = CrawlStatusResponse | ErrorResponse;

export class FirecrawlService {
  private static API_KEY_STORAGE_KEY = 'firecrawl_api_key';
  private static firecrawlApp: FirecrawlApp | null = null;

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    this.firecrawlApp = new FirecrawlApp({ apiKey });
    console.log('API key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  static async testApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log('Testing API key with Firecrawl API');
      this.firecrawlApp = new FirecrawlApp({ apiKey });
      // A simple test crawl to verify the API key
      const testResponse = await this.firecrawlApp.crawlUrl('https://example.com', {
        limit: 1
      });
      return testResponse.success;
    } catch (error) {
      console.error('Error testing API key:', error);
      return false;
    }
  }

  static async crawlWebsite(url: string): Promise<{ success: boolean; error?: string; data?: any }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    try {
      console.log('Making scrape request to Firecrawl API for:', url);
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      // Use scrape instead of crawl for single page estate sales listings
      const scrapeResponse = await this.firecrawlApp.scrapeUrl(url, {
        formats: ['markdown', 'html'],
        onlyMainContent: false, // Get full page content
        waitFor: 8000, // Wait longer for dynamic content
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
      });

      if (!scrapeResponse.success) {
        console.error('Scrape failed:', scrapeResponse.error);
        return { 
          success: false, 
          error: scrapeResponse.error || 'Failed to scrape website' 
        };
      }

      console.log('Scrape successful:', scrapeResponse);
      
      // Parse estate sales from the markdown content
      const parsedSales = this.parseEstateSales(scrapeResponse.markdown || '');
      
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
        error: error instanceof Error ? error.message : 'Failed to connect to Firecrawl API' 
      };
    }
  }

  static parseEstateSales(markdown: string): any[] {
    console.log('Raw markdown content:', markdown.substring(0, 500));
    const sales: any[] = [];
    
    // Split by image patterns - each estate sale starts with [![
    const saleBlocks = markdown.split(/(?=\[!\[)/);
    
    console.log(`Found ${saleBlocks.length} potential sale blocks`);
    
    for (let i = 1; i < saleBlocks.length; i++) { // Skip first block (header content)
      const block = saleBlocks[i];
      
      // Skip if this doesn't contain estatesales.net URL (not a real sale)
      if (!block.includes('estatesales.net') || !block.includes('**')) {
        continue;
      }
      
      const sale: any = {};
      
      // Extract title - look for **title** pattern
      const titleMatch = block.match(/\*\*(.*?)\*\*/);
      if (titleMatch) {
        sale.title = titleMatch[1].trim().replace(/\\\\/g, '');
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
      
      // Extract address - look for street address patterns
      const addressLines = block.split('\\\\');
      let addressFound = false;
      for (const line of addressLines) {
        if (line.includes('MI ') && /\d{5}/.test(line)) {
          sale.address = line.trim();
          addressFound = true;
          break;
        }
        // Also check for just street addresses without state
        if (!addressFound && /^\d+\s+[a-zA-Z\s]+(?:rd|drive|dr|street|st|ave|avenue|lane|ln|ct|court|way|blvd|boulevard)/i.test(line.trim())) {
          sale.streetAddress = line.trim();
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