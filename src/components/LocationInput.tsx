import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/integrations/supabase/client';

interface LocationData {
  city: string;
  state: string;
  zipcode: string;
  full_address?: string;
}

interface LocationSuggestion {
  place_name: string;
  text: string;
  center: [number, number];
  context: Array<{ id: string; text: string }>;
}

interface LocationInputProps {
  onLocationChange: (url: string) => void;
  initialLocation?: LocationData;
}

export const LocationInput = ({ onLocationChange, initialLocation }: LocationInputProps) => {
  const [searchValue, setSearchValue] = useState(initialLocation ? `${initialLocation.city}, ${initialLocation.state} ${initialLocation.zipcode}` : "");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null);
  const { toast } = useToast();

  // Get Mapbox token from Supabase edge function
  const getMapboxToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      
      if (error) {
        console.error('Error getting Mapbox token:', error);
        return;
      }
      
      if (data?.token) {
        setMapboxToken(data.token);
      }
    } catch (error) {
      console.error('Error fetching Mapbox token:', error);
    }
  };

  useEffect(() => {
    getMapboxToken();
  }, []);

  // Fetch location suggestions from Mapbox
  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 2 || !mapboxToken) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Check if it's a zipcode (5 digits)
    const isZipcode = /^\d{5}$/.test(query.trim());
    
    if (isZipcode) {
      // Direct zipcode search
      try {
        setIsLoading(true);
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?` +
          `access_token=${mapboxToken}&` +
          `country=us&` +
          `types=postcode&` +
          `limit=1`
        );
        
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const suggestion: LocationSuggestion = {
            place_name: feature.place_name,
            text: feature.text,
            center: feature.center,
            context: feature.context || []
          };
          setSuggestions([suggestion]);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
        setIsLoading(false);
        return;
      } catch (error) {
        console.error('Error fetching zipcode:', error);
        setIsLoading(false);
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
    }

    setIsLoading(true);
    try {
      let allSuggestions: LocationSuggestion[] = [];
      
      // Search for places and then reverse geocode to get zipcode
      const placeResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxToken}&` +
        `country=us&` +
        `types=place&` +
        `autocomplete=true&` +
        `limit=5`
      );
      
      const placeData = await placeResponse.json();
      if (placeData.features && placeData.features.length > 0) {
        // For each place, try to get zipcode via reverse geocoding
        const placePromises = placeData.features.map(async (feature: any) => {
          try {
            const reverseResponse = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${feature.center[0]},${feature.center[1]}.json?` +
              `access_token=${mapboxToken}&` +
              `types=postcode&` +
              `limit=1`
            );
            const reverseData = await reverseResponse.json();
            
            // Combine original place info with zipcode from reverse geocoding
            let enhancedContext = feature.context || [];
            if (reverseData.features && reverseData.features.length > 0) {
              const zipcodeFeature = reverseData.features[0];
              enhancedContext = [...enhancedContext, {
                id: 'postcode.' + zipcodeFeature.text,
                text: zipcodeFeature.text
              }];
            }
            
            return {
              place_name: feature.place_name,
              text: feature.text,
              center: feature.center,
              context: enhancedContext
            };
          } catch (error) {
            // Return original feature if reverse geocoding fails
            return {
              place_name: feature.place_name,
              text: feature.text,
              center: feature.center,
              context: feature.context || []
            };
          }
        });
        
        const enhancedPlaces = await Promise.all(placePromises);
        allSuggestions = [...allSuggestions, ...enhancedPlaces];
      }
      
      if (allSuggestions.length > 0) {
        // Filter to only include cities/places with zipcodes (no street addresses)
        const citiesWithZipcodes = allSuggestions.filter(suggestion => {
          const hasZipcode = suggestion.context?.some(item => item.id.startsWith('postcode.')) || /\b\d{5}\b/.test(suggestion.place_name);
          const isCity = suggestion.context?.some(item => item.id.startsWith('place.')) || !suggestion.context?.some(item => item.id.startsWith('address.'));
          return hasZipcode && isCity;
        });
        
        // Remove duplicates and sort by zipcode availability
        const uniqueSuggestions = citiesWithZipcodes.filter((suggestion, index, self) => 
          index === self.findIndex(s => s.place_name === suggestion.place_name)
        );
        
        setSuggestions(uniqueSuggestions.slice(0, 8));
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };
  const parseLocationFromSuggestion = async (suggestion: LocationSuggestion): Promise<LocationData> => {
    const { place_name, context } = suggestion;
    
    // Extract state, city, and zipcode from context
    let state = '';
    let zipcode = '';
    let city = '';
    
    if (context) {
      context.forEach(item => {
        if (item.id.startsWith('place.')) {
          // Extract city name from place context
          city = item.text;
        }
        if (item.id.startsWith('region.')) {
          // Extract state abbreviation (e.g., "Michigan" -> "MI")
          const stateMatch = item.text.match(/\b([A-Z]{2})\b/);
          if (stateMatch) {
            state = stateMatch[1];
          } else {
            // Handle full state names - simplified mapping
            const stateMap: { [key: string]: string } = {
              'Michigan': 'MI', 'California': 'CA', 'Texas': 'TX', 'New York': 'NY',
              'Florida': 'FL', 'Illinois': 'IL', 'Pennsylvania': 'PA', 'Ohio': 'OH',
              'Georgia': 'GA', 'North Carolina': 'NC', 'New Jersey': 'NJ', 'Virginia': 'VA',
              'Washington': 'WA', 'Arizona': 'AZ', 'Massachusetts': 'MA', 'Tennessee': 'TN',
              'Indiana': 'IN', 'Missouri': 'MO', 'Maryland': 'MD', 'Wisconsin': 'WI'
            };
            state = stateMap[item.text] || item.text.substring(0, 2).toUpperCase();
          }
        }
        if (item.id.startsWith('postcode.')) {
          zipcode = item.text;
        }
      });
    }
    
    // If no city found in context, fall back to suggestion.text (for city/place results)
    if (!city) {
      city = suggestion.text;
    }
    
    // If no zipcode found, try to extract from place_name
    if (!zipcode) {
      const zipcodeMatch = place_name.match(/\b(\d{5})\b/);
      if (zipcodeMatch) {
        zipcode = zipcodeMatch[1];
      }
    }
    
    // Throw error if no zipcode is available
    if (!zipcode) {
      throw new Error('No zipcode found for this location. Please select a location with a zipcode.');
    }
    
    return {
      city,
      state,
      zipcode,
      full_address: place_name
    };
  };

  const generateUrl = (location: LocationData) => {
    if (!location.zipcode) {
      // Fallback to city/state if no zipcode
      return `https://www.estatesales.net/${location.state}/${location.city.replace(/\s+/g, '-')}`;
    }
    return `https://www.estatesales.net/${location.state}/${location.city.replace(/\s+/g, '-')}/${location.zipcode}`;
  };

  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            
            // Reverse geocode to get location details
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
              `access_token=${mapboxToken}&` +
              `types=place,postcode&` +
              `limit=1`
            );
            
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              const feature = data.features[0];
              const suggestion: LocationSuggestion = {
                place_name: feature.place_name,
                text: feature.text,
                center: feature.center,
                context: feature.context || []
              };
              
              await handleLocationSelect(suggestion);
              toast({
                title: "Location Found",
                description: `Set location to ${feature.place_name}`,
              });
            } else {
              throw new Error("No location data found");
            }
          } catch (error) {
            toast({
              title: "Location Error",
              description: "Could not determine your location. Please search manually.",
              variant: "destructive",
            });
          } finally {
            setIsLoading(false);
          }
        },
        (error) => {
          setIsLoading(false);
          toast({
            title: "Location Access Denied",
            description: "Please allow location access or search manually.",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      const url = generateUrl(selectedLocation);
      onLocationChange(url);
    }
  }, [selectedLocation, onLocationChange]);

  const handleLocationSelect = async (suggestion: LocationSuggestion) => {
    try {
      const location = await parseLocationFromSuggestion(suggestion);
      setSelectedLocation(location);
      setSearchValue(suggestion.place_name);
      setShowSuggestions(false);
      setSuggestions([]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to select location",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (value: string) => {
    setSearchValue(value);
    
    // Clear selected location if input is changed
    if (selectedLocation && value !== selectedLocation.full_address) {
      setSelectedLocation(null);
    }
    
    // Debounce the search
    setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Select Location & Zipcode
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
          value={searchValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Search city, zipcode only (e.g. 48348)..."
              className="h-12 border-2 border-border/50 rounded-xl bg-background/50 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300"
              disabled={!mapboxToken}
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, index) => {
                  const hasZipcode = suggestion.context?.some(item => item.id.startsWith('postcode.')) || /\b\d{5}\b/.test(suggestion.place_name);
                  const zipcode = suggestion.context?.find(item => item.id.startsWith('postcode.'))?.text || suggestion.place_name.match(/\b(\d{5})\b/)?.[1];
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleLocationSelect(suggestion)}
                      className={`w-full px-4 py-3 text-left hover:bg-accent/50 flex items-center gap-3 border-b border-border/30 last:border-b-0 transition-colors ${hasZipcode ? 'bg-green-50 dark:bg-green-950/20' : 'opacity-60'}`}
                    >
                      <MapPin className={`w-4 h-4 flex-shrink-0 ${hasZipcode ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground truncate">
                            {suggestion.text}
                          </span>
                          {hasZipcode && zipcode && (
                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                              {zipcode}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground truncate">
                          {suggestion.place_name}
                        </span>
                        {!hasZipcode && (
                          <span className="text-xs text-red-600 dark:text-red-400">
                            No zipcode available
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* No results message */}
            {showSuggestions && suggestions.length === 0 && searchValue.length > 2 && !isLoading && (
              <div className="absolute z-50 w-full mt-1 bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg p-4">
                <p className="text-sm text-muted-foreground">No locations found. Try a different search term.</p>
              </div>
            )}
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleLocateMe}
            disabled={!mapboxToken || isLoading}
            className="h-12 w-12 rounded-xl border-2 border-border/50 hover:border-primary/50 transition-all duration-300"
            title="Use my current location"
          >
            <MapPin className="w-5 h-5" />
          </Button>
        </div>
      </div>

      
      {!mapboxToken && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Loading location services...
          </p>
        </div>
      )}
    </div>
  );
};