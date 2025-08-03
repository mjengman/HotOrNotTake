import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const dimensions = {
  window: {
    width,
    height,
  },
  card: {
    width: width * 0.9,
    height: height * 0.55,
    borderRadius: 16,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  fontSize: {
    small: 14,
    medium: 16,
    large: 18,
    xlarge: 24,
    xxlarge: 32,
  },
  iconSize: {
    small: 16,
    medium: 24,
    large: 32,
    xlarge: 48,
  },
};