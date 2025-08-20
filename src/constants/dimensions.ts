import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Base dimensions (L profile baseline - unchanged for backward compatibility)
export const BASE_DIMENSIONS = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  fontSize: { small: 14, medium: 16, large: 18, xlarge: 24, xxlarge: 32 },
  iconSize: { small: 16, medium: 24, large: 32, xlarge: 48 },
  card: { 
    widthRatio: 0.9, 
    heightRatio: 0.5, 
    borderRadius: 16 
  },
};

// Backward compatibility: export static dimensions for L profile baseline
// Components should migrate to useResponsive() hook for dynamic scaling
export const dimensions = {
  window: {
    width,
    height,
  },
  card: {
    width: width * BASE_DIMENSIONS.card.widthRatio,
    height: height * BASE_DIMENSIONS.card.heightRatio,
    borderRadius: BASE_DIMENSIONS.card.borderRadius,
  },
  spacing: BASE_DIMENSIONS.spacing,
  fontSize: BASE_DIMENSIONS.fontSize,
  iconSize: BASE_DIMENSIONS.iconSize,
};