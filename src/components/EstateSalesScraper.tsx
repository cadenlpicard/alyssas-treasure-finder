import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FirecrawlService } from '@/utils/FirecrawlService';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, DollarSign, Search, Grid } from 'lucide-react';
import { EstateSaleCard } from './EstateSaleCard';

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
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [hasApiKey, setHasApiKey] = useState(!!FirecrawlService.getApiKey());

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Firecrawl API key",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    const isValid = await FirecrawlService.testApiKey(apiKey);
    if (isValid) {
      FirecrawlService.saveApiKey(apiKey);
      setHasApiKey(true);
      setApiKey('');
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
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
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
          
          <Button type="submit" variant="vintage" className="w-full">
            Save API Key
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-8 bg-gradient-to-br from-background to-accent rounded-xl shadow-lg border border-border">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-vintage-gold to-estate-red rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-10 h-10 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Estate Sales Finder</h2>
        <p className="text-muted-foreground">
          Discover hidden treasures at Michigan estate sales
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mb-8">
        <div className="space-y-2">
          <label htmlFor="url" className="text-sm font-medium text-foreground flex items-center gap-2">
            <Search className="w-4 h-4" />
            Estate Sales Website URL
          </label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="transition-all duration-200"
            placeholder="https://www.estatesales.net/MI/Grand-Blanc"
            required
          />
        </div>
        
        {isLoading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Scraping estate sales...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}
        
        <Button
          type="submit"
          disabled={isLoading}
          variant="vintage"
          size="lg"
          className="w-full"
        >
          {isLoading ? "Finding Treasures..." : "Scrape Estate Sales"}
        </Button>
      </form>

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
                  <h4 className="font-semibold mb-4 text-foreground flex items-center gap-2">
                    <Grid className="w-5 h-5 text-vintage-gold" />
                    Found Estate Sales ({deduplicatedData.length})
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {deduplicatedData.map((item: any, index: number) => (
                      <EstateSaleCard 
                        key={index} 
                        sale={{
                          title: item.title,
                          date: item.date,
                          address: item.address,
                          description: item.description,
                          url: item.url || item.sourceURL,
                          status: item.status,
                          company: item.company,
                          distance: item.distance,
                          markdown: item.markdown
                        }} 
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};