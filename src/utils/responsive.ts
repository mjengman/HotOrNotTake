import { Dimensions, PixelRatio } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';

// Device profile types
export type DeviceProfile = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Tablet' | 'Tablet+';

// Profile multipliers interface
export interface ProfileMultipliers {
  typography: number;
  spacing: number;
  icon: number;
  header_width: number;
  max_content_width: number;
}

// Profile multipliers based on ChatGPT5 spec
const PROFILE_MULTIPLIERS: Record<DeviceProfile, ProfileMultipliers> = {
  'S': { typography: 0.90, spacing: 0.90, icon: 0.90, header_width: 0.90, max_content_width: 0.80 },
  'M': { typography: 0.95, spacing: 0.95, icon: 0.95, header_width: 0.95, max_content_width: 0.90 },
  'L': { typography: 1.00, spacing: 1.00, icon: 1.00, header_width: 1.00, max_content_width: 1.00 }, // Baseline
  'XL': { typography: 1.08, spacing: 1.10, icon: 1.10, header_width: 1.12, max_content_width: 1.15 },
  'XXL': { typography: 1.16, spacing: 1.20, icon: 1.20, header_width: 1.25, max_content_width: 1.30 },
  'Tablet': { typography: 1.28, spacing: 1.30, icon: 1.28, header_width: 1.35, max_content_width: 1.50 },
  'Tablet+': { typography: 1.40, spacing: 1.40, icon: 1.36, header_width: 1.50, max_content_width: 1.70 },
};

// Breakpoint definitions based on smallest width
const BREAKPOINTS = [
  { profile: 'S' as DeviceProfile, sw_min: 0, sw_max: 359 },
  { profile: 'M' as DeviceProfile, sw_min: 360, sw_max: 383 },
  { profile: 'L' as DeviceProfile, sw_min: 384, sw_max: 419 },
  { profile: 'XL' as DeviceProfile, sw_min: 420, sw_max: 499 },
  { profile: 'XXL' as DeviceProfile, sw_min: 500, sw_max: 599 },
  { profile: 'Tablet' as DeviceProfile, sw_min: 600, sw_max: 719 },
  { profile: 'Tablet+' as DeviceProfile, sw_min: 720, sw_max: 9999 },
];

/**
 * Get smallest width for profile determination
 * Uses current window dimensions
 */
export const getSmallestWidth = (): number => {
  const { width, height } = Dimensions.get('window');
  return Math.min(width, height);
};

/**
 * Determine device profile from smallest width
 */
export const getDeviceProfile = (sw: number): DeviceProfile => {
  const breakpoint = BREAKPOINTS.find(bp => sw >= bp.sw_min && sw <= bp.sw_max);
  return breakpoint?.profile || 'L'; // Default to L if no match
};

/**
 * Get multipliers for profile
 */
export const getMultipliers = (profile: DeviceProfile): ProfileMultipliers => {
  return PROFILE_MULTIPLIERS[profile];
};

/**
 * Scale typography with tempered font scaling (Samsung-safe)
 * Clamps font scale between 0.85-1.40 and applies 0.35 tempering
 */
export const scaleTypography = (base: number, profile: DeviceProfile): number => {
  const multiplier = getMultipliers(profile).typography;
  const fontScale = PixelRatio.getFontScale();
  const clampedScale = Math.min(Math.max(fontScale, 0.85), 1.40);
  const effectiveScale = 1 + (clampedScale - 1) * 0.35;
  const result = base * multiplier * effectiveScale;
  
  // Round to nearest 0.5 for typography
  return Math.round(result * 2) / 2;
};

/**
 * Scale spacing values
 */
export const scaleSpacing = (base: number, profile: DeviceProfile): number => {
  const multiplier = getMultipliers(profile).spacing;
  return Math.round(base * multiplier);
};

/**
 * Scale icon sizes
 */
export const scaleIcon = (base: number, profile: DeviceProfile): number => {
  const multiplier = getMultipliers(profile).icon;
  return Math.round(base * multiplier);
};

/**
 * Scale header width with safe area clamping
 */
export const scaleHeader = (
  base: number, 
  profile: DeviceProfile, 
  availableWidth: number, 
  insets: EdgeInsets
): number => {
  const multiplier = getMultipliers(profile).header_width;
  const scaled = base * multiplier;
  const maxWidth = availableWidth - (insets.left + insets.right);
  return Math.min(scaled, maxWidth);
};

/**
 * Scale content with max width caps for tablets
 */
export const scaleContent = (
  base: number, 
  profile: DeviceProfile, 
  availableWidth: number
): number => {
  const multiplier = getMultipliers(profile).max_content_width;
  const scaled = base * multiplier;
  return Math.min(scaled, availableWidth);
};

/**
 * Get height-based adjustments for fine-tuning
 */
export const getHeightAdjustments = (screenHeight: number) => {
  return {
    spacingMultiplier: screenHeight < 640 ? 0.9 : 1.0,
    initialCardCount: screenHeight >= 780 ? 6 : 5,
    showExtraControls: screenHeight >= 700,
  };
};

/**
 * Ensure minimum touch target size (44dp)
 */
export const ensureMinTouchTarget = (size: number): number => {
  return Math.max(size, 44);
};