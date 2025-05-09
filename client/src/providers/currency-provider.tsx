import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { CurrencyCode, currencies, setCurrentCurrency } from '@/lib/utils';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  currencySymbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');

  useEffect(() => {
    // Try to detect user's currency using navigator.language or fallback to NGN
    try {
      const detectedLocale = navigator.language;
      if (detectedLocale.includes('US')) {
        setCurrency('USD');
      } else if (detectedLocale.includes('GB')) {
        setCurrency('GBP');
      } else if (detectedLocale.includes('EU') || detectedLocale.includes('FR') || detectedLocale.includes('DE') || detectedLocale.includes('ES') || detectedLocale.includes('IT')) {
        setCurrency('EUR');
      } else {
        // Default to NGN for Nigerian market focus
        setCurrency('NGN');
      }
    } catch (error) {
      // If browser API is unavailable, default to NGN
      setCurrency('NGN');
    }

    // Check for stored preference
    const storedCurrency = localStorage.getItem('preferredCurrency');
    if (storedCurrency && Object.keys(currencies).includes(storedCurrency)) {
      setCurrency(storedCurrency as CurrencyCode);
    }
  }, []);

  // Update the utility function whenever the currency changes
  useEffect(() => {
    setCurrentCurrency(currency);
    localStorage.setItem('preferredCurrency', currency);
  }, [currency]);

  const currencySymbol = currencies[currency].symbol;

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, currencySymbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}