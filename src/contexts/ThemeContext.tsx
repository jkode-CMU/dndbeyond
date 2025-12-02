import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  theme: 'light' | 'dark';
  accentColor: string;
  font: string;
  setTheme: (theme: 'light' | 'dark') => void;
  setAccentColor: (color: string) => void;
  setFont: (font: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * ThemeProvider component that manages the application's theme and accent color
 * Stores preferences in localStorage and applies them across the app
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [accentColor, setAccentColorState] = useState('indigo');
  const [font, setFontState] = useState('system');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const savedColor = localStorage.getItem('accentColor');
    const useCustom = localStorage.getItem('use_custom_theme') === 'true';
    
    if (savedTheme) setThemeState(savedTheme);
    if (savedColor) {
      setAccentColorState(savedColor);
      // Set data attribute for Tailwind to use
      document.documentElement.setAttribute('data-theme-color', savedColor);
      // If saved color is a custom hex and the user enabled custom theme, apply it
      if (savedColor.startsWith('#') && useCustom) {
        document.documentElement.style.setProperty('--color-primary', savedColor);
        document.documentElement.setAttribute('data-theme-color', 'custom');
      }
      const savedFont = localStorage.getItem('appFont');
      if (savedFont) {
        setFontState(savedFont);
        // Apply font family CSS variable
        const fontMap: Record<string, string> = {
          system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`,
          serif: `Georgia, 'Times New Roman', Times, serif`,
          sans: `Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto`,
          mono: `ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace`,
          rounded: `Rubik, 'Helvetica Neue', Arial, sans-serif`,
        };
        const family = fontMap[savedFont] || fontMap['system'];
        document.documentElement.style.setProperty('--app-font', family);
      }
    }
  }, []);

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    localStorage.setItem('accentColor', color);
    // If color is a hex value, apply directly to CSS variable
    const useCustom = localStorage.getItem('use_custom_theme') === 'true';
    if (color.startsWith('#')) {
      if (useCustom) {
        document.documentElement.style.setProperty('--color-primary', color);
        document.documentElement.setAttribute('data-theme-color', 'custom');
      } else {
        // do not apply custom color to DOM unless custom theme is enabled
        document.documentElement.setAttribute('data-theme-color', color);
      }
    } else {
      document.documentElement.setAttribute('data-theme-color', color);
      // Also clear any inline custom color if present
      document.documentElement.style.removeProperty('--color-primary');
    }
  };

  const setFont = (fontKey: string) => {
    setFontState(fontKey);
    localStorage.setItem('appFont', fontKey);
    const fontMap: Record<string, string> = {
      system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`,
      serif: `Georgia, 'Times New Roman', Times, serif`,
      sans: `Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto`,
      mono: `ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace`,
      rounded: `Rubik, 'Helvetica Neue', Arial, sans-serif`,
    };
    const family = fontMap[fontKey] || fontMap['system'];
    document.documentElement.style.setProperty('--app-font', family);
  };

  return (
    <ThemeContext.Provider value={{ theme, accentColor, setTheme, setAccentColor, setFont, font }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the theme context
 * @throws Error if used outside ThemeProvider
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
