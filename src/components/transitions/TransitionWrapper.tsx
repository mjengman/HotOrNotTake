import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';

type TransitionType = 'fade' | 'slideUp' | 'slideDown' | 'scale' | 'fadeScale';

interface TransitionWrapperProps {
  children: React.ReactNode;
  visible?: boolean;
  type?: TransitionType;
  duration?: number;
  delay?: number;
  style?: ViewStyle | ViewStyle[];
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  children,
  visible = true,
  type = 'fade',
  duration = 300,
  delay = 0,
  style,
}) => {
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.9);
  const translateY = useSharedValue(visible ? 0 : 50);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration }, (finished) => {
        if (finished) {
          scale.value = 1;
          translateY.value = 0;
        }
      });
      
      if (type === 'scale' || type === 'fadeScale') {
        scale.value = withSpring(1, {
          damping: 15,
          stiffness: 150,
        });
      }
      
      if (type === 'slideUp' || type === 'slideDown') {
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
      }
    } else {
      opacity.value = withTiming(0, { duration });
      
      if (type === 'scale' || type === 'fadeScale') {
        scale.value = withTiming(0.9, { duration });
      }
      
      if (type === 'slideUp') {
        translateY.value = withTiming(-50, { duration });
      } else if (type === 'slideDown') {
        translateY.value = withTiming(50, { duration });
      }
    }
  }, [visible, type, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const baseStyle: any = {
      opacity: opacity.value,
    };

    if (type === 'scale' || type === 'fadeScale') {
      baseStyle.transform = [{ scale: scale.value }];
    }

    if (type === 'slideUp' || type === 'slideDown') {
      baseStyle.transform = [{ translateY: translateY.value }];
    }

    return baseStyle;
  });

  if (!visible && opacity.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

export const FadeInView: React.FC<{ children: React.ReactNode; delay?: number; style?: ViewStyle }> = ({ 
  children, 
  delay = 0,
  style 
}) => {
  return (
    <Animated.View 
      entering={FadeIn.delay(delay).duration(400)} 
      style={style}
    >
      {children}
    </Animated.View>
  );
};

export const SlideUpView: React.FC<{ children: React.ReactNode; delay?: number; style?: ViewStyle }> = ({ 
  children, 
  delay = 0,
  style 
}) => {
  return (
    <Animated.View 
      entering={SlideInUp.delay(delay).springify()} 
      exiting={SlideOutUp}
      style={style}
    >
      {children}
    </Animated.View>
  );
};