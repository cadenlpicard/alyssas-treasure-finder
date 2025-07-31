import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FirecrawlService } from '@/utils/FirecrawlService';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, DollarSign, Search, Grid, Route, Map, Key, Loader2, Sparkles } from 'lucide-react';
import { EstateSaleCard } from './EstateSaleCard';
import { RouteMap } from './RouteMap';
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
  const [url, setUrl] = useState('https://www.estatesales.net/MI/Grand-Blanc');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyTesting, setIsApiKeyTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [hasApiKey, setHasApiKey] = useState(!!FirecrawlService.getApiKey());
  const [selectedSales, setSelectedSales] = useState<EstateSale[]>([]);
  const [showRouteMap, setShowRouteMap] = useState(false);

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Firecrawl API key",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsApiKeyTesting(true);
    try {
      const isValid = await FirecrawlService.testApiKey(apiKeyInput);
      if (isValid) {
        FirecrawlService.saveApiKey(apiKeyInput);
        setHasApiKey(true);
        setApiKeyInput('');
        toast({
          title: "Success",
          description: "API key saved successfully!",
          duration: 3000,
        });
      } else {
        toast({
          title: "Error",
          description: "Invalid API key. Please check and try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    } finally {
      setIsApiKeyTesting(false);
    }
  };

  const handleSaleSelection = (sale: EstateSale, selected: boolean) => {
    if (selected) {
      setSelectedSales(prev => [...prev, sale]);
    } else {
      setSelectedSales(prev => prev.filter(s => s !== sale));
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
    setShowRouteMap(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setProgress(0);
    setCrawlResult(null);
    
    try {
      const apiKey = FirecrawlService.getApiKey();
      if (!apiKey) {
        toast({
          title: "Error",
          description: "Please set your API key first",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

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

  if (showRouteMap) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8">
        <RouteMap 
          selectedSales={selectedSales} 
          onClose={() => setShowRouteMap(false)} 
        />
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-gradient-to-br from-background to-accent rounded-xl shadow-lg border border-border">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-vintage-gold rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Setup Required</h3>
          <p className="text-muted-foreground text-sm">
            Enter your Firecrawl API key to start scraping estate sales
          </p>
        </div>
        
        <form onSubmit={handleApiKeySubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium text-foreground">
              Firecrawl API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="fc-..."
              className="transition-all duration-200"
              required
            />
            <p className="text-xs text-muted-foreground">
              Get your API key from{' '}
              <a 
                href="https://firecrawl.dev" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                firecrawl.dev
              </a>
            </p>
          </div>
          
          <Button 
            type="submit" 
            disabled={isApiKeyTesting || !apiKeyInput.trim()}
            className="w-full"
          >
            {isApiKeyTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing API Key...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Save API Key
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl ring-4 ring-primary/20">
            <Sparkles className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Estate Sales Finder</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover hidden treasures at Michigan estate sales with intelligent route planning
          </p>
        </div>

        {/* Scraping Form */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-8 mb-8 shadow-lg animate-scale-in">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-lg font-medium text-foreground flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary" />
                Select Location
              </label>
              <LocationInput 
                onLocationChange={setUrl}
                initialLocation={{ city: "Grand Blanc", state: "MI", zipcode: "48439" }}
              />
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

      {crawlResult && (
        <Card className="border-vintage-gold/30 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-treasure-green">
              <Calendar className="w-5 h-5" />
              Scraping Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-accent/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="secondary" className="mt-1">
                  {crawlResult.status}
                </Badge>
              </div>
              <div className="text-center p-3 bg-accent/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Pages Found</p>
                <p className="text-lg font-semibold text-foreground">
                  {crawlResult.completed}/{crawlResult.total}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-vintage-gold" />
                <span className="text-sm text-foreground">Credits Used:</span>
              </div>
              <span className="font-semibold text-primary">{crawlResult.creditsUsed}</span>
            </div>
            
            {crawlResult.data && crawlResult.data.length > 0 && (() => {
              // Deduplicate results based on similar titles and addresses
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

              return (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Grid className="w-5 h-5 text-vintage-gold" />
                      Found Estate Sales ({deduplicatedData.length})
                    </h4>
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
                  <div className="grid gap-4 md:grid-cols-2">
                    {deduplicatedData.map((item: any, index: number) => {
                      const saleData: EstateSale = {
                        title: item.title,
                        date: item.date,
                        address: item.address,
                        description: item.description,
                        url: item.url || item.sourceURL,
                        status: item.status,
                        company: item.company,
                        distance: item.distance,
                        markdown: item.markdown
                      };
                      
                      return (
                        <EstateSaleCard 
                          key={index} 
                          sale={saleData}
                          isSelected={selectedSales.some(s => s.markdown === saleData.markdown)}
                          onSelect={handleSaleSelection}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
};