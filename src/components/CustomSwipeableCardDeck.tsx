import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  Text,
  Vibration,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  runOnJS,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Take } from '../types';
import { TakeCard } from './TakeCard';
import { VoteIndicator } from './VoteIndicator';
import { AnimatedPressable } from './transitions/AnimatedPressable';
import { dimensions, colors } from '../constants';

interface CustomSwipeableCardDeckProps {
  takes: Take[];
  onVote: (takeId: string, vote: 'hot' | 'not') => void;
  onSkip: (takeId: string) => void;
  onSubmitTake?: () => void;
  onShowInstructions?: () => void;
  isDarkMode?: boolean;
  hasMore?: boolean;
  loadMore?: (count?: number) => Promise<void>;
  loading?: boolean;
}

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;
const SWIPE_DOWN_THRESHOLD = height * 0.2; // 20% of screen height

export const CustomSwipeableCardDeck: React.FC<CustomSwipeableCardDeckProps> = ({
  takes,
  onVote,
  onSkip,
  onSubmitTake,
  onShowInstructions,
  isDarkMode = false,
  hasMore = true,
  loadMore,
  loading = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1); // Track next card explicitly
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | null>(null);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const theme = isDarkMode ? colors.dark : colors.light;

  // Ensure takes is always an array
  const safeTakes = takes || [];

  // Clamp currentIndex when array size changes to prevent crashes
  useEffect(() => {
    if (safeTakes.length > 0 && currentIndex >= safeTakes.length) {
      setCurrentIndex(Math.max(0, safeTakes.length - 1));
    }
  }, [safeTakes.length, currentIndex]);

  // Update nextIndex when currentIndex changes
  useEffect(() => {
    setNextIndex(currentIndex + 1);
  }, [currentIndex]);

  // Auto-load more when getting low on cards
  useEffect(() => {
    if (loadMore && safeTakes.length - currentIndex <= 5 && hasMore && !loading) {
      loadMore(20).catch(console.error);
    }
  }, [safeTakes.length, currentIndex, hasMore, loading, loadMore]);

  const handleVote = (vote: 'hot' | 'not') => {
    if (currentIndex < safeTakes.length) {
      const currentTake = safeTakes[currentIndex];
      
      // Show vote indicator immediately
      setCurrentVote(vote);
      
      // Give the indicator more time to show its full animation
      setTimeout(() => {
        onVote(currentTake.id, vote);
      }, 750); // Increased delay
      
      // Clear vote indicator after animation completes
      setTimeout(() => setCurrentVote(null), 1000); // Extended timeout
      
      // IMPORTANT: Don't increment currentIndex - let parent's array removal handle advancing
    }
  };

  // Handle button press with swipe animation
  const handleButtonVote = (vote: 'hot' | 'not') => {
    if (currentIndex < safeTakes.length) {
      // Haptic feedback
      Vibration.vibrate(25);
      
      // Show vote indicator
      handleVote(vote);
      
      // Animate card swipe away
      const direction = vote === 'hot' ? 1 : -1;
      translateX.value = withSpring(
        width * 1.5 * direction,
        { damping: 15, stiffness: 120, mass: 0.8 },
        () => {
          'worklet';
          // Reset after animation  
          translateX.value = 0;
          translateY.value = 0;
          scale.value = withSpring(1);
        }
      );
    }
  };

  const handleSkip = () => {
    if (currentIndex < safeTakes.length) {
      // Immediate haptic feedback for skip action
      Vibration.vibrate(12);
      
      const currentTake = safeTakes[currentIndex];
      
      // Call onSkip asynchronously so it doesn't block the UI
      setTimeout(() => {
        onSkip(currentTake.id);
      }, 0);
      
      // IMPORTANT: Don't increment currentIndex - let parent's array removal handle advancing
    }
  };

  // Handle skip with animation (for both button press and swipe down)
  const handleSkipWithAnimation = () => {
    if (currentIndex < safeTakes.length) {
      // Haptic feedback
      Vibration.vibrate(15);
      
      // Call the skip logic
      handleSkip();
      
      // Animate card down
      translateY.value = withSpring(
        height * 0.8, // Animate card down off screen
        { damping: 15, stiffness: 120, mass: 0.8 },
        () => {
          'worklet';
          // Reset after animation  
          translateX.value = 0;
          translateY.value = 0;
          scale.value = withSpring(1);
        }
      );
    }
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      scale.value = withSpring(0.95);
      // Light haptic feedback on touch start
      runOnJS(Vibration.vibrate)(10);
    },
    onActive: (event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      
      // Provide haptic feedback when reaching swipe thresholds
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      const shouldSwipeDown = event.translationY > SWIPE_DOWN_THRESHOLD;
      
      // Horizontal swipe feedback
      if ((shouldSwipeRight || shouldSwipeLeft) && Math.abs(event.translationX) > SWIPE_THRESHOLD && Math.abs(event.translationX) < SWIPE_THRESHOLD + 20) {
        runOnJS(Vibration.vibrate)(15);
      }
      
      // Down swipe feedback
      if (shouldSwipeDown && Math.abs(event.translationY) > SWIPE_DOWN_THRESHOLD && Math.abs(event.translationY) < SWIPE_DOWN_THRESHOLD + 30) {
        runOnJS(Vibration.vibrate)(12);
      }
    },
    onEnd: (event) => {
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      const shouldSwipeDown = event.translationY > SWIPE_DOWN_THRESHOLD;

      const finishSwipe = () => {
        translateX.value = 0;
        translateY.value = 0;
        scale.value = withSpring(1);
        // IMPORTANT: Don't call moveToNextCard - let parent handle index advancing
      };

      if (shouldSwipeDown) {
        // Swipe down to skip
        runOnJS(handleSkipWithAnimation)();
      } else if (shouldSwipeRight) {
        runOnJS(Vibration.vibrate)(25);
        runOnJS(handleVote)('hot');
        translateX.value = withSpring(
          width * 1.5,
          { damping: 15, stiffness: 120, mass: 0.8 }, // Smoother animation
          finishSwipe
        );
      } else if (shouldSwipeLeft) {
        runOnJS(Vibration.vibrate)(25);
        runOnJS(handleVote)('not');
        translateX.value = withSpring(
          -width * 1.5,
          { damping: 15, stiffness: 120, mass: 0.8 },
          finishSwipe
        );
      } else {
        // Soft haptic feedback for bounce back
        runOnJS(Vibration.vibrate)(8);
        finishSwipe();
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width, 0, width],
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [1, 0.7],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
      opacity,
      zIndex: 2, // Ensure current card is above next card
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    // Scale up next card as current card swipes away
    const nextScale = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.95, 1],
      Extrapolate.CLAMP
    );
    const nextOpacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.5, 1],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ 
        scale: withSpring(nextScale, {
          damping: 99,
          stiffness: 0.1,
          mass: 0.1
        })
      }],
      opacity: withSpring(nextOpacity, {
        damping: 90,
        stiffness: 0.1,
        mass: 0.1
      }),
      zIndex: 1, // Keep below current card
    };
  });

  const hotOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const notOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const skipOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, SWIPE_DOWN_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  // Show end screen only when truly no more content
  const noCards = safeTakes.length === 0;
  const atEnd = currentIndex >= safeTakes.length;

  if (noCards || (atEnd && !hasMore && !loading)) {
    return (
      <View style={styles.container}>
        <View style={styles.endContainer}>
          <Text style={styles.endEmoji}>🎉</Text>
          <Text style={[styles.endTitle, { color: theme.text }]}>
            {noCards ? 'No takes available yet!' : 'You\'ve reached the end!'}
          </Text>
          <Text style={[styles.endMessage, { color: theme.textSecondary }]}>
            {noCards 
              ? 'Be the first to submit a hot take!'
              : 'Submit more takes to keep the conversation going!'
            }
          </Text>
          
          {onSubmitTake && (
            <AnimatedPressable
              style={[styles.submitButton, { backgroundColor: theme.primary }]}
              onPress={onSubmitTake}
              scaleValue={0.95}
              hapticIntensity={15}
            >
              <Text style={styles.submitButtonText}>✏️ Submit Take</Text>
            </AnimatedPressable>
          )}
          
          <Text style={[styles.endHint, { color: theme.textSecondary, opacity: 0.7 }]}>
            Tap the clipboard icon (📋) to see all your takes
          </Text>
        </View>
      </View>
    );
  }

  // If at end but still has more or loading, show empty container (loading happens in background)
  if (atEnd && (loading || hasMore)) {
    if (loadMore && !loading) loadMore(20).catch(console.error);
    return <View style={styles.container} />;
  }

  const currentTake = safeTakes[currentIndex];
  const nextTake = safeTakes[nextIndex];

  return (
    <View style={styles.container}>
      <VoteIndicator vote={currentVote} isDarkMode={isDarkMode} />
      
      {/* Next card (background) */}
      {nextTake && (
        <Animated.View style={[styles.cardContainer, styles.nextCard, nextCardStyle]}>
          <TakeCard take={nextTake} isDarkMode={isDarkMode} />
        </Animated.View>
      )}
      
      {/* Current card (foreground) */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.cardContainer, animatedStyle]}>
          <TakeCard 
            take={currentTake} 
            isDarkMode={isDarkMode}
            onNotPress={() => handleButtonVote('not')}
            onHotPress={() => handleButtonVote('hot')}
          />
          
          {/* Overlay indicators */}
          <Animated.View style={[styles.overlayLeft, { backgroundColor: theme.not }, notOverlayStyle]}>
            <Text style={styles.overlayText}>NOT</Text>
          </Animated.View>
          
          <Animated.View style={[styles.overlayRight, { backgroundColor: theme.hot }, hotOverlayStyle]}>
            <Text style={styles.overlayText}>HOT</Text>
          </Animated.View>

          <Animated.View style={[styles.overlayBottom, { backgroundColor: 'rgba(0,0,0,0.8)' }, skipOverlayStyle]}>
            <Text style={styles.overlayText}>SKIP</Text>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
      
      {/* Skip Button */}
      <AnimatedPressable 
        style={styles.skipButton} 
        onPress={handleSkipWithAnimation}
        scaleValue={0.9}
        hapticIntensity={12}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
      </AnimatedPressable>

      {/* Instructions Button */}
      {onShowInstructions && (
        <AnimatedPressable 
          style={[styles.skipButton, styles.instructionsButton]} 
          onPress={onShowInstructions}
          scaleValue={0.9}
          hapticIntensity={8}
        >
          <Text style={[styles.skipButtonText, styles.instructionsButtonText]}>
            ❓ Instructions
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    bottom: 110
  },
  nextCard: {
    // Static styles moved to nextCardStyle for animation
  },
  endContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.xl,
    paddingVertical: dimensions.spacing.xl,
  },
  // Removed endScrollContainer - no longer needed
  endEmoji: {
    fontSize: 64,
    marginBottom: dimensions.spacing.lg,
  },
  endTitle: {
    fontSize: dimensions.fontSize.xxlarge,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: dimensions.spacing.md,
  },
  endMessage: {
    fontSize: dimensions.fontSize.large,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: dimensions.spacing.lg,
  },
  endHint: {
    fontSize: dimensions.fontSize.medium,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  // Removed pullHint - no longer needed
  submitButton: {
    paddingHorizontal: dimensions.spacing.xl,
    paddingVertical: dimensions.spacing.md,
    borderRadius: 25,
    marginVertical: dimensions.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  overlayLeft: {
    position: 'absolute',
    top: 50,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '15deg' }],
  },
  overlayRight: {
    position: 'absolute',
    top: 50,
    left: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    position: 'absolute',
    bottom: 65,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  skipButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsButton: {
    bottom: 15, // Position below skip button
    backgroundColor: 'rgba(255, 107, 107, 0.95)', // More vibrant - less transparency
  },
  instructionsButtonText: {
    fontSize: 14,
  },
});