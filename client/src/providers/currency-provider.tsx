import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { CurrencyCode, currencies, setCurrentCurrency } from '@/lib/utils';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  currencySymbol: string;
  isDetectingLocation: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Enable this flag to test as if user is in Nigeria 
// Set to false for production usage
const TEST_AS_NIGERIAN_USER = false;

// Function to detect if user is in Nigeria using IP geolocation
const detectUserCountry = async (): Promise<string | null> => {
  try {    
    // For testing: simulate a Nigerian user if test flag is enabled
    if (TEST_AS_NIGERIAN_USER) {
      return 'NG';
    }
    
    // Real implementation using IP geolocation
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) {
      throw new Error('Failed to fetch location data');
    }
    
    const data = await response.json();
    return data.country_code; // This will return "NG" for Nigeria
  } catch (error) {
    console.error('Error detecting user country:', error);
    return null;
  }
};

// Helper function to get the initial currency - outside component for stability
const getInitialCurrency = async (): Promise<CurrencyCode> => {
  try {
    // First check if user has a stored preference
    const storedCurrency = localStorage.getItem('preferredCurrency');
    if (storedCurrency && Object.keys(currencies).includes(storedCurrency)) {
      return storedCurrency as CurrencyCode;
    }
    
    // Try to detect user's country
    const countryCode = await detectUserCountry();
    
    // If the user is in Nigeria, use NGN
    if (countryCode === 'NG') {
      return 'NGN';
    }
    
    // Fall back to browser locale if geolocation fails
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
    
    // Default to USD for international users not from Nigeria
    return 'USD';
  } catch (error) {
    // If any APIs are unavailable, default to USD
    console.error('Error determining currency:', error);
    return 'USD';
  }
};

// Provider component
export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  // Start with a valid initial currency that exists in our list
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(true);
  
  // Custom setCurrency function to update state and utilities in one go
  const setCurrency = useCallback((newCurrency: CurrencyCode) => {
    if (Object.keys(currencies).includes(newCurrency)) {
      setCurrentCurrency(newCurrency); // Update utility first
      localStorage.setItem('preferredCurrency', newCurrency); // Save to localStorage
      setCurrencyState(newCurrency); // Update state
    } else {
      console.error(`Invalid currency code: ${newCurrency}`);
    }
  }, []);
  
  // Initialize currency detection on mount
  useEffect(() => {
    // For testing: clear any stored preferences to force location detection
    if (TEST_AS_NIGERIAN_USER) {
      localStorage.removeItem('preferredCurrency');
    }
    
    const detectCurrency = async () => {
      setIsDetectingLocation(true);
      try {
        // First try to get currency from localStorage for returning users
        const storedCurrency = localStorage.getItem('preferredCurrency');
        
        if (storedCurrency && Object.keys(currencies).includes(storedCurrency)) {
          setCurrency(storedCurrency as CurrencyCode);
          setIsDetectingLocation(false);
          return;
        }
        
        // If no stored preference, detect based on location
        const countryCode = await detectUserCountry();
        
        // If the user is in Nigeria, use NGN
        if (countryCode === 'NG') {
          setCurrency('NGN');
        } else {
          // Otherwise use USD as default for international users
          setCurrency('USD');
        }
      } catch (error) {
        console.error('Error in currency detection:', error);
        // Keep USD as fallback on error (already set in useState)
      } finally {
        setIsDetectingLocation(false);
      }
    };
    
    detectCurrency();
  }, [setCurrency]);
  
  // Safely get the currency symbol
  const currencySymbol = currencies[currency]?.symbol || '$';

  return (
    <CurrencyContext.Provider value={{ 
      currency, 
      setCurrency, 
      currencySymbol,
      isDetectingLocation
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

// Hook to use the currency context
export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
