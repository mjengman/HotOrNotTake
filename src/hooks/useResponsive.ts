import { useState, useEffect, useMemo } from 'react';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets, EdgeInsets } from 'react-native-safe-area-context';
import { BASE_DIMENSIONS } from '../constants/dimensions';
import {
  getSmallestWidth,
  getDeviceProfile,
  getMultipliers,
  scaleTypography,
  scaleSpacing,
  scaleIcon,
  scaleHeader,
  scaleContent,
  getHeightAdjustments,
  ensureMinTouchTarget,
  DeviceProfile,
  ProfileMultipliers
} from '../utils/responsive';

export interface ResponsiveDimensions {
  profile: DeviceProfile;
  multipliers: ProfileMultipliers;
  sw: number; // smallest width
  sh: number; // screen height (largest dimension)
  
  // Scaled values
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  
  fontSize: {
    small: number;
    medium: number;
    large: number;
    xlarge: number;
    xxlarge: number;
  };
  
  iconSize: {
    small: number;
    medium: number;
    large: number;
    xlarge: number;
  };
  
  // Card dimensions
  card: {
    width: number;
    height: number;
    borderRadius: number;
  };
  
  // Height adjustments
  heightAdjustments: {
    spacingMultiplier: number;
    initialCardCount: number;
    showExtraControls: boolean;
  };
  
  // Screen info
  screen: {
    width: number;
    height: number;
    availableWidth: number;
  };
}

// BASE_DIMENSIONS imported from constants

/**
 * Hook for responsive dimensions and device profile detection
 * Automatically updates on orientation changes and window resize
 */
export const useResponsive = (): ResponsiveDimensions => {
  // Track window dimensions with live updates
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));
  const insets = useSafeAreaInsets();
  
  // Listen for dimension changes (rotation, split-screen, foldables)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    
    return () => subscription?.remove();
  }, []);
  
  // Calculate core responsive values
  const sw = Math.min(dimensions.width, dimensions.height);
  const sh = Math.max(dimensions.width, dimensions.height);
  const profile = getDeviceProfile(sw);
  const multipliers = getMultipliers(profile);
  const heightAdjustments = getHeightAdjustments(sh);
  
  // Log telemetry once per boot for debugging
  useEffect(() => {
    console.log('📱 Device Profile Telemetry:', {
      sw,
      sh,
      profile,
      screenSize: `${dimensions.width}x${dimensions.height}`,
      // Add device model if expo-device is available
      // deviceModel: Device?.modelName,
    });
  }, []); // Only on mount
  
  // Memoize scaled dimensions to avoid recalculation on every render
  const scaledDimensions = useMemo((): ResponsiveDimensions => {
    // Account for safe area insets AND container margins
    const lgSpacing = Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.lg, profile));
    const availableWidth = dimensions.width - (insets.left + insets.right + lgSpacing * 2);
    
    // Apply height-based spacing adjustment
    const spacingAdjustment = heightAdjustments.spacingMultiplier;
    
    return {
      profile,
      multipliers,
      sw,
      sh,
      
      // Scaled spacing
      spacing: {
        xs: Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.xs, profile) * spacingAdjustment),
        sm: Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.sm, profile) * spacingAdjustment),
        md: Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.md, profile) * spacingAdjustment),
        lg: Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.lg, profile) * spacingAdjustment),
        xl: Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.xl, profile) * spacingAdjustment),
        xxl: Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.xxl, profile) * spacingAdjustment),
      },
      
      // Scaled typography
      fontSize: {
        small: scaleTypography(BASE_DIMENSIONS.fontSize.small, profile),
        medium: scaleTypography(BASE_DIMENSIONS.fontSize.medium, profile),
        large: scaleTypography(BASE_DIMENSIONS.fontSize.large, profile),
        xlarge: scaleTypography(BASE_DIMENSIONS.fontSize.xlarge, profile),
        xxlarge: scaleTypography(BASE_DIMENSIONS.fontSize.xxlarge, profile),
      },
      
      // Scaled icons (ensure minimum touch targets)
      iconSize: {
        small: ensureMinTouchTarget(scaleIcon(BASE_DIMENSIONS.iconSize.small, profile)),
        medium: ensureMinTouchTarget(scaleIcon(BASE_DIMENSIONS.iconSize.medium, profile)),
        large: ensureMinTouchTarget(scaleIcon(BASE_DIMENSIONS.iconSize.large, profile)),
        xlarge: ensureMinTouchTarget(scaleIcon(BASE_DIMENSIONS.iconSize.xlarge, profile)),
      },
      
      // Scaled card dimensions with smart height calculation
      card: (() => {
        const cardWidth = scaleContent(
          dimensions.width * BASE_DIMENSIONS.card.widthRatio, 
          profile, 
          availableWidth
        );
        
        // Get scaled spacing values
        const scaledXxl = Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.xxl, profile) * spacingAdjustment);
        const scaledMd = Math.round(scaleSpacing(BASE_DIMENSIONS.spacing.md, profile) * spacingAdjustment);
        
        // EXACT space calculation: Card should fill from below dropdown to above skip button
        
        // Distance from top of screen to bottom of category dropdown
        const topOffset = 
          insets.top + // Safe area top
          110 + // Title banner height  
          (scaledXxl * 1.5) + // Header padding (reduced)
          50 + // Category dropdown height
          10; // Very small gap after dropdown
        
        // Distance from bottom of screen to top of skip button
        // Skip button is positioned at dimensions.spacing.xxl * 1.5 from bottom
        const bottomOffset = 
          insets.bottom + // Safe area bottom
          (scaledXxl * 1.5) + // Skip button position from bottom
          50; // Skip button height + small gap
        
        // Card height is the exact space between these two points
        const exactAvailableHeight = dimensions.height - topOffset - bottomOffset;
        
        // Use ALL of the exact available height - this is what we want!
        const targetHeight = Math.max(
          exactAvailableHeight - 20, // Just 20px total padding
          300 // Absolute minimum
        );
        
        // For most screens, just use the target height directly
        const actualHeight = targetHeight;
        
        return {
          width: cardWidth,
          height: actualHeight,
          borderRadius: scaleSpacing(BASE_DIMENSIONS.card.borderRadius, profile),
        };
      })(),
      
      heightAdjustments,
      
      screen: {
        width: dimensions.width,
        height: dimensions.height,
        availableWidth,
      },
    };
  }, [
    profile, 
    multipliers, 
    dimensions, 
    insets, 
    heightAdjustments, 
    sw, 
    sh
  ]);
  
  return scaledDimensions;
};

/**
 * Utility hook for getting scaled individual values
 */
export const useResponsiveValue = () => {
  const responsive = useResponsive();
  
  return {
    ...responsive,
    
    // Helper functions for one-off scaling
    scaleFont: (size: number) => scaleTypography(size, responsive.profile),
    scaleSpace: (size: number) => scaleSpacing(size, responsive.profile),
    scaleIcon: (size: number) => scaleIcon(size, responsive.profile),
    scaleHeader: (size: number) => scaleHeader(size, responsive.profile, responsive.screen.availableWidth, useSafeAreaInsets()),
    scaleContent: (size: number) => scaleContent(size, responsive.profile, responsive.screen.availableWidth),
  };
};