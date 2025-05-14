import React, { useCallback } from 'react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { currencies, CurrencyCode } from '@/lib/utils';
import { useCurrency } from '@/providers/currency-provider';
import { Loader2 } from 'lucide-react';

const CurrencySelector = () => {
  const { currency, setCurrency, currencySymbol, isDetectingLocation } = useCurrency();
  
  // Use a memoized callback to prevent unnecessary re-renders
  const handleCurrencyChange = useCallback((code: CurrencyCode) => {
    setCurrency(code);
  }, [setCurrency]);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
          {isDetectingLocation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className="text-sm font-medium">{currencySymbol}</span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(currencies).map(([code, info]) => (
          <DropdownMenuItem 
            key={code}
            className={currency === code ? "bg-primary/10" : ""}
            onClick={() => handleCurrencyChange(code as CurrencyCode)}
          >
            <span className="mr-2">{info.symbol}</span>
            <span>{info.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { CurrencySelector };