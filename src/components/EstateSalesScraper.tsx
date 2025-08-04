import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FirecrawlService } from '@/utils/FirecrawlService';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, DollarSign, Search, Grid, Route, Map, Loader2, Sparkles, List } from 'lucide-react';
import { EstateSaleCard } from './EstateSaleCard';
import { MapView } from './MapView';
import { RouteOptimizationDialog } from './RouteOptimizationDialog';
import { LocationInput } from './LocationInput';


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
}

interface CrawlResult {
  success: boolean;
  status?: string;
  completed?: number;
  total?: number;
  creditsUsed?: number;
  expiresAt?: string;
  data?: any[];
}

export const EstateSalesScraper = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [radiusFilter, setRadiusFilter] = useState<number>(25);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [selectedSales, setSelectedSales] = useState<EstateSale[]>([]);
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Helper function to parse distance from text
  const parseDistance = (distanceText?: string): number => {
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
  };

  const handleSaleSelection = (sale: EstateSale, selected: boolean) => {
    const saleId = sale.uniqueId || `${sale.title}-${sale.address}-${sale.date}`;
    if (selected) {
      setSelectedSales(prev => [...prev, sale]);
    } else {
      setSelectedSales(prev => prev.filter(s => {
        const existingId = s.uniqueId || `${s.title}-${s.address}-${s.date}`;
        return existingId !== saleId;
      }));
    }
  };

  const handlePlanRoute = () => {
    if (selectedSales.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 estate sales to plan a route",
        variant: "destructive",
      });
      return;
    }
    setShowRouteDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url || url.trim() === '') {
      toast({
        title: "Location Required",
        description: "Please select a location first",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    setProgress(0);
    setCrawlResult(null);
    
    try {
      console.log('Starting crawl for URL:', url);
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await FirecrawlService.crawlWebsite(url);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Estate sales data scraped successfully!",
          duration: 3000,
        });
        setCrawlResult(result.data);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to scrape estate sales data",
          variant: "destructive",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error scraping website:', error);
      toast({
        title: "Error",
        description: "Failed to scrape website",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderResults = () => {
    if (!crawlResult || !crawlResult.data || crawlResult.data.length === 0) {
      return null;
    }

    // First deduplicate results based on similar titles and addresses
    const deduplicatedData = crawlResult.data.filter((item: any, index: number, self: any[]) => {
      return index === self.findIndex((other: any) => {
        const itemTitle = (item.title || item.markdown || '').toLowerCase().trim();
        const otherTitle = (other.title || other.markdown || '').toLowerCase().trim();
        const itemAddress = (item.address || item.markdown || '').toLowerCase().trim();
        const otherAddress = (other.address || other.markdown || '').toLowerCase().trim();
        
        // Consider items duplicates if titles are very similar or addresses match
        const titleSimilarity = itemTitle === otherTitle || 
          (itemTitle.length > 10 && otherTitle.length > 10 && 
           (itemTitle.includes(otherTitle.substring(0, 15)) || otherTitle.includes(itemTitle.substring(0, 15))));
        
        const addressSimilarity = itemAddress === otherAddress ||
          (itemAddress.includes('del rio') && otherAddress.includes('del rio')) ||
          (itemAddress.includes('grand blanc') && otherAddress.includes('grand blanc') && 
           itemAddress.length < 50 && otherAddress.length < 50);
        
        return titleSimilarity || addressSimilarity;
      });
    });

    // Then filter by radius if not set to "All distances"
    const filteredData = radiusFilter === 999 ? deduplicatedData : deduplicatedData.filter((item: any) => {
      const distance = parseDistance(item.distance);
      return distance <= radiusFilter;
    });

    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Grid className="w-5 h-5 text-vintage-gold" />
              Found Estate Sales ({filteredData.length})
            </h4>
            {radiusFilter !== 999 && filteredData.length !== deduplicatedData.length && (
              <Badge variant="outline" className="text-xs">
                {deduplicatedData.length - filteredData.length} filtered out
               </Badge>
             )}
           </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-muted/50 rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="flex items-center gap-1 h-8"
              >
                <List className="w-4 h-4" />
                List
              </Button>
              <Button
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('map')}
                className="flex items-center gap-1 h-8"
              >
                <Map className="w-4 h-4" />
                Map
              </Button>
            </div>
            {selectedSales.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {selectedSales.length} selected
                </Badge>
                <Button 
                  onClick={handlePlanRoute}
                  size="sm"
                  variant="vintage"
                  className="flex items-center gap-1"
                >
                  <Map className="w-4 h-4" />
                  Plan Route
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Results Display */}
        {viewMode === 'map' ? (
          <MapView sales={filteredData.map((item: any, index: number) => ({
            title: item.title || '',
            address: item.address || '',
            city: item.city || '',
            state: item.state || '',
            zipCode: item.zipCode || '',
            company: item.company || '',
            date: item.date || '',
            time: item.time || '',
            distance: item.distance || '',
            status: item.status || '',
            featured: item.featured || '',
            url: item.url || item.sourceURL || '',
            imageUrl: item.imageUrl || '',
            description: item.description || ''
          }))} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredData.map((item: any, index: number) => {
              const uniqueId = `sale-${index}-${item.title?.slice(0, 20) || 'untitled'}-${item.address?.slice(0, 20) || 'no-address'}`.replace(/[^a-zA-Z0-9-]/g, '-');
              const saleData: EstateSale = {
                title: item.title,
                date: item.date,
                address: item.address,
                description: item.description,
                url: item.url || item.sourceURL,
                status: item.status,
                company: item.company,
                distance: item.distance,
                markdown: item.markdown,
                city: item.city,
                state: item.state,
                zipCode: item.zipCode,
                streetAddress: item.streetAddress,
                uniqueId: uniqueId,
                imageUrl: item.imageUrl
              };
              
              const isSelected = selectedSales.some(s => {
                const existingId = s.uniqueId || `${s.title}-${s.address}-${s.date}`;
                return existingId === uniqueId;
              });
              
              return (
                <EstateSaleCard 
                  key={uniqueId} 
                  sale={saleData}
                  isSelected={isSelected}
                  onSelect={handleSaleSelection}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl ring-4 ring-primary/20">
            <Sparkles className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Alyssa's Treasure Finder</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover hidden treasures at estate sales with intelligent route planning
          </p>
        </div>

        {/* Scraping Form */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-8 mb-8 shadow-lg animate-scale-in">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <LocationInput 
                  onLocationChange={setUrl}
                  initialLocation={undefined}
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-lg font-medium text-foreground flex items-center gap-3">
                  <Route className="w-5 h-5 text-primary" />
                  Search Radius
                </label>
                <Select value={radiusFilter.toString()} onValueChange={(value) => setRadiusFilter(parseInt(value))}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select radius" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 miles</SelectItem>
                    <SelectItem value="10">10 miles</SelectItem>
                    <SelectItem value="15">15 miles</SelectItem>
                    <SelectItem value="20">20 miles</SelectItem>
                    <SelectItem value="25">25 miles</SelectItem>
                    <SelectItem value="30">30 miles</SelectItem>
                    <SelectItem value="50">50 miles</SelectItem>
                    <SelectItem value="999">All distances</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {isLoading && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-between text-sm font-medium text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finding estate sales...
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full h-2 bg-muted/50" />
              </div>
            )}
            
            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
              className="w-full h-14 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover-scale"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Finding Treasures...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-3" />
                  Discover Estate Sales
                </>
              )}
            </Button>
          </form>
        </div>

        {renderResults()}

        <RouteOptimizationDialog
          open={showRouteDialog}
          onOpenChange={setShowRouteDialog}
          selectedSales={selectedSales}
        />
      </div>
    </div>
  );
};