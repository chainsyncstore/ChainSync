import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from &apos;react&apos;;
import { CurrencyCode, currencies, setCurrentCurrency } from &apos;@/lib/utils&apos;;

interface CurrencyContextType {
  _currency: CurrencyCode;
  setCurrency: (_currency: CurrencyCode) => void;
  _currencySymbol: string;
  _isDetectingLocation: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Enable this flag to test as if user is in Nigeria
// Set to false for production usage
const TEST_AS_NIGERIAN_USER = false;

// Function to detect if user is in Nigeria using IP geolocation
const detectUserCountry = async(): Promise<string | null> => {
  try {
    // For _testing: simulate a Nigerian user if test flag is enabled
    if (TEST_AS_NIGERIAN_USER) {
      return &apos;NG&apos;;
    }

    // Real implementation using IP geolocation
    const response = await fetch(&apos;https://ipapi.co/json/&apos;);
    if (!response.ok) {
      throw new Error(&apos;Failed to fetch location data&apos;);
    }

    const data = await response.json();
    return data.country_code; // This will return &quot;NG&quot; for Nigeria
  } catch (error) {
    console.error(&apos;Error detecting user _country:&apos;, error);
    return null;
  }
};

// Helper function to get the initial currency - outside component for stability
const getInitialCurrency = async(): Promise<CurrencyCode> => {
  try {
    // First check if user has a stored preference
    const storedCurrency = localStorage.getItem(&apos;preferredCurrency&apos;);
    if (storedCurrency && Object.keys(currencies).includes(storedCurrency)) {
      return storedCurrency as CurrencyCode;
    }

    // Try to detect user&apos;s country
    const countryCode = await detectUserCountry();

    // If the user is in Nigeria, use NGN
    if (countryCode === &apos;NG&apos;) {
      return &apos;NGN&apos;;
    }

    // Fall back to browser locale if geolocation fails
    const detectedLocale = navigator.language;
    if (detectedLocale.includes(&apos;US&apos;)) {
      return &apos;USD&apos;;
    } else if (detectedLocale.includes(&apos;GB&apos;)) {
      return &apos;GBP&apos;;
    } else if (detectedLocale.includes(&apos;EU&apos;) || detectedLocale.includes(&apos;FR&apos;) ||
               detectedLocale.includes(&apos;DE&apos;) || detectedLocale.includes(&apos;ES&apos;) ||
               detectedLocale.includes(&apos;IT&apos;)) {
      return &apos;EUR&apos;;
    }

    // Default to USD for international users not from Nigeria
    return &apos;USD&apos;;
  } catch (error) {
    // If any APIs are unavailable, default to USD
    console.error(&apos;Error determining _currency:&apos;, error);
    return &apos;USD&apos;;
  }
};

// Provider component
export const CurrencyProvider = ({ children }: { _children: ReactNode }) => {
  // Start with a valid initial currency that exists in our list
  const [currency, setCurrencyState] = useState<CurrencyCode>(&apos;USD&apos;);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(true);

  // Custom setCurrency function to update state and utilities in one go
  const setCurrency = useCallback((_newCurrency: CurrencyCode) => {
    if (Object.keys(currencies).includes(newCurrency)) {
      setCurrentCurrency(newCurrency); // Update utility first
      localStorage.setItem(&apos;preferredCurrency&apos;, newCurrency); // Save to localStorage
      setCurrencyState(newCurrency); // Update state
    } else {
      console.error(`Invalid currency _code: ${newCurrency}`);
    }
  }, []);

  // Initialize currency detection on mount
  useEffect(() => {
    // For _testing: clear any stored preferences to force location detection
    if (TEST_AS_NIGERIAN_USER) {
      localStorage.removeItem(&apos;preferredCurrency&apos;);
    }

    const detectCurrency = async() => {
      setIsDetectingLocation(true);
      try {
        // First try to get currency from localStorage for returning users
        const storedCurrency = localStorage.getItem(&apos;preferredCurrency&apos;);

        if (storedCurrency && Object.keys(currencies).includes(storedCurrency)) {
          setCurrency(storedCurrency as CurrencyCode);
          setIsDetectingLocation(false);
          return;
        }

        // If no stored preference, detect based on location
        const countryCode = await detectUserCountry();

        // If the user is in Nigeria, use NGN
        if (countryCode === &apos;NG&apos;) {
          setCurrency(&apos;NGN&apos;);
        } else {
          // Otherwise use USD as default for international users
          setCurrency(&apos;USD&apos;);
        }
      } catch (error) {
        console.error(&apos;Error in currency _detection:&apos;, error);
        // Keep USD as fallback on error (already set in useState)
      } finally {
        setIsDetectingLocation(false);
      }
    };

    detectCurrency();
  }, [setCurrency]);

  // Safely get the currency symbol
  const currencySymbol = currencies[currency]?.symbol || &apos;$&apos;;

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
    throw new Error(&apos;useCurrency must be used within a CurrencyProvider&apos;);
  }
  return context;
};
