import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Route, X, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface RouteOptimizerProps {
  selectedSales: EstateSale[];
  onClose: () => void;
}

export const RouteOptimizer: React.FC<RouteOptimizerProps> = ({ selectedSales, onClose }) => {
  const [startingAddress, setStartingAddress] = useState('');
  const [optimizedSales, setOptimizedSales] = useState<EstateSale[]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const { toast } = useToast();

  // Helper function to extract address from sale
  const extractAddressFromSale = (sale: EstateSale): string => {
    // First try the parsed address field
    if (sale.address && sale.address.trim()) {
      return sale.address.trim();
    }
    
    // Then try to extract address from markdown
    if (sale.markdown) {
      // Look for street address pattern
      const streetAddressPattern = /(\d+\s+[^\\,\n]+(?:pkwy|parkway|drive|dr\.?|road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|court|ct\.?|boulevard|blvd\.?|circle|cir\.?|way|place|pl\.?))\s*\\{2,}\s*([^\\,\n]+),?\s*(MI|Michigan)\s*(\d{5})?/i;
      const streetMatch = sale.markdown.match(streetAddressPattern);
      
      if (streetMatch) {
        const streetAddress = streetMatch[1].trim();
        const city = streetMatch[2].trim();
        const state = streetMatch[3] || 'MI';
        const zip = streetMatch[4] || '';
        
        let fullAddress = `${streetAddress}, ${city}, ${state}`;
        if (zip) {
          fullAddress += ` ${zip}`;
        }
        return fullAddress;
      }
      
      // Look for city, state, zip pattern
      const cityStatePattern = /([A-Z][a-z\s]+),?\s*(MI|Michigan)\s*(\d{5})/i;
      const cityMatch = sale.markdown.match(cityStatePattern);
      
      if (cityMatch) {
        const city = cityMatch[1].trim();
        const state = cityMatch[2] || 'MI';
        const zip = cityMatch[3] || '';
        
        let fullAddress = `${city}, ${state}`;
        if (zip) {
          fullAddress += ` ${zip}`;
        }
        return fullAddress;
      }
    }
    
    return 'Address not found';
  };

  // Calculate optimized route using ChatGPT
  const calculateOptimizedRoute = async () => {
    if (selectedSales.length < 2) {
      toast({
        title: "Error",
        description: "Need at least 2 estate sales to optimize route",
        variant: "destructive",
      });
      return;
    }

    setIsCalculatingRoute(true);
    try {
      // Extract full addresses for ChatGPT optimization
      const addresses = selectedSales.map(sale => extractAddressFromSale(sale));
      
      console.log('Sending addresses to ChatGPT for optimization:', addresses);
      
      const { data, error } = await supabase.functions.invoke('optimize-route-with-chatgpt', {
        body: {
          addresses: addresses,
          startingAddress: startingAddress.trim() || null
        }
      });

      if (error) {
        console.error('Error calling ChatGPT optimization:', error);
        throw error;
      }

      console.log('ChatGPT optimization result:', data);

      if (data.optimizedOrder && data.optimizedOrder.length > 0) {
        // Reorder sales based on ChatGPT optimization
        const reorderedSales = data.optimizedOrder.map((index: number) => selectedSales[index]);
        setOptimizedSales(reorderedSales);
        
        toast({
          title: "Route Optimized!",
          description: `Route optimized for ${reorderedSales.length} estate sales`,
        });
      } else {
        // Fallback to original order
        setOptimizedSales(selectedSales);
        toast({
          title: "Using Original Order",
          description: "Could not optimize route, showing original order",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error with ChatGPT route optimization:', error);
      toast({
        title: "Route Error",
        description: "Failed to optimize route. Showing original order.",
        variant: "destructive",
      });
      // Fallback to original order
      setOptimizedSales(selectedSales);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Route Optimizer
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Starting Address Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Starting Address (Optional)</label>
            <Input
              placeholder="Enter your starting address..."
              value={startingAddress}
              onChange={(e) => setStartingAddress(e.target.value)}
            />
          </div>

          {/* Calculate Route Button */}
          <Button 
            onClick={calculateOptimizedRoute}
            disabled={isCalculatingRoute || selectedSales.length < 2}
            className="w-full"
          >
            {isCalculatingRoute ? "Optimizing Route..." : "Optimize Route"}
          </Button>

          {/* Original Sales List */}
          {optimizedSales.length === 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Selected Estate Sales ({selectedSales.length})</h3>
              {selectedSales.map((sale, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs">
                      {index + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {sale.title || 'Estate Sale'}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {extractAddressFromSale(sale)}
                        </p>
                      </div>
                      {sale.date && (
                        <p className="text-xs text-muted-foreground mt-1">{sale.date}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Optimized Route Results */}
          {optimizedSales.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-green-600">Optimized Route ({optimizedSales.length} stops)</h3>
              <p className="text-sm text-muted-foreground">
                Estate sales listed in the most efficient driving order:
              </p>
              
              {startingAddress && (
                <Card className="p-3 bg-blue-50">
                  <div className="flex items-start gap-3">
                    <Badge variant="default" className="text-xs bg-blue-600">
                      START
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">Starting Point</h4>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{startingAddress}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              
              {optimizedSales.map((sale, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="text-xs">
                      {index + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {sale.title || 'Estate Sale'}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {extractAddressFromSale(sale)}
                        </p>
                      </div>
                      {sale.date && (
                        <p className="text-xs text-muted-foreground mt-1">{sale.date}</p>
                      )}
                      {sale.company && (
                        <p className="text-xs text-muted-foreground">{sale.company}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};