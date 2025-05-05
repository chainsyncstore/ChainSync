import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return "$0.00";
  
  const numberValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numberValue)) return "$0.00";
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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
