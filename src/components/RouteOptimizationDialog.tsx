import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { MapPin, Route, Clock, Loader2, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
}

interface RouteOptimizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSales: EstateSale[];
}

export const RouteOptimizationDialog = ({ open, onOpenChange, selectedSales }: RouteOptimizationDialogProps) => {
  const { toast } = useToast();
  const [startingAddress, setStartingAddress] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<string[]>([]);
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string>('');

  // Helper function to extract address from markdown
  const extractAddressFromMarkdown = (markdown: string): string | null => {
    if (!markdown) return null;
    
    // Look for street address patterns in markdown
    const streetAddressPattern = /(\d+\s+[^\\,\n]+(?:pkwy|parkway|drive|dr\.?|road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|court|ct\.?|boulevard|blvd\.?|circle|cir\.?|way|place|pl\.?))\s*\\{2,}\s*\\{2,}\s*([^\\,\n]+),?\s*(MI|Michigan)\s*(\d{5})?/i;
    const streetMatch = markdown.match(streetAddressPattern);
    
    if (streetMatch) {
      const streetAddress = streetMatch[1].trim();
      const city = streetMatch[2].trim();
      const state = streetMatch[3] || 'MI';
      const zip = streetMatch[4] || '';
      
      let fullAddress = streetAddress + `, ${city}, ${state}`;
      if (zip) {
        fullAddress += ` ${zip}`;
      }
      
      return fullAddress;
    }
    
    // Look for city, state, zip pattern
    const cityStatePattern = /([A-Z][a-z\s]+),?\s*(MI|Michigan)\s*(\d{5})/i;
    const cityMatch = markdown.match(cityStatePattern);
    
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
    
    return null;
  };

  const handleOptimizeRoute = async () => {
    if (!startingAddress.trim()) {
      toast({
        title: "Starting Address Required",
        description: "Please enter your starting address",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);
    
    try {
      // Extract addresses from selected sales
      const saleAddresses = selectedSales.map(sale => {
        const address = sale.address || 
          (sale.markdown ? extractAddressFromMarkdown(sale.markdown) : null) ||
          'Grand Blanc, MI';
        return address;
      });

      // Include starting address in the optimization
      const allAddresses = [startingAddress, ...saleAddresses];

      console.log('Optimizing route from starting point:', startingAddress);
      console.log('Including estate sale addresses:', saleAddresses);

      // Call the ChatGPT optimization service
      const { data, error } = await supabase.functions.invoke('optimize-route', {
        body: { 
          addresses: allAddresses,
          startingAddress: startingAddress 
        }
      });

      if (error) {
        console.error('Route optimization error:', error);
        toast({
          title: "Route Optimization Failed",
          description: "Please try again or check your addresses",
          variant: "destructive",
        });
      } else if (data?.optimizedRoute) {
        console.log('Optimized route received:', data.optimizedRoute);
        console.log('Google Maps URL received:', data.googleMapsUrl);
        setOptimizedRoute(data.optimizedRoute);
        setGoogleMapsUrl(data.googleMapsUrl || '');
        
        toast({
          title: "Route Optimized!",
          description: "Your estate sales have been ordered for optimal driving",
        });
      }
    } catch (error) {
      console.error('Route optimization error:', error);
      toast({
        title: "Route Optimization Failed",
        description: "Please check your internet connection and try again",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleReset = () => {
    setOptimizedRoute([]);
    setGoogleMapsUrl('');
    setStartingAddress('');
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" />
            Route Optimization
          </DialogTitle>
          <DialogDescription>
            Enter your starting address to get the optimal route for visiting {selectedSales.length} estate sales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Starting Address Input */}
          <div className="space-y-2">
            <Label htmlFor="startingAddress" className="flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              Starting Address
            </Label>
            <Input
              id="startingAddress"
              value={startingAddress}
              onChange={(e) => setStartingAddress(e.target.value)}
              placeholder="Enter your starting address (e.g., 123 Main St, Grand Blanc, MI)"
              disabled={isOptimizing}
              autoComplete="street-address"
            />
          </div>

          {/* Optimize Button */}
          <Button 
            onClick={handleOptimizeRoute}
            disabled={isOptimizing || !startingAddress.trim()}
            className="w-full"
          >
            {isOptimizing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Optimizing Route...
              </>
            ) : (
              <>
                <Route className="w-4 h-4 mr-2" />
                Optimize Route
              </>
            )}
          </Button>

          {/* Optimized Route Display */}
          {optimizedRoute.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  Optimized Route
                </h3>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {optimizedRoute.length} stops
                </Badge>
              </div>

              <div className="space-y-3">
                {optimizedRoute.map((address, index) => {
                  const isStarting = index === 0;
                  const saleIndex = isStarting ? null : selectedSales.findIndex(sale => {
                    const saleAddress = sale.address || 
                      (sale.markdown ? extractAddressFromMarkdown(sale.markdown) : null) ||
                      'Grand Blanc, MI';
                    return saleAddress === address;
                  });
                  
                  const sale = saleIndex !== null && saleIndex >= 0 ? selectedSales[saleIndex] : null;

                  return (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isStarting ? (
                            <>
                              <Navigation className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-green-600">Starting Point</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-4 h-4 text-primary" />
                              <span className="font-medium text-foreground">
                                {sale?.title || 'Estate Sale'}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground break-words">{address}</p>
                        {sale?.date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📅 {sale.date}
                          </p>
                        )}
                        {sale?.status && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {sale.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 pt-4">
                {googleMapsUrl && (
                  <Button 
                    onClick={() => window.open(googleMapsUrl, '_blank')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions in Google Maps
                  </Button>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Try Different Route
                  </Button>
                  <Button 
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};