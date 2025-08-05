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
  static async crawlWebsite(url: string, filters?: { maxDays?: number; maxRadius?: number }): Promise<{ success: boolean; error?: string; data?: any }> {
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
      console.log('Full data response:', JSON.stringify(data, null, 2));
      
      for (const result of successfulResults) {
        console.log('Individual result structure:', JSON.stringify(result, null, 2));
        
        // Try different possible markdown locations
        let markdown = '';
        if (result.data?.markdown) {
          markdown = result.data.markdown;
        } else if (result.data?.content) {
          markdown = result.data.content;
        } else if (typeof result.data === 'string') {
          markdown = result.data;
        } else if (result.markdown) {
          markdown = result.markdown;
        }
        
        if (markdown) {
          console.log(`Adding markdown from ${result.url}, length: ${markdown.length}`);
          combinedMarkdown += markdown + '\n\n';
        } else {
          console.log(`No markdown found for ${result.url}. Available keys:`, Object.keys(result.data || {}));
        }
      }
      
      console.log('Final combined markdown length:', combinedMarkdown.length);
      
      // Parse estate sales from the combined markdown content with filters
      const parsedSales = this.parseEstateSales(combinedMarkdown, filters);
      
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
    
    return variants; // Return only base URL and pagination variants
  }

  static parseEstateSales(markdown: string, filters?: { maxDays?: number; maxRadius?: number }): any[] {
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
      
      // Skip aggregated search results or nearby listings
      if (block.includes('Nearby [') || 
          block.includes('Address not available yet') ||
          block.includes('Companies have paid extra') ||
          block.includes('#### Statistics About') ||
          block.includes('Featured Sales Please note') ||
          (block.match(/\[.*?\]\(https:\/\/www\.estatesales\.net/g) || []).length > 5) {
        console.log('Skipping aggregated search result or nearby listing');
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
        
        // Extract distance FIRST to avoid confusion with address
        const distanceMatch = block.match(/(\d+\s+miles?\s+away|Less than \d+ miles away|Nearby[^\\]*)/);
        if (distanceMatch) {
          sale.distance = distanceMatch[1].trim();
          console.log('Found distance:', sale.distance);
        }
        
        // Now extract street address from the block content (excluding distance)
        const lines = block.split(/[\\\\|\n|\r]/);
        let streetAddress = '';
        
        for (const line of lines) {
          const cleanLine = line.trim().replace(/\\\\/g, ' ').replace(/\s+/g, ' ');
          if (!cleanLine || cleanLine.length < 5) continue;
          
          // Skip lines that contain distance information
          if (cleanLine.includes('miles away') || cleanLine.includes('Nearby')) continue;
          
          // Look for street address patterns
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
            
            // Skip lines that contain distance information
            if (cleanLine.includes('miles away') || cleanLine.includes('Nearby')) continue;
            
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
        zipCode: sale.zipCode,
        distance: sale.distance
      });
      
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
      
      // Only add sales that have at least a title and meet filter criteria
      if (sale.title && sale.title.length > 0) {
        // Apply upfront filtering
        let shouldInclude = true;
        
        // Date filter - check if sale is within specified days (default: today or future)
        const maxDays = filters?.maxDays || 0; // 0 means only today and future
        const isWithinDateRange = maxDays === 0 
          ? this.isTodayOrLater(sale.date)
          : this.isWithinDays(sale.date, maxDays);
        
        if (!isWithinDateRange) {
          console.log(`❌ Filtered out sale: "${sale.title}" - outside date range (${maxDays} days)`);
          shouldInclude = false;
        }
        
        // Distance filter - check if sale is within specified radius
        if (shouldInclude && filters?.maxRadius && filters.maxRadius !== 999) {
          const distance = this.parseDistanceFromText(sale.distance);
          if (distance > filters.maxRadius) {
            console.log(`❌ Filtered out sale: "${sale.title}" - too far (${distance} > ${filters.maxRadius} miles)`);
            shouldInclude = false;
          }
        }
        
        if (shouldInclude) {
          sales.push(sale);
          console.log(`✅ Added sale: "${sale.title}" at ${sale.address || sale.streetAddress || 'No address found'}`);
        }
      } else {
        console.log(`❌ Skipped sale block - no title found`);
      }
    }
    
    console.log(`Successfully parsed ${sales.length} estate sales`);
    
    return sales;
  }

  // Helper method to parse distance from text string
  static parseDistanceFromText(distanceText?: string): number {
    if (!distanceText) return 999;
    
    const lowerText = distanceText.toLowerCase();
    
    // Handle "Less than X miles" or "Nearby" cases
    if (lowerText.includes('less than') || lowerText.includes('nearby')) {
      const match = lowerText.match(/less than (\d+)/);
      return match ? parseInt(match[1]) : 2; // Default nearby to 2 miles
    }
    
    // Handle "X miles away" format
    const match = lowerText.match(/(\d+)\s+miles?\s+away/);
    return match ? parseInt(match[1]) : 999;
  }

  // Helper method to check if a sale date is within specified number of days
  static isWithinDays(dateString: string, maxDays: number): boolean {
    if (!dateString || dateString === 'Date TBD') {
      return true; // Include sales without specific dates
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + maxDays);

    try {
      const currentYear = today.getFullYear();
      const dateToCheck = this.parseSaleDate(dateString, currentYear);
      
      if (!dateToCheck) {
        return true; // If we can't parse it, include it
      }

      return dateToCheck >= today && dateToCheck <= maxDate;
    } catch (error) {
      console.warn('Error parsing date:', dateString, error);
      return true; // If error parsing, include the sale
    }
  }

  static async searchThriftStores(locationUrl: string, radiusFilter: number): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      console.log('Searching for thrift stores near:', locationUrl);
      
      // Extract city and state from the URL or location string
      let location = '';
      if (locationUrl.includes('estatesales.net')) {
        // Extract from estate sales URL format
        const urlMatch = locationUrl.match(/\/([A-Z]{2})\/([^\/]+)/);
        if (urlMatch) {
          const [, state, cityFromUrl] = urlMatch;
          const city = cityFromUrl.replace(/-/g, ' ');
          location = `${city}, ${state}`;
        }
      } else {
        // Assume it's already a location string
        location = locationUrl;
      }

      if (!location) {
        return { success: false, error: 'Unable to extract location for thrift store search' };
      }

      const { data, error } = await supabase.functions.invoke('search-thrift-stores', {
        body: { 
          location: location,
          radius: radiusFilter === 999 ? 25 : radiusFilter // Convert "All distances" to reasonable default
        }
      });

      if (error) {
        console.error('Thrift store search error:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to search thrift stores' 
        };
      }

      if (!data.success) {
        return { 
          success: false, 
          error: data.error || 'Failed to find thrift stores' 
        };
      }

      // Convert Google Places results to our format
      const thriftStores = data.results.map((place: any) => ({
        title: place.name,
        address: place.formatted_address || place.vicinity,
        description: `${place.types?.join(', ') || 'Thrift store'} • Rating: ${place.rating || 'No rating'}/5`,
        url: place.website || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        company: 'Thrift Store',
        type: 'thrift_store',
        businessHours: place.opening_hours?.weekday_text?.join(', ') || 'Hours not available',
        phone: place.formatted_phone_number || '',
        rating: place.rating || 0,
        distance: place.distance ? `${place.distance.toFixed(1)} miles away` : '',
        uniqueId: `thrift-${place.place_id}`,
        imageUrl: place.photos?.[0]?.getUrl?.() || ''
      }));

      console.log(`Found ${thriftStores.length} thrift stores`);
      
      return { 
        success: true,
        data: thriftStores
      };
    } catch (error) {
      console.error('Error searching thrift stores:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to search thrift stores' 
      };
    }
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
