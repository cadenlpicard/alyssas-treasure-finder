import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, ExternalLink, Tag } from 'lucide-react';

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
}

interface EstateSaleCardProps {
  sale: EstateSale;
}

export const EstateSaleCard = ({ sale }: EstateSaleCardProps) => {
  // Extract data from markdown if other fields are not available
  const extractFromMarkdown = (markdown: string): { title: string; date: string; address: string; company: string; description: string } => {
    if (!markdown) return { title: 'Estate Sale', date: 'Date TBD', address: 'Address TBD', company: '', description: 'No details available' };
    
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
        line.match(/\d+\s+[A-Za-z\s]+(dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court)/i) ||
        (line.includes('Grand Blanc') && line.includes('MI'))
      )) {
        // Clean up address formatting
        let cleanAddress = line
          .replace(/Grand Blanc,?\s*MI\s*\d*/gi, 'Grand Blanc, MI')
          .replace(/\\\\/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/^\[|\]$/g, '') // Remove leading/trailing brackets
          .trim();
        
        // If it's just "Grand Blanc, MI" with extra numbers, clean it up
        if (cleanAddress.match(/^Grand Blanc,?\s*MI\s*\d+$/i)) {
          cleanAddress = 'Grand Blanc, MI';
        }
        
        address = cleanAddress;
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
          !lowerLine.includes('estate sale') && 
          !lowerLine.includes('grand blanc')) {
        description = line;
      }
    }
    
    // Fallbacks and cleanup
    if (!title && company) {
      title = company.replace(/estate sales?/gi, 'Estate Sale').trim();
    }
    
    if (!title) {
      title = 'Grand Blanc Estate Sale';
    }
    
    if (!address && lines.some(line => line.includes('Grand Blanc'))) {
      address = 'Grand Blanc, MI';
    }
    
    if (!company && title.toLowerCase().includes('estate')) {
      company = 'Estate Sale';
    }
    
    if (!description) {
      description = 'Estate sale in Grand Blanc, Michigan. Contact organizer for details.';
    }
    
    return { 
      title: title.trim(), 
      date: date.trim() || 'Date TBD', 
      address: address.trim() || 'Grand Blanc, MI', 
      company: company.trim(),
      description: description.trim()
    };
  };

  const extracted = sale.markdown ? extractFromMarkdown(sale.markdown) : { 
    title: '', 
    date: '', 
    address: '', 
    company: '',
    description: ''
  };
  
  const displayTitle = sale.title || extracted.title;
  const displayDate = sale.date || extracted.date;
  const displayAddress = sale.address || extracted.address;
  const displayCompany = sale.company || extracted.company;
  const displayDescription = sale.description || extracted.description;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-vintage-gold/20 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold text-foreground leading-tight">
            {displayTitle}
          </CardTitle>
          {sale.status && (
            <Badge variant="secondary" className="text-xs">
              {sale.status}
            </Badge>
          )}
        </div>
        
        {displayCompany && (
          <p className="text-sm text-muted-foreground font-medium">
            {displayCompany}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-estate-red flex-shrink-0" />
            <span className="text-foreground">{displayDate}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-treasure-green flex-shrink-0" />
            <span className="text-foreground">{displayAddress}</span>
            {sale.distance && (
              <Badge variant="outline" className="text-xs ml-auto">
                {sale.distance}
              </Badge>
            )}
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed"
           title={displayDescription}>
          {displayDescription}
        </p>
        
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Tag className="w-3 h-3" />
            <span>Estate Sale</span>
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
  );
};