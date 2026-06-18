import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Vibration,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '../../constants';

interface AnimatedPressableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  scaleValue?: number;
  hapticFeedback?: boolean;
  hapticIntensity?: number;
  springConfig?: {
    damping?: number;
    stiffness?: number;
  };
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  onPress,
  onPressIn,
  onPressOut,
  scaleValue = 0.95,
  hapticFeedback = true,
  hapticIntensity = motion.haptic.selection,
  springConfig = motion.spring.press,
  style,
  disabled = false,
  ...props
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = (event: any) => {
    if (!disabled) {
      scale.value = withSpring(scaleValue, springConfig);
      opacity.value = withTiming(0.82, { duration: motion.duration.pressIn });
      
      if (hapticFeedback) {
        Vibration.vibrate(hapticIntensity);
      }
    }
    
    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
      opacity.value = withTiming(1, { duration: motion.duration.pressOut });
    }
    
    onPressOut?.(event);
  };

  const handlePress = (event: any) => {
    if (!disabled && onPress) {
      onPress(event);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      {...props}
    >
      {children}
    </AnimatedTouchable>
  );
};
