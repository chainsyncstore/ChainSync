import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Density = 'comfortable' | 'compact';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  density: Density;
  setDensity: (density: Density) => void;
  fontSize: number;
  setFontSize: (fontSize: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [density, setDensityState] = useState<Density>('comfortable');
  const [fontSize, setFontSizeState] = useState<number>(16);

  // Initialize theme from localStorage or default to system
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme;
    const storedDensity = localStorage.getItem('density') as Density;
    const storedFontSize = localStorage.getItem('fontSize');
    
    if (storedTheme) {
      setThemeState(storedTheme);
    }
    
    if (storedDensity) {
      setDensityState(storedDensity);
    }
    
    if (storedFontSize) {
      setFontSizeState(Number(storedFontSize));
    }
  }, []);

  // Apply theme changes to document
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove previous theme classes
    root.classList.remove('light', 'dark');
    
    // Handle system preference
    if (theme === 'system') {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemPreference);
    } else {
      root.classList.add(theme);
    }
    
    // Store theme preference
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Apply density changes
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove previous density classes
    root.classList.remove('comfortable', 'compact');
    
    // Add selected density class
    root.classList.add(density);
    
    // Store density preference
    localStorage.setItem('density', density);
  }, [density]);

  // Apply font size changes
  useEffect(() => {
    // Set fontSize in document root
    document.documentElement.style.fontSize = `${fontSize}px`;
    
    // Store font size preference
    localStorage.setItem('fontSize', fontSize.toString());
  }, [fontSize]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Define setter functions
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setDensity = (newDensity: Density) => {
    setDensityState(newDensity);
  };

  const setFontSize = (newFontSize: number) => {
    setFontSizeState(newFontSize);
  };

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        setTheme, 
        density, 
        setDensity, 
        fontSize, 
        setFontSize 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}