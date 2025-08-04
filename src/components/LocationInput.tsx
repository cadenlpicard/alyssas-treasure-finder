import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationData {
  city: string;
  state: string;
  zipcode: string;
}

interface LocationInputProps {
  onLocationChange: (url: string) => void;
  initialLocation?: LocationData;
}

// Sample locations - in a real app, this would come from an API
const sampleLocations = [
  { city: "New York", state: "NY", zipcode: "10001" },
  { city: "New York", state: "NY", zipcode: "10002" },
  { city: "Los Angeles", state: "CA", zipcode: "90001" },
  { city: "Los Angeles", state: "CA", zipcode: "90002" },
  { city: "Chicago", state: "IL", zipcode: "60601" },
  { city: "Chicago", state: "IL", zipcode: "60602" },
  { city: "Houston", state: "TX", zipcode: "77001" },
  { city: "Houston", state: "TX", zipcode: "77002" },
  { city: "Phoenix", state: "AZ", zipcode: "85001" },
  { city: "Phoenix", state: "AZ", zipcode: "85002" },
  { city: "Philadelphia", state: "PA", zipcode: "19101" },
  { city: "Philadelphia", state: "PA", zipcode: "19102" },
  { city: "San Antonio", state: "TX", zipcode: "78201" },
  { city: "San Antonio", state: "TX", zipcode: "78202" },
  { city: "San Diego", state: "CA", zipcode: "92101" },
  { city: "San Diego", state: "CA", zipcode: "92102" },
  { city: "Dallas", state: "TX", zipcode: "75201" },
  { city: "Dallas", state: "TX", zipcode: "75202" },
];

export const LocationInput = ({ onLocationChange, initialLocation }: LocationInputProps) => {
  const [city, setCity] = useState(initialLocation?.city || "");
  const [state, setState] = useState(initialLocation?.state || "");
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null);
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredLocations = sampleLocations.filter(location => {
    const searchTerm = searchValue.toLowerCase();
    return location.city.toLowerCase().includes(searchTerm) || 
           location.zipcode.includes(searchTerm);
  });

  const generateUrl = (location: LocationData) => {
    return `https://www.estatesales.net/${location.state}/${location.city.replace(/\s+/g, '-')}/${location.zipcode}`;
  };

  useEffect(() => {
    if (selectedLocation) {
      const url = generateUrl(selectedLocation);
      onLocationChange(url);
    }
  }, [selectedLocation, onLocationChange]);

  const handleLocationSelect = (location: LocationData) => {
    setSelectedLocation(location);
    setCity(location.city);
    setState(location.state);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city" className="text-sm font-medium text-foreground">
            City
          </Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Enter city"
            className="h-12 border-2 border-border/50 rounded-xl bg-background/50 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state" className="text-sm font-medium text-foreground">
            State
          </Label>
          <Input
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="State"
            className="h-12 border-2 border-border/50 rounded-xl bg-background/50 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Select Location & Zipcode
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full h-12 justify-between border-2 border-border/50 rounded-xl bg-background/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300"
            >
              {selectedLocation
                ? `${selectedLocation.city}, ${selectedLocation.state} ${selectedLocation.zipcode}`
                : "Search city or zipcode..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-background/95 backdrop-blur-sm border border-border/50">
            <Command>
              <CommandInput 
                placeholder="Search city or zipcode..." 
                value={searchValue}
                onValueChange={setSearchValue}
                className="border-0"
              />
              <CommandList>
                <CommandEmpty>No locations found.</CommandEmpty>
                <CommandGroup>
                  {filteredLocations.map((location) => (
                    <CommandItem
                      key={`${location.city}-${location.zipcode}`}
                      value={`${location.city} ${location.zipcode}`}
                      onSelect={() => handleLocationSelect(location)}
                      className="cursor-pointer hover:bg-accent/50"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedLocation?.zipcode === location.zipcode
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{location.city}, {location.state}</span>
                        <span className="text-sm text-muted-foreground">{location.zipcode}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedLocation && (
        <div className="p-3 bg-accent/30 rounded-lg border border-border/30">
          <p className="text-sm text-muted-foreground mb-1">Generated URL:</p>
          <p className="text-sm font-mono text-foreground break-all">
            {generateUrl(selectedLocation)}
          </p>
        </div>
      )}
    </div>
  );
};