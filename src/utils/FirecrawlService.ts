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
      
      // Improved address extraction - look for actual street addresses
      console.log('Processing block for address extraction:', block.substring(0, 200));
      
      // Split by various separators and look for street addresses
      const lines = block.split(/[\\\\|\n|\r]/);
      let fullAddress = '';
      let streetAddress = '';
      let city = '';
      let state = '';
      let zipCode = '';
      
      for (const line of lines) {
        const cleanLine = line.trim();
        
        // Skip empty lines or lines that are clearly not addresses
        if (!cleanLine || cleanLine.length < 5) continue;
        
        // Look for full address with street, city, state, zip
        const fullAddressPattern = /(\d+\s+[A-Za-z\s]+(?:dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court|pkwy|parkway|blvd|boulevard|place|pl)\.?)\s*,?\s*([A-Z][a-z\s]+),?\s*(MI|Michigan)\s*(\d{5})?/i;
        const fullMatch = cleanLine.match(fullAddressPattern);
        
        if (fullMatch) {
          streetAddress = fullMatch[1].trim();
          city = fullMatch[2].trim();
          state = fullMatch[3];
          zipCode = fullMatch[4] || '';
          fullAddress = `${streetAddress}, ${city}, ${state}${zipCode ? ' ' + zipCode : ''}`;
          console.log('Found full address:', fullAddress);
          break;
        }
        
        // Look for just street address (number + street name + type) - but exclude distance info
        const streetPattern = /^\d+\s+[A-Za-z\s]+(?:dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court|pkwy|parkway|blvd|boulevard|place|pl)\.?$/i;
        const distancePattern = /^\d+\s+miles?\s+away$/i;
        
        if (streetPattern.test(cleanLine) && !distancePattern.test(cleanLine) && !streetAddress) {
          streetAddress = cleanLine;
          console.log('Found street address:', streetAddress);
        }
        
        // Look for city, state pattern
        const cityStatePattern = /^([A-Z][a-z\s]+),?\s*(MI|Michigan)\s*(\d{5})?$/i;
        const cityMatch = cleanLine.match(cityStatePattern);
        if (cityMatch && !city) {
          city = cityMatch[1].trim();
          state = cityMatch[2];
          zipCode = cityMatch[3] || '';
          console.log('Found city/state:', city, state, zipCode);
        }
      }
      
      // Set the address fields
      if (streetAddress && city && state) {
        sale.address = `${streetAddress}, ${city}, ${state}${zipCode ? ' ' + zipCode : ''}`;
        sale.streetAddress = streetAddress;
        sale.city = city;
        sale.state = state;
        sale.zipCode = zipCode;
      } else if (streetAddress) {
        // If we have street address but no city/state, try to extract from other patterns in the block
        sale.streetAddress = streetAddress;
        
        // Look for city/state elsewhere in the block
        const blockCityMatch = block.match(/([A-Z][a-z\s]+),?\s*(MI|Michigan)/i);
        if (blockCityMatch) {
          sale.city = blockCityMatch[1].trim();
          sale.state = blockCityMatch[2];
          sale.address = `${streetAddress}, ${sale.city}, ${sale.state}`;
        } else {
          sale.address = streetAddress; // At least we have the street
        }
      } else if (city && state) {
        // If we only have city/state, use that
        sale.city = city;
        sale.state = state;
        sale.address = `${city}, ${state}`;
      }
      
      console.log('Final address extraction result:', {
        fullAddress: sale.address,
        streetAddress: sale.streetAddress,
        city: sale.city,
        state: sale.state,
        zipCode: sale.zipCode
      });
      
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
      
      // Only add sales that have at least a title and are within 3 days
      if (sale.title && sale.title.length > 0 && this.isWithinThreeDays(sale.date)) {
        sales.push(sale);
        console.log(`Parsed sale: "${sale.title}" at ${sale.address || sale.streetAddress || 'No address found'}`);
      }
    }
    
    console.log(`Successfully parsed ${sales.length} estate sales (filtered for within 3 days)`);
    return sales;
  }

  // Helper method to check if a sale date is within 3 days from today
  static isWithinThreeDays(dateString: string): boolean {
    if (!dateString || dateString === 'Date TBD') {
      return true; // Include sales without specific dates
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    try {
      // Parse estate sale dates that can be in various formats like:
      // "Dec 14, 2024"
      // "Dec 14, Dec 15"
      // "Dec 14"
      
      const currentYear = today.getFullYear();
      const dateToCheck = this.parseSaleDate(dateString, currentYear);
      
      if (!dateToCheck) {
        return true; // If we can't parse it, include it
      }

      return dateToCheck >= today && dateToCheck <= threeDaysFromNow;
    } catch (error) {
      console.warn('Error parsing date:', dateString, error);
      return true; // If error parsing, include the sale
    }
  }

  // Helper method to check if a sale date is today or later (keeping for compatibility)
  static isTodayOrLater(dateString: string): boolean {
    if (!dateString || dateString === 'Date TBD') {
      return true; // Include sales without specific dates
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Parse estate sale dates that can be in various formats like:
      // "Dec 14, 2024"
      // "Dec 14, Dec 15"
      // "Dec 14"
      
      const currentYear = today.getFullYear();
      const dateToCheck = this.parseSaleDate(dateString, currentYear);
      
      if (!dateToCheck) {
        return true; // If we can't parse it, include it
      }

      return dateToCheck >= today;
    } catch (error) {
      console.warn('Error parsing date:', dateString, error);
      return true; // If error parsing, include the sale
    }
  }

  // Helper method to parse estate sale date strings
  static parseSaleDate(dateString: string, currentYear: number): Date | null {
    try {
      // Clean the date string
      const cleanDate = dateString.trim();
      
      // Handle formats like "Dec 14, 2024" or "Dec 14"
      const dateWithYearMatch = cleanDate.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,\s*(\d{4}))?/i);
      
      if (dateWithYearMatch) {
        const [, month, day, year] = dateWithYearMatch;
        const monthMap: { [key: string]: number } = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        
        const monthIndex = monthMap[month.toLowerCase()];
        const dayNum = parseInt(day);
        const yearNum = year ? parseInt(year) : currentYear;
        
        if (monthIndex !== undefined && dayNum >= 1 && dayNum <= 31) {
          return new Date(yearNum, monthIndex, dayNum);
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Error parsing sale date:', dateString, error);
      return null;
    }
  }
}
