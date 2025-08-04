import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, Route, X } from 'lucide-react';

interface EstateSale {
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  company: string;
  date: string;
  time: string;
  distance: string;
  status: string;
  featured: string;
  url: string;
  imageUrl: string;
  description: string;
}

interface MapViewProps {
  sales: EstateSale[];
  selectedSales?: string[];
  onSaleSelection?: (saleTitle: string, selected: boolean) => void;
  onPlanRoute?: () => void;
}

export const MapView = ({ sales, selectedSales = [], onSaleSelection, onPlanRoute }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState('');
  const [selectedSale, setSelectedSale] = useState<EstateSale | null>(null);
  const [coordinates, setCoordinates] = useState<{ [key: string]: [number, number] }>({});
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Get Mapbox token
  useEffect(() => {
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

    getMapboxToken();
  }, []);

  // Geocode addresses to get coordinates
  useEffect(() => {
    const geocodeAddresses = async () => {
      if (!mapboxToken || !sales.length) return;

      const coords: { [key: string]: [number, number] } = {};
      
      for (const sale of sales) {
        if (!sale.address) continue;
        
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(sale.address)}.json?` +
            `access_token=${mapboxToken}&` +
            `country=us&` +
            `limit=1`
          );
          
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            coords[sale.title] = [lng, lat];
          }
        } catch (error) {
          console.error('Error geocoding address:', sale.address, error);
        }
      }
      
      setCoordinates(coords);
    };

    geocodeAddresses();
  }, [mapboxToken, sales]);

  // Initialize map (only once)
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !Object.keys(coordinates).length || mapInitialized) return;

    mapboxgl.accessToken = mapboxToken;
    
    // Calculate center from all coordinates
    const coords = Object.values(coordinates);
    const avgLng = coords.reduce((sum, [lng]) => sum + lng, 0) / coords.length;
    const avgLat = coords.reduce((sum, [, lat]) => sum + lat, 0) / coords.length;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [avgLng, avgLat],
      zoom: 10
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    map.current.on('load', () => {
      setMapInitialized(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapInitialized(false);
      }
    };
  }, [mapboxToken, coordinates, mapInitialized]);

  // Update markers when sales or selections change (without reinitializing map)
  useEffect(() => {
    if (!map.current || !mapInitialized || !Object.keys(coordinates).length) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    sales.forEach((sale) => {
      const coord = coordinates[sale.title];
      if (!coord) return;

      const isSelected = selectedSales.includes(sale.title);

      // Create marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'estate-sale-marker';
      markerEl.style.cssText = `
        width: 40px;
        height: 40px;
        background: ${isSelected 
          ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary))/0.8)' 
          : 'linear-gradient(135deg, hsl(var(--muted-foreground)), hsl(var(--muted-foreground))/0.8)'};
        border: 3px solid ${isSelected ? 'hsl(var(--primary))' : 'white'};
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      `;

      const iconEl = document.createElement('div');
      iconEl.innerHTML = '💰';
      iconEl.style.fontSize = '16px';
      markerEl.appendChild(iconEl);

      // Add hover effect and show details on hover with improved flickering prevention
      markerEl.addEventListener('mouseenter', () => {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        markerEl.style.filter = 'brightness(1.1)';
        markerEl.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        setSelectedSale(sale);
      });
      
      // Use a longer delay and only hide if mouse is truly away from both marker and popup
      markerEl.addEventListener('mouseleave', () => {
        markerEl.style.filter = 'brightness(1)';
        markerEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        hideTimeoutRef.current = setTimeout(() => {
          setSelectedSale(null);
        }, 300);
      });

      // Add click handler for selection
      markerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onSaleSelection) {
          onSaleSelection(sale.title, !isSelected);
        }
      });

      // Create marker and add to map
      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat(coord)
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  }, [sales, selectedSales, coordinates, mapInitialized, onSaleSelection]);

  if (!mapboxToken) {
    return (
      <div className="h-96 flex items-center justify-center bg-muted/20 rounded-lg">
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-96 w-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
      
      {/* Selected sale popup */}
      {selectedSale && (
        <div 
          className="absolute top-4 left-4 right-4 z-10 max-w-sm"
          onMouseEnter={() => {
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current);
              hideTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            hideTimeoutRef.current = setTimeout(() => {
              setSelectedSale(null);
            }, 300);
          }}
        >
          <Card className="p-4 bg-background/95 backdrop-blur-sm border shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-sm text-foreground line-clamp-2">
                {selectedSale.title}
              </h3>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            
            {selectedSale.imageUrl && (
              <div className="w-full h-20 mb-2 rounded overflow-hidden">
                <img
                  src={selectedSale.imageUrl}
                  alt={selectedSale.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="space-y-1 text-xs">
              <p className="text-muted-foreground">{selectedSale.address}</p>
              {selectedSale.date && (
                <p className="text-foreground font-medium">{selectedSale.date}</p>
              )}
              {selectedSale.time && (
                <p className="text-muted-foreground">{selectedSale.time}</p>
              )}
              {selectedSale.company && (
                <p className="text-muted-foreground">by {selectedSale.company}</p>
              )}
              
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedSale.status && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedSale.status}
                  </Badge>
                )}
                {selectedSale.featured && (
                  <Badge variant="outline" className="text-xs">
                    {selectedSale.featured} Featured
                  </Badge>
                )}
              </div>
              
              {selectedSale.url && (
                <a
                  href={selectedSale.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors text-xs mt-2"
                >
                  View Details <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </Card>
        </div>
      )}
      
      {/* Route planning controls */}
      {selectedSales.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Card className="p-3 bg-background/95 backdrop-blur-sm border shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedSales.length} sale{selectedSales.length > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {onPlanRoute && selectedSales.length >= 2 && (
                  <Button
                    onClick={onPlanRoute}
                    size="sm"
                    className="text-xs"
                  >
                    Plan Route
                  </Button>
                )}
                <Button
                  onClick={() => {
                    selectedSales.forEach(saleTitle => {
                      if (onSaleSelection) {
                        onSaleSelection(saleTitle, false);
                      }
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Instructions */}
      {selectedSales.length === 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Card className="p-3 bg-background/95 backdrop-blur-sm border shadow-lg">
            <p className="text-xs text-muted-foreground text-center">
              Click on treasure boxes to select sales for route planning
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};