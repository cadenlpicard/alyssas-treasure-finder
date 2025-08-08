import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Calendar, Clock, ExternalLink, Tag, CheckCircle, Store, Star, Phone } from 'lucide-react';

interface EstateSale {
  title?: string;
  date?: string;
  address?: string;
  description?: string;
  url?: string;
  status?: string;
  company?: string;
  distance?: string;
  markdown?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  streetAddress?: string;
  uniqueId?: string;
  imageUrl?: string;
  type?: 'estate_sale' | 'thrift_store';
  businessHours?: string;
  phone?: string;
  rating?: number;
}

interface EstateSaleCardProps {
  sale: EstateSale;
  isSelected?: boolean;
  onSelect?: (sale: EstateSale, selected: boolean) => void;
}

export const EstateSaleCard = React.memo(({ sale, isSelected = false, onSelect }: EstateSaleCardProps) => {
  // Extract data from markdown if other fields are not available
  const extractFromMarkdown = (markdown: string): { title: string; date: string; address: string; company: string; description: string; city: string; state: string } => {
    if (!markdown) return { title: 'Estate Sale', date: 'Date TBD', address: 'Address TBD', company: '', description: 'No details available', city: '', state: '' };
    
    // Clean the markdown by removing navigation and technical elements
    const cleanText = markdown
      .replace(/arrow_back/g, '')
      .replace(/\\_/g, ' ')
      .replace(/List of.*?search/g, '')
      .replace(/https?:\/\/[^\s\)]+/g, '') // Remove URLs
      .replace(/\([^)]*maps\.google[^)]*\)/g, '') // Remove Google Maps references
      .replace(/\([^)]*https?[^)]*\)/g, '') // Remove URLs in parentheses
      .replace(/#{1,6}\s*/g, '') // Remove markdown headers
      .replace(/\n\s*\n/g, '\n') // Remove double newlines
      .trim();

    const lines = cleanText.split('\n')
      .map(line => line.trim())
      .filter(line => 
        line.length > 0 && 
        !line.toLowerCase().includes('search') &&
        !line.toLowerCase().includes('arrow') &&
        !line.toLowerCase().includes('maps.google') &&
        !line.includes('q=') &&
        line.length < 200 // Filter out very long technical lines
      );

    let title = '';
    let date = '';
    let address = '';
    let company = '';
    let description = '';
    let city = '';
    let state = '';
    
    // Extract meaningful information
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Skip technical/navigation content
      if (lowerLine.includes('http') || 
          lowerLine.includes('maps') || 
          lowerLine.includes('search') ||
          lowerLine.includes('arrow') ||
          line.length < 5) {
        continue;
      }
      
      // Company/Estate Sale organizer
      if (!company && (
        lowerLine.includes('estate sales') ||
        lowerLine.includes('family affair') ||
        lowerLine.includes('four star') ||
        lowerLine.includes('presented by') ||
        lowerLine.includes('organized by')
      )) {
        company = line;
        continue;
      }
      
      // Title - look for sale names or descriptive titles
      if (!title && (
        lowerLine.includes('sale') ||
        lowerLine.includes('estate') ||
        (line.length > 15 && line.length < 80 && !lowerLine.includes('drive') && !lowerLine.includes('street'))
      )) {
        title = line;
        continue;
      }
      
      // Address - look for street addresses with numbers
      if (!address && (
        line.match(/\d+\s+[A-Za-z\s]+(dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court)/i)
      )) {
        // Clean up address formatting
        let cleanAddress = line
          .replace(/\\\\/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/^\[|\]$/g, '') // Remove leading/trailing brackets
          .trim();
        
        address = cleanAddress;
        
        // Extract city and state from address
        const cityStateMatch = cleanAddress.match(/([^,]+),\s*([A-Z]{2})/i);
        if (cityStateMatch) {
          city = cityStateMatch[1].trim();
          state = cityStateMatch[2];
        }
        continue;
      }
      
      // Extract city and state separately if not found in address
      if (!city && line.match(/([A-Z][a-z\s]+),?\s*([A-Z]{2})/i)) {
        const cityStateMatch = line.match(/([A-Z][a-z\s]+),?\s*([A-Z]{2})/i);
        if (cityStateMatch) {
          city = cityStateMatch[1].trim();
          state = cityStateMatch[2];
        }
        continue;
      }
      
      // Date - look for date patterns
      if (!date && (
        line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i) ||
        line.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) ||
        line.match(/\d{1,2}-\d{1,2}-\d{2,4}/)
      )) {
        date = line;
        continue;
      }
      
      // Description - longer meaningful text
      if (!description && line.length > 20 && line.length < 150 && 
          !lowerLine.includes('estate sale')) {
        description = line;
      }
    }
    
    // Fallbacks and cleanup
    if (!title && company) {
      title = company.replace(/estate sales?/gi, 'Estate Sale').trim();
    }
    
    if (!title) {
      title = 'Estate Sale';
    }
    
    if (!company && title.toLowerCase().includes('estate')) {
      company = 'Estate Sale';
    }
    
    if (!description) {
      description = 'Estate sale - contact organizer for details.';
    }
    
    return { 
      title: title.trim(), 
      date: date.trim() || 'Date TBD', 
      address: address.trim() || '', 
      company: company.trim(),
      description: description.trim(),
      city: city.trim(),
      state: state.trim()
    };
  };

  const extracted = sale.markdown ? extractFromMarkdown(sale.markdown) : { 
    title: '', 
    date: '', 
    address: '', 
    company: '',
    description: '',
    city: '',
    state: ''
  };
  
  const displayTitle = sale.title || extracted.title;
  const displayDate = sale.date || extracted.date;
  let displayAddress = sale.address || extracted.address;
  const displayCompany = sale.company || extracted.company;
  const displayDescription = sale.description || extracted.description;
  const displayCity = sale.city || extracted.city;
  const displayState = sale.state || extracted.state;

  // Fix address if it contains metadata instead of actual address
  if (displayAddress && (
    displayAddress.includes('Last modified') || 
    displayAddress.includes('Pictures') || 
    displayAddress.includes('Picture Added') ||
    displayAddress.includes('hours ago') ||
    displayAddress.includes('minutes ago') ||
    displayAddress.includes('days ago')
  )) {
    // Use city/state as address instead of metadata
    displayAddress = displayCity && displayState ? `${displayCity}, ${displayState}` : displayAddress;
  }

  // Check if the sale has a valid street address
  const hasValidAddress = displayAddress && 
    displayAddress !== 'Address TBD' && 
    displayAddress.trim() !== '' &&
    (sale.type === 'thrift_store' || /\d+\s+[A-Za-z\s]+(dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court|pkwy|parkway|blvd|boulevard|place|pl)/i.test(displayAddress));

  // Debug logging for address issues
  console.log('Estate Sale Debug:', {
    title: displayTitle,
    originalAddress: sale.address || extracted.address,
    cleanedAddress: displayAddress,
    city: displayCity,
    state: displayState,
    saleAddress: sale.address,
    extractedAddress: extracted.address
  });

  return (
    <TooltipProvider>
      <Card className={`group transition-all duration-300 ornate-card ${
        isSelected ? 'ring-2 ring-[hsl(var(--vintage-gold))] bg-[hsl(var(--vintage-gold)/0.06)]' : ''
      }`}>
      {sale.imageUrl && (
        <div className="relative h-48 w-full overflow-hidden cursor-pointer" onClick={() => sale.url && window.open(sale.url, '_blank')}>
          <img 
            src={sale.imageUrl} 
            alt={displayTitle || "Estate sale image"}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, 50vw"
            srcSet={`${sale.imageUrl} 800w`}
            onError={(e) => {
              // Hide image if it fails to load
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          {sale.status && (
            <Badge 
              variant="secondary" 
              className="absolute top-2 right-2 text-xs bg-background/80 backdrop-blur"
            >
              {sale.status}
            </Badge>
          )}
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {hasValidAddress && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => {
                  onSelect?.(sale, !!checked);
                }}
                className="mt-1"
              />
            )}
            <div className="flex-1">
              <CardTitle className="font-display text-lg font-semibold text-foreground leading-tight">
                {displayTitle}
                {isSelected && <CheckCircle className="inline-block w-4 h-4 ml-2 text-vintage-gold" />}
              </CardTitle>
              {displayCompany && (
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  {displayCompany}
                </p>
              )}
            </div>
          </div>
          
          {!sale.imageUrl && sale.status && (
            <Badge variant="secondary" className="text-xs">
              {sale.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {sale.type !== 'thrift_store' && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-estate-red flex-shrink-0" />
              <span className="text-foreground">{displayDate}</span>
            </div>
          )}
          
          {sale.type === 'thrift_store' && sale.businessHours && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-treasure-green flex-shrink-0" />
              <span className="text-foreground text-xs">
                {sale.businessHours.split(',').slice(0, 2).join(', ')}
                {sale.businessHours.split(',').length > 2 && '...'}
              </span>
            </div>
          )}
          
          {sale.type === 'thrift_store' && sale.rating && sale.rating > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <span className="text-foreground">{sale.rating}/5 rating</span>
            </div>
          )}
          
          {sale.type === 'thrift_store' && sale.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="text-foreground">{sale.phone}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-treasure-green flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-foreground">{displayAddress}</span>
              
              {/* Show warning badge for address issues - only for estate sales */}
              {sale.type !== 'thrift_store' && (() => {
                // Debug the address checking logic
                console.log('Badge Logic Debug:', {
                  displayAddress,
                  isEmpty: !displayAddress || displayAddress === 'Address TBD' || displayAddress.trim() === '',
                  isMetadata: displayAddress && (displayAddress.includes('Last modified') || displayAddress.includes('Pictures')),
                  hasStreetPattern: displayAddress ? /\d+\s+[A-Za-z\s]+(dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court|pkwy|parkway|blvd|boulevard|place|pl)/i.test(displayAddress) : false
                });
                
                // Check if we have no address or just a placeholder
                if (!displayAddress || displayAddress === 'Address TBD' || displayAddress.trim() === '') {
                  console.log('Showing badge: No address');
                  return (
                    <span className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded mt-1 w-fit">
                      🚫 Address not available yet
                    </span>
                  );
                }
                
                // Check if address is only city/state (no street number and name)
                const hasStreetAddress = /\d+\s+[A-Za-z\s]+(dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court|pkwy|parkway|blvd|boulevard|place|pl)/i.test(displayAddress);
                
                if (!hasStreetAddress) {
                  console.log('Showing badge: No street address pattern');
                  return (
                    <span className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded mt-1 w-fit">
                      🚫 Address not available yet
                    </span>
                  );
                }
                
                console.log('No badge: Full address detected');
                return null;
              })()}
              
              {sale.distance && (
                <Badge variant="outline" className="text-xs mt-1 self-start">
                  {sale.distance}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed"
           title={displayDescription}>
          {displayDescription}
        </p>
        
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {sale.type === 'thrift_store' ? (
                <>
                  <Store className="w-3 h-3 mr-1" />
                  Thrift Store
                </>
              ) : (
                <>
                  <Tag className="w-3 h-3 mr-1" />
                  Estate Sale
                </>
              )}
            </Badge>
          </div>
          
          {sale.url && (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => window.open(sale.url, '_blank')}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
});