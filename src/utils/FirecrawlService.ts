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
      console.log('Making optimized scrape request via Supabase edge function for:', url);
      
      // Generate multiple URL variants for better coverage and parallel processing
      const urlVariants = this.generateUrlVariants(url);
      console.log('Generated URL variants:', urlVariants);
      
      // Use batch scraping for better performance
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape-batch', {
        body: { urls: urlVariants }
      });

      if (error) {
        console.error('Edge function error:', error);
        
        // Check if it's a 500 error from the scraping service
        if (error.message?.includes('500') || error.message?.includes('scraping engines failed')) {
          return { 
            success: false, 
            error: 'The estate sales website is currently blocking automated scraping. Please try again later or visit the website directly.' 
          };
        }
        
        return { 
          success: false, 
          error: error.message || 'Failed to call scraping service' 
        };
      }

      if (!data.success) {
        console.error('Batch scrape failed:', data.error);
        return { 
          success: false, 
          error: data.error || 'Failed to scrape website' 
        };
      }

      console.log(`Batch scrape successful: ${data.successCount}/${data.totalProcessed} URLs processed`);
      
      // Combine markdown from all successful results
      let combinedMarkdown = '';
      const successfulResults = data.results.filter((result: any) => result.success);
      
      console.log('Processing successful results:', successfulResults.length);
      for (const result of successfulResults) {
        console.log('Result data structure:', result.data);
        if (result.data?.markdown) {
          console.log('Adding markdown from result:', result.url);
          combinedMarkdown += result.data.markdown + '\n\n';
        } else {
          console.log('No markdown found in result:', result.url, result.data);
        }
      }
      
      console.log('Final combined markdown length:', combinedMarkdown.length);
      
      // Parse estate sales from the combined markdown content
      const parsedSales = this.parseEstateSales(combinedMarkdown);
      
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
      
      // Provide more helpful error messages
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to scraping service';
      
      if (errorMessage.includes('500') || errorMessage.includes('scraping engines failed')) {
        return { 
          success: false, 
          error: 'The estate sales website is currently blocking automated access. Please try again later or visit the website directly.' 
        };
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  // Generate multiple URL variants for better coverage and parallel scraping
  static generateUrlVariants(baseUrl: string): string[] {
    const variants = [baseUrl];
    
    // Add pagination variants (first few pages for more results)
    for (let page = 2; page <= 3; page++) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      variants.push(`${baseUrl}${separator}page=${page}`);
    }
    
    // Add sorting variants for more comprehensive results
    const separator = baseUrl.includes('?') ? '&' : '?';
    variants.push(`${baseUrl}${separator}sort=distance`);
    variants.push(`${baseUrl}${separator}sort=date`);
    
    return variants.slice(0, 5); // Limit to 5 variants to avoid overwhelming
  }

  static parseEstateSales(markdown: string): any[] {
    console.log('Raw markdown content length:', markdown.length);
    console.log('First 1000 chars:', markdown.substring(0, 1000));
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
      
      // Extract image URL - look for image pattern at the beginning
      const imageMatch = block.match(/\[!\[.*?\]\((https:\/\/[^)]+\.(?:jpg|jpeg|png|gif|webp))/i);
      if (imageMatch) {
        sale.imageUrl = imageMatch[1];
      }
      
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
      
        // Enhanced address extraction with better street address parsing
        console.log('Processing block for address extraction:', block.substring(0, 200));
        
        // First try to extract street address from the block content
        const lines = block.split(/[\\\\|\n|\r]/);
        let streetAddress = '';
        
        for (const line of lines) {
          const cleanLine = line.trim().replace(/\\\\/g, ' ').replace(/\s+/g, ' ');
          if (!cleanLine || cleanLine.length < 5) continue;
          
          // Look for street address patterns first
          const streetPattern = /^\d+\s+[A-Za-z\s]+(dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court|pkwy|parkway|blvd|boulevard|place|pl)\b/i;
          if (streetPattern.test(cleanLine) && !streetAddress) {
            streetAddress = cleanLine;
            console.log('Found street address:', streetAddress);
            break;
          }
        }
        
        // Look for the actual estate sale URL which contains the address structure
        const urlMatch = block.match(/\]\((https:\/\/www\.estatesales\.net\/([A-Z]{2})\/([^\/]+)\/(\d{5})?[^)]*)\)/);
        
        if (urlMatch) {
          const [, fullUrl, state, cityFromUrl, zipCode] = urlMatch;
          
          // Convert URL city name back to readable format
          const city = cityFromUrl.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          console.log('Extracted from URL:', { state, city, zipCode, fullUrl });
          
          sale.state = state;
          sale.city = city;
          sale.zipCode = zipCode || '';
          sale.streetAddress = streetAddress;
          
          // Construct full address with street address if available
          if (streetAddress) {
            sale.address = `${streetAddress}, ${city}, ${state}${zipCode ? ' ' + zipCode : ''}`;
          } else {
            sale.address = `${city}, ${state}${zipCode ? ' ' + zipCode : ''}`;
          }
          
          sale.url = fullUrl;
        } else {
          // Fallback: try to find address info in the text
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.length < 3) continue;
            
            // Look for city, state pattern in text
            const cityStatePattern = /^([A-Za-z\s]+),?\s*([A-Z]{2})\s*(\d{5})?$/;
            const cityMatch = cleanLine.match(cityStatePattern);
            if (cityMatch && !sale.city) {
              sale.city = cityMatch[1].trim();
              sale.state = cityMatch[2];
              sale.zipCode = cityMatch[3] || '';
              sale.streetAddress = streetAddress;
              
              if (streetAddress) {
                sale.address = `${streetAddress}, ${sale.city}, ${sale.state}${sale.zipCode ? ' ' + sale.zipCode : ''}`;
              } else {
                sale.address = `${sale.city}, ${sale.state}${sale.zipCode ? ' ' + sale.zipCode : ''}`;
              }
              
              console.log('Found city/state in text:', sale.city, sale.state, sale.zipCode);
              break;
            }
          }
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
      
      // Set URL if not already set from address extraction
      if (!sale.url) {
        const fallbackUrlMatch = block.match(/\]\((https:\/\/www\.estatesales\.net\/[^)]+)\)/);
        if (fallbackUrlMatch) {
          sale.url = fallbackUrlMatch[1];
        }
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
      
      // Only add sales that have at least a title and are within reasonable timeframe
      if (sale.title && sale.title.length > 0) {
        // Check if sale is within timeframe
        const isWithinTimeframe = this.isWithinThreeDays(sale.date);
        console.log(`Sale "${sale.title}" date: "${sale.date}" - within 3 days: ${isWithinTimeframe}`);
        
        if (isWithinTimeframe) {
          sales.push(sale);
          console.log(`✅ Added sale: "${sale.title}" at ${sale.address || sale.streetAddress || 'No address found'}`);
        } else {
          console.log(`❌ Filtered out sale: "${sale.title}" - outside 3-day window`);
        }
      } else {
        console.log(`❌ Skipped sale block - no title found`);
      }
    }
    
    console.log(`Successfully parsed ${sales.length} estate sales (filtered for within 3 days)`);
    
    // If no sales within 3 days, let's be more lenient and include sales within 7 days
    if (sales.length === 0) {
      console.log('No sales within 3 days, expanding to 7-day window...');
      
      // Reprocess with 7-day window
      for (let i = 1; i < saleBlocks.length; i++) {
        const block = saleBlocks[i];
        
        if (!block.includes('estatesales.net') || !block.includes('**')) {
          continue;
        }
        
        const sale: any = {};
        
        // Extract basic info (reusing same extraction logic)
        const imageMatch = block.match(/\[!\[.*?\]\((https:\/\/[^)]+\.(?:jpg|jpeg|png|gif|webp))/i);
        if (imageMatch) sale.imageUrl = imageMatch[1];
        
        const titleMatch = block.match(/\*\*(.*?)\*\*/);
        if (titleMatch) sale.title = titleMatch[1].trim().replace(/\\\\/g, '');
        
        const companyMatch = block.match(/Listed by ([^\\]+)/);
        if (companyMatch) {
          sale.company = companyMatch[1].trim();
        } else if (block.includes('Privately Listed Sale')) {
          sale.company = 'Privately Listed Sale';
        }
        
        // Address extraction
        const urlMatch = block.match(/\]\((https:\/\/www\.estatesales\.net\/([A-Z]{2})\/([^\/]+)\/(\d{5})?[^)]*)\)/);
        if (urlMatch) {
          const [, fullUrl, state, cityFromUrl, zipCode] = urlMatch;
          const city = cityFromUrl.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          sale.state = state;
          sale.city = city;
          sale.zipCode = zipCode || '';
          sale.address = `${city}, ${state}${zipCode ? ' ' + zipCode : ''}`;
          sale.url = fullUrl;
        }
        
        // Extract dates and other info
        const dateMatch = block.match(/((?:Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun)\s+\d+(?:,\s+\d+)?(?:,\s*(?:Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun)\s+\d+)*)/);
        if (dateMatch) sale.date = dateMatch[1].trim();
        
        const distanceMatch = block.match(/(\d+\s+miles?\s+away|Less than \d+ miles away|Nearby[^\\]*)/);
        if (distanceMatch) sale.distance = distanceMatch[1].trim();
        
        sale.markdown = block;
        sale.description = 'Estate sale - contact organizer for details.';
        
        if (sale.title && sale.title.length > 0 && this.isWithinSevenDays(sale.date)) {
          sales.push(sale);
          console.log(`✅ Added sale (7-day window): "${sale.title}"`);
        }
      }
    }
    
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

  // Helper method to check if a sale date is within 7 days from today
  static isWithinSevenDays(dateString: string): boolean {
    if (!dateString || dateString === 'Date TBD') {
      return true; // Include sales without specific dates
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    try {
      const currentYear = today.getFullYear();
      const dateToCheck = this.parseSaleDate(dateString, currentYear);
      
      if (!dateToCheck) {
        return true; // If we can't parse it, include it
      }

      return dateToCheck >= today && dateToCheck <= sevenDaysFromNow;
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
