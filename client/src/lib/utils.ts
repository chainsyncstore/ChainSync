import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency configuration
export type CurrencyCode = 'NGN' | 'USD' | 'EUR' | 'GBP';

interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  name: string;
}

export const currencies: Record<CurrencyCode, CurrencyInfo> = {
  NGN: { code: 'NGN', symbol: '₦', locale: 'en-NG', name: 'Nigerian Naira' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', locale: 'en-EU', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound' },
};

// Default to NGN as the primary currency
let currentCurrency: CurrencyCode = 'NGN';

export const getCurrentCurrency = (): CurrencyCode => {
  return currentCurrency;
};

export const setCurrentCurrency = (currency: CurrencyCode): void => {
  currentCurrency = currency;
};

export const formatCurrency = (
  value: number | string | null | undefined, 
  currencyCode?: CurrencyCode
) => {
  if (value === null || value === undefined) return `${currencies[currentCurrency].symbol}0.00`;
  
  const numberValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numberValue)) return `${currencies[currentCurrency].symbol}0.00`;
  
  const currency = currencyCode ? currencies[currencyCode] : currencies[currentCurrency];
  
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue);
};

export const formatNumber = (value: number | string | null | undefined, decimals = 0) => {
  if (value === null || value === undefined) return "0";
  
  const numberValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numberValue)) return "0";
  
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numberValue);
};

export const formatDate = (date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return "";
  }
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  
  return new Intl.DateTimeFormat("en-US", options || defaultOptions).format(dateObj);
};

export const formatTime = (date: Date | string | null | undefined) => {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return "";
  }
  
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(dateObj);
};

export const generateTransactionId = () => {
  const prefix = "TRX-";
  const randomNum = Math.floor(Math.random() * 100000);
  return `${prefix}${randomNum.toString().padStart(5, "0")}`;
};

export const calculateSubtotal = (items: { quantity: number; unitPrice: number }[]) => {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
};

export const calculateTax = (subtotal: number, taxRate = 0.0825) => {
  return subtotal * taxRate;
};

export const calculateTotal = (subtotal: number, tax: number) => {
  return subtotal + tax;
};

export function debounce<F extends (...args: any[]) => any>(func: F, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<F>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

export function getInitials(name: string) {
  if (!name) return "";
  
  const parts = name.split(" ");
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function truncate(str: string, length: number) {
  if (!str) return "";
  
  if (str.length <= length) {
    return str;
  }
  
  return `${str.substring(0, length)}...`;
}
