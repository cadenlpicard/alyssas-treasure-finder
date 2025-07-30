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
  const extractFromMarkdown = (markdown: string): { title: string; date: string; address: string; company: string } => {
    const lines = markdown.split('\n');
    let title = '';
    let date = '';
    let address = '';
    let company = '';
    
    // Look for common patterns in estate sale listings
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Title is often the first heading or large text
      if (line.startsWith('#') && !title) {
        title = line.replace(/^#+\s*/, '');
      }
      
      // Look for date patterns
      if (line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i) && !date) {
        date = line;
      }
      
      // Look for address patterns (contains street numbers or "Dr", "St", "Ave", etc.)
      if (line.match(/\d+.*?(street|st|avenue|ave|drive|dr|road|rd|lane|ln|way|circle|cir)/i) && !address) {
        address = line;
      }
      
      // Look for company/organizer
      if (line.toLowerCase().includes('estate sale') && line.toLowerCase().includes('by') && !company) {
        company = line;
      }
    }
    
    return { title, date, address, company };
  };

  const extracted = sale.markdown ? extractFromMarkdown(sale.markdown) : { title: '', date: '', address: '', company: '' };
  
  const displayTitle = sale.title || extracted.title || 'Estate Sale';
  const displayDate = sale.date || extracted.date || 'Date TBD';
  const displayAddress = sale.address || extracted.address || 'Address TBD';
  const displayCompany = sale.company || extracted.company || '';
  const displayDescription = sale.description || sale.markdown?.substring(0, 200) + '...' || 'No description available';

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
        
        <p className="text-sm text-muted-foreground line-clamp-3">
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