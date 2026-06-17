import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';
import { colors, dimensions, motion } from '../constants';
import { useResponsive } from '../hooks/useResponsive';

interface OnboardingCardProps {
  isDarkMode?: boolean;
  onComplete: () => void;
}

const SWIPE_COMPLETE_DISTANCE = 48;

export const OnboardingCard: React.FC<OnboardingCardProps> = ({
  isDarkMode = false,
  onComplete,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const responsive = useResponsive();
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const cardSurface = isDarkMode ? '#2B2B2B' : '#FEFCF8';
  const cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.07)' : '#EFE7DA';
  const cardHighlight = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.82)';

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: motion.duration.cardEntrance,
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  const handleSwipeEnd = ({ nativeEvent }: PanGestureHandlerStateChangeEvent) => {
    if (nativeEvent.state !== State.END) {
      return;
    }

    const distance = Math.max(
      Math.abs(nativeEvent.translationX),
      Math.abs(nativeEvent.translationY)
    );

    if (distance >= SWIPE_COMPLETE_DISTANCE) {
      onComplete();
    }
  };

  const animatedStyle = {
    opacity: entranceAnim,
    transform: [
      {
        scale: entranceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };

  return (
    <View style={styles.wrapper}>
      <PanGestureHandler onHandlerStateChange={handleSwipeEnd} minDist={12}>
        <Animated.View
          style={[
            styles.card,
            {
              width: responsive.card.width,
              height: responsive.card.height,
              borderRadius: responsive.card.borderRadius,
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
            animatedStyle,
          ]}
        >
          <View
            pointerEvents="none"
            style={[styles.cardHighlight, { backgroundColor: cardHighlight }]}
          />

          <View style={styles.content}>
            <View style={styles.header}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.text,
                    fontSize: Math.min(responsive.fontSize.xlarge, 32),
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                How it works
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: theme.textSecondary,
                    fontSize: responsive.fontSize.medium,
                    lineHeight: responsive.fontSize.medium * 1.32,
                  },
                ]}
              >
                See a take. Vote HOT or NOT. Watch the room decide. Skip anything that isn't your thing.
              </Text>
            </View>

            <View style={[styles.rule, { backgroundColor: theme.border }]} />

            <View style={styles.rows}>
              <View style={styles.instructionRow}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary, fontSize: responsive.fontSize.small }]}>
                  Swipe RIGHT
                </Text>
                <Text style={[styles.rowAction, { color: theme.hot, fontSize: responsive.fontSize.medium }]}>
                  → 🔥 HOT
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary, fontSize: responsive.fontSize.small }]}>
                  Swipe LEFT
                </Text>
                <Text style={[styles.rowAction, { color: theme.not, fontSize: responsive.fontSize.medium }]}>
                  ← ❄️ NOT
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary, fontSize: responsive.fontSize.small }]}>
                  Swipe UP/DOWN
                </Text>
                <Text style={[styles.rowAction, { color: theme.accent, fontSize: responsive.fontSize.medium }]}>
                  ↕ ⏭ SKIP
                </Text>
              </View>
            </View>

            <View style={[styles.rule, { backgroundColor: theme.border }]} />

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                    minHeight: motion.touchTarget.minimum,
                  },
                ]}
                onPress={onComplete}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Start voting"
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      fontSize: responsive.fontSize.medium,
                    },
                  ]}
                >
                  Let's go
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={onComplete}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Skip intro"
              >
                <Text
                  style={[
                    styles.skipText,
                    {
                      color: theme.textSecondary,
                      fontSize: responsive.fontSize.small,
                    },
                  ]}
                >
                  Skip intro
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 9,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  cardHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: dimensions.spacing.sm,
  },
  title: {
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  rule: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    opacity: 0.72,
  },
  rows: {
    gap: dimensions.spacing.sm,
  },
  instructionRow: {
    minHeight: motion.touchTarget.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: dimensions.spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  rowAction: {
    flex: 1,
    fontWeight: '900',
    textAlign: 'right',
  },
  actions: {
    alignItems: 'center',
    gap: dimensions.spacing.xs,
  },
  primaryButton: {
    minWidth: 156,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: dimensions.spacing.xl,
    paddingVertical: dimensions.spacing.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
  },
  skipButton: {
    minHeight: motion.touchTarget.minimum,
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.md,
  },
  skipText: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
