import React from 'react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { currencies, CurrencyCode } from '@/lib/utils';
import { useCurrency } from '@/providers/currency-provider';

export function CurrencySelector() {
  const { currency, setCurrency, currencySymbol } = useCurrency();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
          <span className="text-sm font-medium">{currencySymbol}</span>
          <span className="text-xs text-muted-foreground">{currency}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(currencies).map(([code, info]) => (
          <DropdownMenuItem 
            key={code}
            className={currency === code ? "bg-primary/10" : ""}
            onClick={() => setCurrency(code as CurrencyCode)}
          >
            <span className="mr-2">{info.symbol}</span>
            <span>{info.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}