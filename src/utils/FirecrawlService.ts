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
    const sales: any[] = [];
    
    // Split the markdown by estate sale entries
    // Look for patterns like sale titles, addresses, and dates
    const lines = markdown.split('\n');
    let currentSale: any = {};
    let inSaleBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and headers
      if (!line || line.startsWith('#') || line.startsWith('![') || line.includes('EstateSales.NET')) {
        continue;
      }
      
      // Look for estate sale entries - they often start with image links or have sale patterns
      if (line.includes('[![') || line.includes('**') && line.includes('Sale')) {
        // If we have a current sale, save it
        if (currentSale.title && currentSale.address) {
          sales.push({ ...currentSale });
        }
        
        // Start new sale
        currentSale = {};
        inSaleBlock = true;
        
        // Extract title from markdown link
        const titleMatch = line.match(/\*\*(.*?)\*\*/);
        if (titleMatch) {
          currentSale.title = titleMatch[1];
        }
        
        // Extract URL from markdown link
        const urlMatch = line.match(/\]\((.*?)\)/);
        if (urlMatch) {
          currentSale.url = urlMatch[1];
        }
      }
      
      // Look for addresses (contain MI and numbers)
      if (line.includes('MI ') && /\d{5}/.test(line)) {
        const addressMatch = line.match(/(.*?MI \d{5})/);
        if (addressMatch) {
          currentSale.address = addressMatch[1].trim();
        }
      }
      
      // Look for dates
      if (line.includes('Jul') || line.includes('Aug') || line.includes('Sep')) {
        currentSale.date = line;
      }
      
      // Look for company info
      if (line.includes('Listed by')) {
        const companyMatch = line.match(/Listed by (.*)/);
        if (companyMatch) {
          currentSale.company = companyMatch[1];
        }
      }
      
      // Look for distances
      if (line.includes('miles away') || line.includes('Nearby')) {
        currentSale.distance = line;
      }
      
      // Store the full markdown for this sale
      if (inSaleBlock) {
        currentSale.markdown = (currentSale.markdown || '') + line + '\n';
      }
    }
    
    // Add the last sale if it exists
    if (currentSale.title && currentSale.address) {
      sales.push(currentSale);
    }
    
    console.log(`Parsed ${sales.length} estate sales from markdown`);
    return sales;
  }
}