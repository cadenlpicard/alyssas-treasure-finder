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
    if (!query.trim() || query.length < 3 || !mapboxToken) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxToken}&` +
        `country=us&` +
        `types=place,postcode,region&` +
        `autocomplete=true&` +
        `limit=8`
      );
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const locationSuggestions: LocationSuggestion[] = data.features.map((feature: any) => ({
          place_name: feature.place_name,
          text: feature.text,
          center: feature.center,
          context: feature.context || []
        }));
        setSuggestions(locationSuggestions);
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

  // Fetch default zipcode for a city if none is provided
  const fetchDefaultZipcode = async (city: string, state: string): Promise<string> => {
    if (!mapboxToken) return '';
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city + ', ' + state)}.json?` +
        `access_token=${mapboxToken}&` +
        `country=us&` +
        `types=postcode&` +
        `limit=1`
      );
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return data.features[0].text || '';
      }
    } catch (error) {
      console.error('Error fetching default zipcode:', error);
    }
    
    return '';
  };

  // Parse location data from Mapbox suggestion
  const parseLocationFromSuggestion = async (suggestion: LocationSuggestion): Promise<LocationData> => {
    const { place_name, context } = suggestion;
    
    // Extract state and zipcode from context
    let state = '';
    let zipcode = '';
    let city = suggestion.text;
    
    if (context) {
      context.forEach(item => {
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
    
    // If no zipcode found, try to extract from place_name
    if (!zipcode) {
      const zipcodeMatch = place_name.match(/\b(\d{5})\b/);
      if (zipcodeMatch) {
        zipcode = zipcodeMatch[1];
      }
    }
    
    // If still no zipcode and we have city and state, fetch a default one
    if (!zipcode && city && state) {
      zipcode = await fetchDefaultZipcode(city, state);
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

  useEffect(() => {
    if (selectedLocation) {
      const url = generateUrl(selectedLocation);
      onLocationChange(url);
    }
  }, [selectedLocation, onLocationChange]);

  const handleLocationSelect = async (suggestion: LocationSuggestion) => {
    const location = await parseLocationFromSuggestion(suggestion);
    setSelectedLocation(location);
    setSearchValue(suggestion.place_name);
    setShowSuggestions(false);
    setSuggestions([]);
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
        <div className="relative">
          <Input
            value={searchValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Search any city or zipcode..."
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
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleLocationSelect(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-accent/50 flex items-center gap-3 border-b border-border/30 last:border-b-0 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {suggestion.text}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">
                      {suggestion.place_name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* No results message */}
          {showSuggestions && suggestions.length === 0 && searchValue.length > 2 && !isLoading && (
            <div className="absolute z-50 w-full mt-1 bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg p-4">
              <p className="text-sm text-muted-foreground">No locations found. Try a different search term.</p>
            </div>
          )}
        </div>
      </div>

      {selectedLocation && (
        <div className="p-3 bg-accent/30 rounded-lg border border-border/30">
          <p className="text-sm text-muted-foreground mb-1">Selected Location:</p>
          <p className="text-sm font-medium text-foreground">
            {selectedLocation.city}, {selectedLocation.state} {selectedLocation.zipcode}
          </p>
          <p className="text-sm text-muted-foreground mb-2">Generated URL:</p>
          <p className="text-sm font-mono text-foreground break-all">
            {generateUrl(selectedLocation)}
          </p>
        </div>
      )}
      
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