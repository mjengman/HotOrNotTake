import { createContext, useContext } from 'react';
import { colors, ColorScheme, Colors } from '../constants';

interface ThemeContextType {
  colorScheme: ColorScheme;
  colors: Colors;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};