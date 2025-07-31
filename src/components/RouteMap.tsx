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

  // Calculate optimized route
  const calculateOptimizedRoute = async (coordinates: [number, number][]) => {
    if (coordinates.length < 2) return null;
    
    setIsLoadingRoute(true);
    try {
      // For Mapbox Optimization API, we need at least 2 points
      const waypoints = coordinates.map(coord => coord.join(',')).join(';');
      
      const response = await fetch(
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${waypoints}?access_token=${mapboxToken}&overview=full&steps=true&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.trips && data.trips[0]) {
        const trip = data.trips[0];
        return {
          geometry: trip.geometry,
          distance: (trip.distance / 1609.34).toFixed(1), // Convert to miles
          duration: Math.round(trip.duration / 60), // Convert to minutes
          waypoints: trip.waypoints
        };
      }
      return null;
    } catch (error) {
      console.error('Route calculation error:', error);
      return null;
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    getMapboxToken();
  }, []);

  useEffect(() => {
    if (isLoadingToken || !mapboxToken || !mapContainer.current || selectedSales.length === 0) return;

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

    const initializeMap = async () => {
      if (!map.current) return;
      
      // Geocode all addresses
      const coordinates: [number, number][] = [];
      const markers: mapboxgl.Marker[] = [];
      
      for (let i = 0; i < selectedSales.length; i++) {
        const sale = selectedSales[i];
        if (!sale.address) continue;
        
        const coords = await geocodeAddress(sale.address);
        if (coords) {
          coordinates.push(coords);
          
          // Create custom marker
          const el = document.createElement('div');
          el.className = 'w-8 h-8 bg-vintage-gold rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-lg';
          el.textContent = (i + 1).toString();
          
          const marker = new mapboxgl.Marker(el)
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup().setHTML(
              `<div class="p-2">
                <h3 class="font-semibold text-sm">${sale.title || 'Estate Sale'}</h3>
                <p class="text-xs text-gray-600">${sale.address}</p>
                <p class="text-xs text-gray-500">${sale.date || 'Date TBD'}</p>
              </div>`
            ))
            .addTo(map.current!);
          
          markers.push(marker);
        }
      }
      
      if (coordinates.length > 1) {
        // Calculate and display optimized route
        const routeData = await calculateOptimizedRoute(coordinates);
        
        if (routeData && map.current) {
          // Add route to map
          map.current.on('load', () => {
            if (map.current && routeData.geometry) {
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
                  'line-color': '#D4AF37', // vintage-gold
                  'line-width': 4
                }
              });
            }
          });
          
          // If map is already loaded, add the route immediately
          if (map.current.isStyleLoaded()) {
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
                'line-color': '#D4AF37',
                'line-width': 4
              }
            });
          }
          
          setRouteInfo({
            distance: routeData.distance + ' miles',
            duration: routeData.duration + ' minutes'
          });
          
          // Fit map to show all points
          const bounds = new mapboxgl.LngLatBounds();
          coordinates.forEach(coord => bounds.extend(coord));
          map.current.fitBounds(bounds, { padding: 50 });
        }
      } else if (coordinates.length === 1) {
        // Center on single point
        map.current?.setCenter(coordinates[0]);
        map.current?.setZoom(15);
      }
    };

    initializeMap();

    return () => {
      map.current?.remove();
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