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
    const lines = markdown.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let title = '';
    let date = '';
    let address = '';
    let company = '';
    let description = '';
    
    // Look for patterns specific to estate sale listings
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Title patterns - often contain "SALE" or are in all caps
      if (!title && (lowerLine.includes('sale') || line === line.toUpperCase()) && line.length > 10 && line.length < 100) {
        title = line;
      }
      
      // Date patterns - look for month names, dates, or specific date formats
      if (!date && (
        line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i) ||
        line.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) ||
        line.match(/\d{1,2}-\d{1,2}-\d{2,4}/) ||
        line.match(/\w+\s+\d{1,2}/) ||
        lowerLine.includes('aug ') ||
        lowerLine.includes('jul ')
      )) {
        date = line;
      }
      
      // Address patterns - look for street addresses
      if (!address && (
        line.match(/\d+\s+[A-Za-z\s]+(street|st|avenue|ave|drive|dr|road|rd|lane|ln|way|circle|cir|court|ct|place|pl|boulevard|blvd)[\s\w]*/i) ||
        line.match(/\[\d+\s+[A-Za-z\s]+/i)
      )) {
        address = line.replace(/[\[\]]/g, ''); // Remove brackets if present
      }
      
      // Company/presenter patterns
      if (!company && (
        lowerLine.includes('presented by') ||
        lowerLine.includes('estate sales') ||
        lowerLine.includes('four star') ||
        lowerLine.includes('call ')
      )) {
        company = line;
      }
      
      // Description - look for longer descriptive text
      if (!description && line.length > 50 && !lowerLine.includes('estate sale') && !line.match(/\d+\s+\w+/)) {
        description = line;
      }
    }
    
    // Fallback extraction from concatenated text
    const fullText = lines.join(' ');
    
    // Extract dates from full text if not found
    if (!date) {
      const dateMatch = fullText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i) ||
                       fullText.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) ||
                       fullText.match(/##+\s*(Aug|Jul|Sep|Oct|Nov|Dec)\s*\d{1,2}/i);
      if (dateMatch) {
        date = dateMatch[0].replace(/#+\s*/, '');
      }
    }
    
    return { 
      title: title || 'Estate Sale', 
      date: date || 'Date TBD', 
      address: address || 'Address TBD', 
      company: company || '',
      description: description || 'Estate sale details'
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