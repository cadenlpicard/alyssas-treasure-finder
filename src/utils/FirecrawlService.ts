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
    
    // Look for the pattern of estate sale listings in the markdown
    // Estate sales typically appear after certain headers and contain specific patterns
    
    // Split by lines that contain estate sale links (they start with [![ and contain estatesales.net)
    const saleBlocks = markdown.split(/(?=\[!\[.*?\]\(https:\/\/picturescdn\.estatesales\.net)/);
    
    console.log(`Found ${saleBlocks.length} potential sale blocks`);
    
    for (let i = 1; i < saleBlocks.length; i++) { // Skip first block (header content)
      const block = saleBlocks[i];
      const sale: any = {};
      
      // Extract title from markdown - look for **title** pattern
      const titleMatch = block.match(/\*\*(.*?)\*\*/);
      if (titleMatch) {
        sale.title = titleMatch[1].trim();
      }
      
      // Extract URL - look for the final link in the block
      const urlMatches = block.match(/\]\((https:\/\/www\.estatesales\.net\/[^)]+)\)/g);
      if (urlMatches && urlMatches.length > 0) {
        const lastUrl = urlMatches[urlMatches.length - 1];
        sale.url = lastUrl.replace(/\]\(/, '').replace(/\)$/, '');
      }
      
      // Extract address - look for patterns like "City, State zipcode"
      const addressMatch = block.match(/([A-Za-z\s]+,\s*MI\s+\d{5})/);
      if (addressMatch) {
        sale.address = addressMatch[1].trim();
      }
      
      // Extract date - look for month patterns
      const dateMatch = block.match(/((?:Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun)\s+\d+(?:,\s+\d+)?)/);
      if (dateMatch) {
        sale.date = dateMatch[1].trim();
      }
      
      // Extract company - look for "Listed by" pattern
      const companyMatch = block.match(/Listed by ([^\\]+)/);
      if (companyMatch) {
        sale.company = companyMatch[1].trim();
      }
      
      // Extract distance - look for "miles away" pattern
      const distanceMatch = block.match(/(\d+\s+miles?\s+away|Less than \d+ miles away|Nearby)/);
      if (distanceMatch) {
        sale.distance = distanceMatch[1].trim();
      }
      
      // Extract status - look for status indicators
      const statusMatch = block.match(/(Going on Now!|Starts Tomorrow!|Ends Today!)/);
      if (statusMatch) {
        sale.status = statusMatch[1].trim();
      }
      
      // Store markdown for this sale
      sale.markdown = block;
      
      // Only add sales that have at least a title
      if (sale.title) {
        sales.push(sale);
        console.log(`Parsed sale: ${sale.title} at ${sale.address}`);
      }
    }
    
    console.log(`Successfully parsed ${sales.length} estate sales`);
    return sales;
  }
}