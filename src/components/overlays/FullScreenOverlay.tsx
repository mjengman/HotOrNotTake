import React from 'react';
import { Platform, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { motion } from '../../constants';

interface FullScreenOverlayProps {
  children: React.ReactNode;
  zIndex?: number;
  dimOpacity?: number;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
}

export const FullScreenOverlay: React.FC<FullScreenOverlayProps> = ({
  children,
  zIndex = 1000,
  dimOpacity = 0.5,
  style,
  contentStyle,
}) => {
  const insets = useSafeAreaInsets();
  const androidTopInset = Platform.OS === 'android' ? insets.top : 0;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.root, { zIndex }, style]}
    >
      <Animated.View
        pointerEvents="none"
        entering={FadeIn.duration(motion.duration.fadeIn)}
        exiting={FadeOut.duration(motion.duration.fadeOut)}
        style={[
          styles.backdrop,
          { backgroundColor: `rgba(0, 0, 0, ${dimOpacity})` },
        ]}
      />
      <Animated.View
        entering={SlideInDown.duration(motion.duration.overlayIn).easing(Easing.out(Easing.cubic))}
        exiting={SlideOutDown.duration(motion.duration.overlayOut).easing(Easing.in(Easing.cubic))}
        style={[
          styles.content,
          androidTopInset > 0 && { paddingTop: androidTopInset },
          contentStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
});
