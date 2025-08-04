import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, Square, Sparkles } from 'lucide-react';

interface AuctionType {
  id: string;
  label: string;
  category: string;
}

const auctionTypes: AuctionType[] = [
  // Estate Sales
  { id: 'estate-sales', label: 'Estate Sales', category: 'Estate Sales' },
  { id: 'moving-sales', label: 'Moving Sales', category: 'Estate Sales' },
  { id: 'moved-offsite-warehouse', label: 'Moved Offsite To Warehouse', category: 'Estate Sales' },
  { id: 'by-appointment', label: 'By Appointment', category: 'Estate Sales' },
  { id: 'online-estate-sales', label: 'Online Estate Sales', category: 'Estate Sales' },
  
  // Auctions
  { id: 'auctions', label: 'Auctions', category: 'Auctions' },
  { id: 'auction-house', label: 'Auction House', category: 'Auctions' },
  { id: 'online-only-auctions', label: 'Online Only Auctions', category: 'Auctions' },
  
  // Additional Liquidations
  { id: 'business-closings', label: 'Business Closings', category: 'Additional Liquidations' },
  { id: 'moved-offsite-store', label: 'Moved Offsite To Store', category: 'Additional Liquidations' },
  { id: 'outside-sales', label: 'Outside Sales', category: 'Additional Liquidations' },
  { id: 'single-item-collections', label: 'Single Item Type Collections', category: 'Additional Liquidations' },
  { id: 'buyouts-cleanouts', label: 'Buyouts Or Cleanouts', category: 'Additional Liquidations' },
  { id: 'demolition-sales', label: 'Demolition Sales', category: 'Additional Liquidations' },
];

interface AuctionTypeFilterProps {
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
}

export const AuctionTypeFilter = ({ selectedTypes, onTypesChange }: AuctionTypeFilterProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const categories = Array.from(new Set(auctionTypes.map(type => type.category)));
  
  const handleTypeToggle = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onTypesChange(selectedTypes.filter(id => id !== typeId));
    } else {
      onTypesChange([...selectedTypes, typeId]);
    }
  };
  
  const handleSelectAll = () => {
    if (selectedTypes.length === auctionTypes.length) {
      onTypesChange([]);
    } else {
      onTypesChange(auctionTypes.map(type => type.id));
    }
  };
  
  const handleCategoryToggle = (category: string) => {
    const categoryTypes = auctionTypes.filter(type => type.category === category);
    const allCategorySelected = categoryTypes.every(type => selectedTypes.includes(type.id));
    
    if (allCategorySelected) {
      // Deselect all in category
      const remainingTypes = selectedTypes.filter(typeId => 
        !categoryTypes.some(type => type.id === typeId)
      );
      onTypesChange(remainingTypes);
    } else {
      // Select all in category
      const newTypes = [...selectedTypes];
      categoryTypes.forEach(type => {
        if (!newTypes.includes(type.id)) {
          newTypes.push(type.id);
        }
      });
      onTypesChange(newTypes);
    }
  };

  if (!isExpanded) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-lg font-medium text-foreground flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            Sale Types
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(true)}
          >
            Filter ({selectedTypes.length}/{auctionTypes.length})
          </Button>
        </div>
        {selectedTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedTypes.slice(0, 3).map(typeId => {
              const type = auctionTypes.find(t => t.id === typeId);
              return type ? (
                <Badge key={typeId} variant="secondary" className="text-xs">
                  {type.label}
                </Badge>
              ) : null;
            })}
            {selectedTypes.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{selectedTypes.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Sale Types
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedTypes.length === auctionTypes.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
            >
              Collapse
            </Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Choose the types of sales and auctions you want to find
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.map(category => {
          const categoryTypes = auctionTypes.filter(type => type.category === category);
          const allCategorySelected = categoryTypes.every(type => selectedTypes.includes(type.id));
          const someCategorySelected = categoryTypes.some(type => selectedTypes.includes(type.id));
          
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                >
                  {allCategorySelected ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : someCategorySelected ? (
                    <div className="w-4 h-4 border-2 border-primary bg-primary/20 rounded-sm flex items-center justify-center">
                      <div className="w-2 h-2 bg-primary rounded-sm" />
                    </div>
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {category}
                </button>
                <Badge variant="outline" className="text-xs">
                  {categoryTypes.filter(type => selectedTypes.includes(type.id)).length}/{categoryTypes.length}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-6">
                {categoryTypes.map(type => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={type.id}
                      checked={selectedTypes.includes(type.id)}
                      onCheckedChange={() => handleTypeToggle(type.id)}
                    />
                    <label
                      htmlFor={type.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};