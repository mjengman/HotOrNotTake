export const colors = {
  light: {
    primary: '#FF4757',      // Hot red
    primaryLight: '#FFE8EA', // Light red background
    secondary: '#3742FA',    // Cool blue
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    accent: '#FFA502',       // Orange accent
    success: '#2ED573',
    error: '#FF3838',
    hot: '#FF4757',
    not: '#747D8C',
    card: '#FFFFFF',
    border: '#E1E8ED',
  },
  dark: {
    primary: '#FF4757',      // Hot red (same)
    primaryLight: '#2A1F20', // Dark red background
    secondary: '#5352ED',    // Bright blue
    background: '#1A1A1A',
    surface: '#2C2C2C',
    text: '#FFFFFF',
    textSecondary: '#BDC3C7',
    accent: '#FFA502',       // Orange accent (same)
    success: '#2ED573',
    error: '#FF3838',
    hot: '#FF4757',
    not: '#74B9FF',
    card: '#2C2C2C',
    border: '#3C3C3C',
  },
};

export type ColorScheme = 'light' | 'dark';
export type Colors = typeof colors.light;