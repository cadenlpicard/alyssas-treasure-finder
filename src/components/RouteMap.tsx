import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Route, Clock, Navigation } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
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
}

interface RouteMapProps {
  selectedSales: EstateSale[];
  onClose: () => void;
}

export const RouteMap = ({ selectedSales, onClose }: RouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);
  const { toast } = useToast();

  // Get Mapbox token from Supabase edge function
  const getMapboxToken = async () => {
    try {
      setIsLoadingToken(true);
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      
      if (error) {
        console.error('Error getting Mapbox token:', error);
        toast({
          title: "Error",
          description: "Failed to get Mapbox token from server",
          variant: "destructive",
        });
        return;
      }
      
      if (data?.token) {
        setMapboxToken(data.token);
      }
    } catch (error) {
      console.error('Error fetching Mapbox token:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Mapbox token",
        variant: "destructive",
      });
    } finally {
      setIsLoadingToken(false);
    }
  };

  // Geocoding function to convert addresses to coordinates
  const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&country=us&proximity=-83.6129,42.9270`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return data.features[0].center;
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Calculate optimized route using Mapbox Optimization API (TSP solver)
  const calculateOptimizedRoute = async (coordinates: [number, number][]) => {
    if (coordinates.length < 2) return null;
    
    setIsLoadingRoute(true);
    try {
      // Use driving-traffic profile for real-time traffic awareness
      const waypoints = coordinates.map(coord => coord.join(',')).join(';');
      
      const response = await fetch(
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${waypoints}?` +
        `access_token=${mapboxToken}&` +
        `overview=full&` +
        `steps=true&` +
        `geometries=geojson&` +
        `annotations=distance,duration&` +
        `source=first&` +  // Start from first coordinate
        `destination=last`  // End at last coordinate (return to start)
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Optimization API error:', errorData);
        throw new Error(errorData.message || 'Failed to calculate route');
      }
      
      const data = await response.json();
      
      if (data.trips && data.trips[0]) {
        const trip = data.trips[0];
        return {
          geometry: trip.geometry,
          distance: (trip.distance / 1609.34).toFixed(1), // Convert to miles
          duration: Math.round(trip.duration / 60), // Convert to minutes
          waypoints: trip.waypoints,
          legs: trip.legs || []
        };
      }
      return null;
    } catch (error) {
      console.error('Route calculation error:', error);
      toast({
        title: "Route Error",
        description: "Failed to calculate optimal route. Showing direct connections instead.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    getMapboxToken();
  }, []);

  useEffect(() => {
    if (isLoadingToken || !mapboxToken || !mapContainer.current || selectedSales.length === 0) {
      console.log('Map initialization blocked:', { isLoadingToken, hasToken: !!mapboxToken, hasContainer: !!mapContainer.current, salesCount: selectedSales.length });
      return;
    }

    // Clean up previous map safely
    if (map.current) {
      try {
        map.current.remove();
      } catch (error) {
        console.warn('Error removing previous map:', error);
      }
      map.current = null;
    }

    // Initialize map
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-83.6129, 42.9270], // Grand Blanc, MI
      zoom: 11,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const extractAddressFromMarkdown = (sale: EstateSale): string | null => {
      // First try the parsed address field from FirecrawlService
      if (sale.address && sale.address.trim()) {
        console.log('Using parsed address:', sale.address);
        return sale.address.trim();
      }
      
      // Then try to extract address from markdown
      if (sale.markdown) {
        console.log('Extracting address from markdown:', sale.markdown.substring(0, 300));
        
        // The markdown uses \\\\ as separators, so we need to handle this format
        // Pattern for estatesales.net format: street\\\\\n\\\\\ncity, state zip
        const estatesNetPattern = /(\d+\s+[^\\]+(?:drive|dr\.?|road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|court|ct\.?|boulevard|blvd\.?|circle|cir\.?|way|place|pl\.?))\s*\\{4,}\s*\\{4,}\s*([^\\,\n]+),?\s*(MI|Michigan)\s*(\d{5})?/i;
        const estatesNetMatch = sale.markdown.match(estatesNetPattern);
        
        if (estatesNetMatch) {
          const streetAddress = estatesNetMatch[1].trim();
          const city = estatesNetMatch[2] ? estatesNetMatch[2].trim() : '';
          const state = estatesNetMatch[3] || 'MI';
          const zip = estatesNetMatch[4] || '';
          
          let fullAddress = streetAddress;
          if (city) {
            fullAddress += `, ${city}`;
          }
          fullAddress += `, ${state}`;
          if (zip) {
            fullAddress += ` ${zip}`;
          }
          
          console.log('Extracted address from estates.net format:', fullAddress);
          return fullAddress;
        }
        
        // Fallback patterns for other formats
        const patterns = [
          // Pattern 1: Street number + street name + city, state zip
          /(\d+\s+[^,\n]+(?:drive|dr\.?|road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|court|ct\.?|boulevard|blvd\.?|circle|cir\.?|way|place|pl\.?))\s*[,\n]\s*([^,\n]+),?\s*(MI|Michigan)\s*(\d{5})?/i,
          
          // Pattern 2: Just street address followed by city on next line
          /(\d+\s+[^,\n]+(?:drive|dr\.?|road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|court|ct\.?|boulevard|blvd\.?|circle|cir\.?|way|place|pl\.?))[,\s]*\n[^\n]*([A-Z][a-z\s]+),?\s*(MI|Michigan)\s*(\d{5})?/i,
        ];
        
        for (const pattern of patterns) {
          const match = sale.markdown.match(pattern);
          if (match) {
            const streetAddress = match[1].trim();
            const city = match[2] ? match[2].trim() : '';
            const state = match[3] || 'MI';
            const zip = match[4] || '';
            
            let fullAddress = streetAddress;
            if (city) {
              fullAddress += `, ${city}`;
            }
            fullAddress += `, ${state}`;
            if (zip) {
              fullAddress += ` ${zip}`;
            }
            
            console.log('Extracted address from fallback pattern:', fullAddress);
            return fullAddress;
          }
        }
        
        // Fallback: look for any address-like pattern with Michigan cities
        const michiganCities = ['Grand Blanc', 'Burton', 'Davison', 'Lapeer', 'Metamora', 'West Bloomfield', 'North Branch', 'Brighton', 'Imlay City', 'Vassar', 'Flint', 'Durand'];
        for (const city of michiganCities) {
          const cityPattern = new RegExp(`(\\d+\\s+[^,\\n\\\\]+(?:drive|dr\\.?|road|rd\\.?|street|st\\.?|avenue|ave\\.?|lane|ln\\.?|court|ct\\.?|boulevard|blvd\\.?|circle|cir\\.?|way|place|pl\\.?))[^\\n]*${city}`, 'i');
          const match = sale.markdown.match(cityPattern);
          if (match) {
            const fullAddress = `${match[1].trim()}, ${city}, MI`;
            console.log('Extracted address with MI city fallback:', fullAddress);
            return fullAddress;
          }
        }
        
        console.log('No address pattern matched for sale:', sale.title);
      }
      
      return null;
    };

    const initializeMap = async () => {
      if (!map.current) return;
      
      console.log('Initializing map with', selectedSales.length, 'estate sales');
      console.log('Selected sales data:', selectedSales);
      
      // Geocode all addresses
      const coordinates: [number, number][] = [];
      const markers: mapboxgl.Marker[] = [];
      const validSales: EstateSale[] = [];
      
      for (let i = 0; i < selectedSales.length; i++) {
        const sale = selectedSales[i];
        const extractedAddress = extractAddressFromMarkdown(sale);
        
        console.log('Processing sale:', sale.title);
        console.log('Original address:', sale.address);
        console.log('Extracted address:', extractedAddress);
        console.log('Markdown sample:', sale.markdown?.substring(0, 200));
        
        if (!extractedAddress) {
          console.warn('Skipping sale without valid address:', sale.title);
          continue;
        }
        
        const coords = await geocodeAddress(extractedAddress);
        console.log('Geocoded coordinates for', extractedAddress, ':', coords);
        
        if (coords) {
          coordinates.push(coords);
          validSales.push(sale);
          
          // Create custom marker
          const el = document.createElement('div');
          el.className = 'w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm border-2 border-background shadow-lg cursor-pointer';
          el.textContent = (coordinates.length + 1).toString();
          
          const marker = new mapboxgl.Marker(el)
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div class="p-3 max-w-xs">
                <h3 class="font-semibold text-sm mb-1">${sale.title || 'Estate Sale'}</h3>
                <p class="text-xs text-gray-600 mb-1">${extractedAddress}</p>
                <p class="text-xs text-gray-500 mb-1">${sale.date || 'Date TBD'}</p>
                ${sale.company ? `<p class="text-xs text-blue-600">${sale.company}</p>` : ''}
              </div>`
            ))
            .addTo(map.current!);
          
          markers.push(marker);
        } else {
          console.warn('Failed to geocode address:', extractedAddress);
        }
      }
      
      console.log('Found', coordinates.length, 'valid coordinates');
      
      if (coordinates.length > 1) {
        console.log('Calculating optimized route for', coordinates.length, 'points');
        // Calculate and display optimized route
        const routeData = await calculateOptimizedRoute(coordinates);
        
        if (routeData && map.current) {
          console.log('Route calculated successfully:', routeData);
          
          const addRouteToMap = () => {
            if (!map.current || !routeData.geometry) return;
            
            // Remove existing route if it exists
            if (map.current.getLayer('route')) {
              map.current.removeLayer('route');
            }
            if (map.current.getSource('route')) {
              map.current.removeSource('route');
            }
            
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: routeData.geometry
              }
            });
            
            map.current.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': 'hsl(var(--primary))',
                'line-width': 4,
                'line-opacity': 0.8
              }
            });
          };
          
          // Add route to map when style is loaded
          if (map.current.isStyleLoaded()) {
            addRouteToMap();
          } else {
            map.current.on('load', addRouteToMap);
          }
          
          setRouteInfo({
            distance: routeData.distance + ' miles',
            duration: routeData.duration + ' minutes'
          });
        } else {
          console.error('Failed to calculate route');
        }
      } else if (coordinates.length === 1) {
        console.log('Centering on single point');
        map.current?.setCenter(coordinates[0]);
        map.current?.setZoom(15);
      }
      
      // Fit map to show all points with padding
      if (coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        map.current?.fitBounds(bounds, { 
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 15
        });
      }
    };

    // Wait for map to be ready before initializing
    if (map.current.isStyleLoaded()) {
      initializeMap();
    } else {
      map.current.on('load', initializeMap);
    }

    return () => {
      if (map.current) {
        try {
          map.current.remove();
        } catch (error) {
          console.warn('Error cleaning up map:', error);
        }
        map.current = null;
      }
    };
  }, [isLoadingToken, selectedSales, mapboxToken]);

  if (isLoadingToken) {
    return (
      <div className="w-full max-w-md mx-auto p-8 text-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Route className="w-5 h-5 text-vintage-gold" />
          Route Planner ({selectedSales.length} sales)
        </h3>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      
      {routeInfo && (
        <div className="flex gap-4">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            {routeInfo.distance}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {routeInfo.duration}
          </Badge>
        </div>
      )}
      
      {isLoadingRoute && (
        <div className="text-sm text-muted-foreground">
          Calculating optimal route...
        </div>
      )}
      
      <div 
        ref={mapContainer} 
        className="w-full h-96 rounded-lg border border-border shadow-lg"
        style={{ minHeight: '400px' }}
      />
      
      <div className="text-xs text-muted-foreground">
        Click markers to see estate sale details. Route is optimized for shortest travel time.
      </div>
    </div>
  );
};