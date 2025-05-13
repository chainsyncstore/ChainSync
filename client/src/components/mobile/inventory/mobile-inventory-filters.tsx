import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

interface MobileInventoryFiltersProps {
  categories: any[];
  stores: any[];
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  storeFilter: string;
  setStoreFilter: (value: string) => void;
  stockFilter: string;
  setStockFilter: (value: string) => void;
  resetFilters: () => void;
  closeFilters: () => void;
}

export function MobileInventoryFilters({
  categories,
  stores,
  categoryFilter,
  setCategoryFilter,
  storeFilter,
  setStoreFilter,
  stockFilter,
  setStockFilter,
  resetFilters,
  closeFilters
}: MobileInventoryFiltersProps) {
  return (
    <div className="py-4 h-full flex flex-col">
      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Store</Label>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id.toString()}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Stock Level</Label>
          <RadioGroup value={stockFilter} onValueChange={setStockFilter} className="mt-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">All</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="in_stock" id="in_stock" />
              <Label htmlFor="in_stock">In Stock</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="low_stock" id="low_stock" />
              <Label htmlFor="low_stock">Low Stock</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="out_of_stock" id="out_of_stock" />
              <Label htmlFor="out_of_stock">Out of Stock</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="pt-6 border-t space-x-2 flex justify-between">
        <Button variant="outline" onClick={resetFilters}>
          Reset Filters
        </Button>
        <Button onClick={() => {
          closeFilters();
        }}>
          Apply Filters
        </Button>
      </div>
    </div>
  );
}