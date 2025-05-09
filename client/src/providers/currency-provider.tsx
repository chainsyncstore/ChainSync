import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { CurrencyCode, currencies, setCurrentCurrency } from '@/lib/utils';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  currencySymbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Helper function to get the initial currency - outside component for stability
const getInitialCurrency = (): CurrencyCode => {
  try {
    const storedCurrency = localStorage.getItem('preferredCurrency');
    if (storedCurrency && Object.keys(currencies).includes(storedCurrency)) {
      return storedCurrency as CurrencyCode;
    }
    
    // Try to detect user's currency using navigator.language
    const detectedLocale = navigator.language;
    if (detectedLocale.includes('US')) {
      return 'USD';
    } else if (detectedLocale.includes('GB')) {
      return 'GBP';
    } else if (detectedLocale.includes('EU') || detectedLocale.includes('FR') || 
               detectedLocale.includes('DE') || detectedLocale.includes('ES') || 
               detectedLocale.includes('IT')) {
      return 'EUR';
    }
    
    // Default to NGN for Nigerian market focus
    return 'NGN';
  } catch (error) {
    // If browser API is unavailable, default to NGN
    return 'NGN';
  }
};

// Provider component
const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  // Get the initial currency
  const initialCurrency = getInitialCurrency();
  const [currency, setCurrencyState] = useState<CurrencyCode>(initialCurrency);
  
  // Initialize the utility on mount
  useEffect(() => {
    // Set the utility immediately
    setCurrentCurrency(initialCurrency);
  }, [initialCurrency]);
  
  // Custom setCurrency function to update state and utilities in one go
  const setCurrency = useCallback((newCurrency: CurrencyCode) => {
    setCurrentCurrency(newCurrency); // Update utility first
    localStorage.setItem('preferredCurrency', newCurrency); // Save to localStorage
    setCurrencyState(newCurrency); // Update state
  }, []);

  const currencySymbol = currencies[currency].symbol;

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, currencySymbol }}>
      {children}
    </CurrencyContext.Provider>
  );
};

// Hook to use the currency context
const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export { CurrencyProvider, useCurrency };