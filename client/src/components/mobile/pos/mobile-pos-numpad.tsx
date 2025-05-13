import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, X, Delete, CornerDownLeft } from 'lucide-react';

interface MobilePosNumpadProps {
  addToCart: (product: any) => void;
  storeId: string;
}

export function MobilePosNumpad({ addToCart, storeId }: MobilePosNumpadProps) {
  const [productCode, setProductCode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Fetch product by code when Enter is pressed
  const handleSubmit = async () => {
    if (!productCode.trim()) {
      setErrorMessage('Enter a barcode or product ID');
      return;
    }
    
    try {
      const response = await fetch(`/api/inventory/products/code/${productCode}?storeId=${storeId}`);
      const data = await response.json();
      
      if (response.ok) {
        setSearchResults([data]);
        setErrorMessage('');
      } else {
        setSearchResults([]);
        setErrorMessage(data.message || 'Product not found');
      }
    } catch (error) {
      setSearchResults([]);
      setErrorMessage('Error searching for product');
    }
  };
  
  // Add product to cart
  const handleAddToCart = (product: any) => {
    addToCart({
      ...product,
      quantity: quantity
    });
    
    // Reset after adding
    setProductCode('');
    setQuantity(1);
    setSearchResults([]);
    setErrorMessage('');
  };
  
  // Handle numpad button press
  const handleNumpadPress = (value: string) => {
    if (value === 'clear') {
      setProductCode('');
    } else if (value === 'backspace') {
      setProductCode(prev => prev.slice(0, -1));
    } else if (value === 'enter') {
      handleSubmit();
    } else {
      setProductCode(prev => prev + value);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 mb-4">
        <div className="space-y-2">
          <div className="relative">
            <Input
              className="text-lg text-center py-6 font-mono"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="Enter barcode or ID"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                }
              }}
            />
            {errorMessage && (
              <div className="text-sm text-red-500 mt-1 text-center">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => (
            <Button
              key={key}
              variant={key === 'clear' ? "destructive" : key === 'backspace' ? "secondary" : "outline"}
              className="h-12 text-lg"
              onClick={() => handleNumpadPress(key)}
            >
              {key === 'clear' ? (
                <X className="h-5 w-5" />
              ) : key === 'backspace' ? (
                <Delete className="h-5 w-5" />
              ) : (
                key
              )}
            </Button>
          ))}
        </div>
        
        <Button 
          className="w-full h-12" 
          onClick={handleSubmit}
        >
          <CornerDownLeft className="h-5 w-5 mr-2" />
          Search
        </Button>
      </div>
      
      {searchResults.length > 0 && (
        <div className="space-y-4">
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {searchResults.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ${parseFloat(product.price).toFixed(2)} each
                        </p>
                        {product.barcode && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Barcode: {product.barcode}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ${(parseFloat(product.price) * quantity).toFixed(2)}
                        </p>
                        <div className="text-sm text-muted-foreground">
                          In stock: {product.quantity}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setQuantity(prev => prev + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleAddToCart(product)}
                        disabled={product.quantity < 1}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}