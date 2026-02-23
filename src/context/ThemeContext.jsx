/**
 * Theme context for light/dark mode.
 * Persists the user's preference to localStorage and applies
 * a data-theme attribute on the document root element.
 */
import { createContext, useState, useEffect, useContext, useCallback } from 'react';

const STORAGE_KEY = 'shoppinglist-theme';

export const ThemeContext = createContext(null);

/**
 * Returns the initial theme from localStorage or system preference.
 * @returns {'light' | 'dark'}
 */
const getInitialTheme = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

/** Provides theme state and toggle action to the app. */
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme state and toggle.
 * @returns {{ theme: 'light' | 'dark', toggleTheme: Function }}
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
