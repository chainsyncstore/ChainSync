import React, { useCallback } from &apos;react&apos;;
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from &apos;@/components/ui/dropdown-menu&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { currencies, CurrencyCode } from &apos;@/lib/utils&apos;;
import { useCurrency } from &apos;@/providers/currency-provider&apos;;
import { Loader2 } from &apos;lucide-react&apos;;

const CurrencySelector = () => {
  const { currency, setCurrency, currencySymbol, isDetectingLocation } = useCurrency();

  // Use a memoized callback to prevent unnecessary re-renders
  const handleCurrencyChange = useCallback((_code: CurrencyCode) => {
    setCurrency(code);
  }, [setCurrency]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant=&quot;ghost&quot; size=&quot;sm&quot; className=&quot;h-8 gap-1 px-2&quot;>
          {isDetectingLocation ? (
            <Loader2 className=&quot;h-4 w-4 animate-spin&quot; />
          ) : (
            <>
              <span className=&quot;text-sm font-medium&quot;>{currencySymbol}</span>
              <span className=&quot;text-xs text-muted-foreground&quot;>{currency}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align=&quot;end&quot;>
        {Object.entries(currencies).map(([code, info]) => (
          <DropdownMenuItem
            key={code}
            className={currency === code ? &apos;bg-primary/10&apos; : &apos;&apos;}
            onClick={() => handleCurrencyChange(code as CurrencyCode)}
          >
            <span className=&quot;mr-2&quot;>{info.symbol}</span>
            <span>{info.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { CurrencySelector };
