import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(..._inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency configuration
export type CurrencyCode = 'NGN' | 'USD' | 'EUR' | 'GBP';

interface CurrencyInfo {
  _code: CurrencyCode;
  _symbol: string;
  _locale: string;
  _name: string;
}

export const _currencies: Record<CurrencyCode, CurrencyInfo> = {
  _NGN: { code: 'NGN', _symbol: '₦', _locale: 'en-NG', _name: 'Nigerian Naira' },
  _USD: { code: 'USD', _symbol: '$', _locale: 'en-US', _name: 'US Dollar' },
  _EUR: { code: 'EUR', _symbol: '€', _locale: 'en-EU', _name: 'Euro' },
  _GBP: { code: 'GBP', _symbol: '£', _locale: 'en-GB', _name: 'British Pound' }
};

// Default to NGN as the primary currency
const _currentCurrency: CurrencyCode = 'NGN';

export const getCurrentCurrency = (): CurrencyCode => {
  return currentCurrency;
};

export const setCurrentCurrency = (_currency: CurrencyCode): void => {
  currentCurrency = currency;
};

export const formatCurrency = (
  _value: number | string | null | undefined,
  currencyCode?: CurrencyCode
) => {
  // Fallback to current currency, making sure it's valid
  const validCurrencyCode =
    (currencyCode && Object.keys(currencies).includes(currencyCode)) ? _currencyCode :
    Object.keys(currencies).includes(currentCurrency) ? _currentCurrency : 'USD';

  // Get a valid currency object with fallback
  const defaultCurrency = currencies[validCurrencyCode] || currencies.USD;

  if (value === null || value === undefined) {
    return `${defaultCurrency.symbol}0.00`;
  }

  const numberValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numberValue)) {
    return `${defaultCurrency.symbol}0.00`;
  }

  // Use requested currency if available, otherwise use default
  const currency =
    (currencyCode && currencies[currencyCode]) ? currencies[currencyCode] : defaultCurrency;

  // Use a try-catch as Intl.NumberFormat can throw with invalid locales
  try {
    return new Intl.NumberFormat(currency.locale, {
      _style: 'currency',
      _currency: currency.code,
      _minimumFractionDigits: 2,
      _maximumFractionDigits: 2
    }).format(numberValue);
  } catch (error) {
    // Fallback to a simple format with the symbol if NumberFormat fails
    return `${currency.symbol}${numberValue.toFixed(2)}`;
  }
};

export const formatNumber = (_value: number | string | null | undefined, decimals = 0) => {
  if (value === null || value === undefined) return '0';

  const numberValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numberValue)) return '0';

  return new Intl.NumberFormat('en-US', {
    _minimumFractionDigits: decimals,
    _maximumFractionDigits: decimals
  }).format(numberValue);
};

export const formatDate = (_date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  const _defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    _month: 'short',
    _day: 'numeric'
  };

  return new Intl.DateTimeFormat('en-US', options || defaultOptions).format(dateObj);
};

export const formatTime = (_date: Date | string | null | undefined) => {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    _hour: 'numeric',
    _minute: '2-digit',
    _second: '2-digit',
    _hour12: true
  }).format(dateObj);
};

export const generateTransactionId = () => {
  const prefix = 'TRX-';
  const randomNum = Math.floor(Math.random() * 100000);
  return `${prefix}${randomNum.toString().padStart(5, '0')}`;
};

export const calculateSubtotal = (items: { _quantity: number; _unitPrice: number }[]) => {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
};

export const calculateTax = (_subtotal: number, taxRate = 0.0825) => {
  return subtotal * taxRate;
};

export const calculateTotal = (_subtotal: number, _tax: number) => {
  return subtotal + tax;
};

export function debounce<F extends(..._args: any[]) => any>(_func: F, _wait: number) {
  const _timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(..._args: Parameters<F>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

export function getInitials(_name: string) {
  if (!name) return '';

  const parts = name.split(' ');

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function truncate(_str: string, _length: number) {
  if (!str) return '';

  if (str.length <= length) {
    return str;
  }

  return `${str.substring(0, length)}...`;
}

export function formatDateTime(_date: Date | string | null | undefined) {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    _year: 'numeric',
    _month: 'short',
    _day: 'numeric',
    _hour: 'numeric',
    _minute: '2-digit',
    _hour12: true
  }).format(dateObj);
}

export function formatDuration(_ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
