import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { FirecrawlService } from '@/utils/FirecrawlService';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, DollarSign, Search, Grid, Route, Map, Loader2, Sparkles, List, ArrowUpDown, Store } from 'lucide-react';
import { EstateSaleCard } from './EstateSaleCard';
const MapView = lazy(() => import('./MapView').then(m => ({ default: m.MapView })));
const RouteOptimizationDialog = lazy(() => import('./RouteOptimizationDialog').then(m => ({ default: m.RouteOptimizationDialog })));
import { LocationInput } from './LocationInput';
import { createLogger } from '@/lib/logger';

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
  const logger = createLogger('EstateSalesScraper');
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [radiusFilter, setRadiusFilter] = useState<number>(25);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [selectedSales, setSelectedSales] = useState<EstateSale[]>([]);
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'distance'>('date');
  const [includeThriftStores, setIncludeThriftStores] = useState(false);
  const [includeCraigslist, setIncludeCraigslist] = useState(false);

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

  const handleSaleSelection = useCallback((sale: EstateSale, selected: boolean) => {
    const saleId = sale.uniqueId || `${sale.title}-${sale.address}-${sale.date}`;
    logger.info('Selection toggled', { saleId, selected });
    setSelectedSales(prev => selected
      ? [...prev, sale]
      : prev.filter(s => (s.uniqueId || `${s.title}-${s.address}-${s.date}`) !== saleId)
    );
  }, []);

  const handlePlanRoute = useCallback(() => {
    if (selectedSales.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 estate sales to plan a route",
        variant: "destructive",
      });
      return;
    }
    logger.info('Opening route dialog', { selectedCount: selectedSales.length });
    setShowRouteDialog(true);
  }, [selectedSales.length, toast]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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

    const start = performance.now();
    logger.info('Crawl started', { url, includeThriftStores, radiusFilter });

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const estatePromise = FirecrawlService.crawlWebsite(url);
      const thriftPromise = includeThriftStores 
        ? FirecrawlService.searchThriftStores(url, radiusFilter)
        : null;
      const craigslistPromise = includeCraigslist
        ? FirecrawlService.searchCraigslist(url, radiusFilter)
        : null;

      const [estateSalesResult, thriftStoresResult, craigslistResult] = await Promise.all([
        estatePromise,
        thriftPromise ? thriftPromise : Promise.resolve({ success: false }) as any,
        craigslistPromise ? craigslistPromise : Promise.resolve({ success: false }) as any,
      ]);

      let allResults: any[] = [];

      if (estateSalesResult.success) {
        allResults = [...(estateSalesResult.data?.data || [])];
      }

    if ((thriftStoresResult as any)?.success && (thriftStoresResult as any)?.data) {
      allResults = [...allResults, ...((thriftStoresResult as any).data)];
    }
    if ((craigslistResult as any)?.success && (craigslistResult as any)?.data) {
      allResults = [...allResults, ...((craigslistResult as any).data)];
    }

      clearInterval(progressInterval);
      setProgress(100);

      const durationMs = Math.round(performance.now() - start);
      logger.info('Crawl completed', { resultCount: allResults.length, durationMs });

      if (allResults.length > 0) {
        toast({
          title: "Success",
          description: `Found ${allResults.length} ${includeThriftStores || includeCraigslist ? 'results' : 'estate sales'}!`,
          duration: 3000,
        });
        setCrawlResult({
          success: true,
          status: 'completed',
          completed: allResults.length,
          total: allResults.length,
          creditsUsed: 1,
          data: allResults
        });
      } else {
        toast({
          title: "Error",
          description: estateSalesResult.error || "Failed to find any results",
          variant: "destructive",
          duration: 3000,
        });
      }
    } catch (error) {
      logger.error('Error scraping website', { error });
      toast({
        title: "Error",
        description: "Failed to scrape website",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [url, includeThriftStores, radiusFilter, toast]);

  const renderResults = () => {
    if (!crawlResult || !crawlResult.data || crawlResult.data.length === 0) {
      return null;
    }

    // First deduplicate results across sources
    const seen = new Set<string>();
    const stopwords = ['estate','sale','garage','moving','tag','online','auction','local'];
    const norm = (s?: string) => (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w && !stopwords.includes(w))
      .join(' ');

    const deduplicatedData = crawlResult.data.filter((item: any) => {
      const title = norm(item.title || item.markdown || '');
      const addr = norm(item.address || item.streetAddress || '');
      const key = (addr ? addr : title).slice(0, 80);
      if (key.length < 3) return true; // keep items with no meaningful key
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter by radius and date
    const filteredData = deduplicatedData.filter((item: any) => {
      // Filter by radius if not set to "All distances"
      if (radiusFilter !== 999) {
        const distance = parseDistance(item.distance);
        if (distance > radiusFilter) return false;
      }
      
      // For estate sales, only show those in the next 5 days
      if (item.type !== 'thrift_store' && item.date) {
        const parseDate = (dateStr: string): Date => {
          if (!dateStr || dateStr === 'Date TBD') return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Far future for TBD
          
          const currentYear = new Date().getFullYear();
          const dateMatch = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
          
          if (dateMatch) {
            const [, month, day] = dateMatch;
            const monthMap: { [key: string]: number } = {
              'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
              'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };
            const monthIndex = monthMap[month.toLowerCase()];
            const dayNum = parseInt(day);
            return new Date(currentYear, monthIndex, dayNum);
          }
          
          return new Date(); // Default to today if can't parse
        };
        
        const saleDate = parseDate(item.date);
        const today = new Date();
        const fiveDaysFromNow = new Date(today.getTime() + (5 * 24 * 60 * 60 * 1000));
        
        // Only include if the sale is within the next 5 days
        if (saleDate > fiveDaysFromNow) return false;
      }
      
      return true;
    });

    // Sort the data based on selected sort option
    const sortedData = filteredData.sort((a: any, b: any) => {
      if (sortBy === 'distance') {
        const distanceA = parseDistance(a.distance);
        const distanceB = parseDistance(b.distance);
        return distanceA - distanceB;
      } else if (sortBy === 'date') {
        // Parse dates for comparison
        const parseDate = (dateStr: string): Date => {
          if (!dateStr || dateStr === 'Date TBD') return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Far future for TBD
          
          const currentYear = new Date().getFullYear();
          const dateMatch = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
          
          if (dateMatch) {
            const [, month, day] = dateMatch;
            const monthMap: { [key: string]: number } = {
              'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
              'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };
            const monthIndex = monthMap[month.toLowerCase()];
            const dayNum = parseInt(day);
            return new Date(currentYear, monthIndex, dayNum);
          }
          
          return new Date(); // Default to today if can't parse
        };
        
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateA.getTime() - dateB.getTime();
      }
      return 0;
    });

    return (
      <div className="mt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div className="flex items-center gap-4">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Grid className="w-5 h-5 text-vintage-gold" />
              Found Results ({sortedData.length})
              <div className="flex gap-1 ml-2">
                {(() => {
                  const estateSales = sortedData.filter((item: any) => item.type !== 'thrift_store').length;
                  const thriftStores = sortedData.filter((item: any) => item.type === 'thrift_store').length;
                  return (
                    <>
                      {estateSales > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {estateSales} Estate Sales
                        </Badge>
                      )}
                      {thriftStores > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {thriftStores} Thrift Stores
                        </Badge>
                      )}
                    </>
                  );
                })()}
              </div>
            </h4>
            {radiusFilter !== 999 && sortedData.length !== deduplicatedData.length && (
              <Badge variant="outline" className="text-xs">
                {deduplicatedData.length - sortedData.length} filtered out
              </Badge>
             )}
           </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Sort Option */}
            <Select value={sortBy} onValueChange={(value: 'date' | 'distance') => setSortBy(value)}>
              <SelectTrigger className="h-8 w-32">
                <ArrowUpDown className="w-4 h-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-card max-h-[60vh] overflow-auto">
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="distance">By Distance</SelectItem>
              </SelectContent>
            </Select>
            
            {/* View Toggle */}
            <div className="flex items-center bg-muted/50 rounded-lg p-1 flex-shrink-0">
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
          <MapView 
            sales={sortedData
              .filter((item: any) => {
                // Only show items with valid street addresses in map mode
                const address = item.address || '';
                if (!address || 
                    address === 'Address TBD' || 
                    address.trim() === '' ||
                    address.includes('Last modified') ||
                    address.includes('Pictures') ||
                    address.includes('Picture Added') ||
                    address.includes('hours ago') ||
                    address.includes('minutes ago') ||
                    address.includes('days ago')) {
                  return false;
                }
                
                // Must have a street number and street name pattern
                const hasStreetAddress = /\d+\s+[A-Za-z\s]+(dr|drive|st|street|ave|avenue|rd|road|ln|lane|way|circle|ct|court|pkwy|parkway|blvd|boulevard|place|pl)/i.test(address);
                return hasStreetAddress;
              })
              .map((item: any, index: number) => ({
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
                description: item.description || '',
                type: item.type || 'estate_sale'
              }))}
            selectedSales={selectedSales.map(s => s.title || '')}
            onSaleSelection={(saleTitle, selected) => {
              const sale = sortedData.find((item: any) => item.title === saleTitle);
              if (sale) {
                const saleData: EstateSale = {
                  title: sale.title || '',
                  address: sale.address || '',
                  city: sale.city || '',
                  state: sale.state || '',
                  zipCode: sale.zipCode || '',
                  company: sale.company || '',
                  date: sale.date || '',
                  distance: sale.distance || '',
                  status: sale.status || '',
                  url: sale.url || sale.sourceURL || '',
                  imageUrl: sale.imageUrl || '',
                  description: sale.description || '',
                  uniqueId: `sale-${saleTitle}-${sale.address}`.replace(/[^a-zA-Z0-9-]/g, '-')
                };
                handleSaleSelection(saleData, selected);
              }
            }}
            onPlanRoute={handlePlanRoute}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedData.map((item: any, index: number) => {
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
                  imageUrl: item.imageUrl,
                  type: item.type || 'estate_sale',
                  businessHours: item.businessHours,
                  phone: item.phone,
                  rating: item.rating
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
    <div className="px-4 py-6 sm:p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl ring-4 ring-primary/20">
            <Sparkles className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold text-foreground mb-4">Alyssa's Treasure Finder</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover hidden treasures at estate sales with intelligent route planning
          </p>
        </div>

        {/* Scraping Form */}
        <div className="ornate-card p-6 sm:p-8 mb-8 shadow-lg animate-scale-in">
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
                  <SelectContent className="z-50 bg-card max-h-[60vh] overflow-auto">
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
            
            <div className="flex flex-wrap items-center gap-3 bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="include-thrift-stores"
                  checked={includeThriftStores}
                  onCheckedChange={(checked) => setIncludeThriftStores(!!checked)}
                />
                <label 
                  htmlFor="include-thrift-stores" 
                  className="text-lg font-medium text-foreground flex items-center gap-3 cursor-pointer"
                >
                  <Store className="w-5 h-5 text-primary" />
                  Include thrift stores
                </label>
              </div>
              <Button
                type="button"
                variant={includeCraigslist ? 'vintage' : 'outline'}
                size="sm"
                onClick={() => setIncludeCraigslist((v) => !v)}
                className="ml-auto"
                aria-pressed={includeCraigslist}
              >
                {includeCraigslist ? 'Craigslist: On' : 'Include Craigslist'}
              </Button>
            </div>
            
            {isLoading && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-between text-sm font-medium text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
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

        <Suspense fallback={null}>
          <RouteOptimizationDialog
            open={showRouteDialog}
            onOpenChange={setShowRouteDialog}
            selectedSales={selectedSales}
          />
        </Suspense>
      </div>
    </div>
  );
};