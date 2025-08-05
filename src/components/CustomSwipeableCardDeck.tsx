import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  Text,
  ScrollView,
  RefreshControl,
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
  onEndReached?: () => void;
  onLoadMore?: () => Promise<void>;
  onSubmitTake?: () => void;
  isDarkMode?: boolean;
}

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

export const CustomSwipeableCardDeck: React.FC<CustomSwipeableCardDeckProps> = ({
  takes,
  onVote,
  onSkip,
  onEndReached,
  onLoadMore,
  onSubmitTake,
  isDarkMode = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const theme = isDarkMode ? colors.dark : colors.light;

  const handleLoadMore = async () => {
    if (!onLoadMore || isLoadingMore) return;
    
    try {
      setIsLoadingMore(true);
      await onLoadMore();
    } catch (error) {
      console.error('Error loading more content:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Ensure takes is always an array
  const safeTakes = takes || [];

  const handleVote = (vote: 'hot' | 'not') => {
    if (currentIndex < safeTakes.length) {
      const currentTake = safeTakes[currentIndex];
      onVote(currentTake.id, vote);
      
      // Show vote indicator with better visibility
      setCurrentVote(vote);
      setTimeout(() => setCurrentVote(null), 800);
      
      // Move to next card immediately
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      // Check if we've reached the end
      if (nextIndex >= safeTakes.length) {
        setTimeout(() => {
          onEndReached?.();
        }, 500);
      }
    }
  };

  const handleSkip = () => {
    if (currentIndex < safeTakes.length) {
      // Haptic feedback for skip action
      Vibration.vibrate(12);
      
      const currentTake = safeTakes[currentIndex];
      onSkip(currentTake.id);
      
      // Move to next card immediately
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      // Check if we've reached the end
      if (nextIndex >= safeTakes.length) {
        setTimeout(() => {
          onEndReached?.();
        }, 500);
      }
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
      translateY.value = event.translationY * 0.1; // Subtle vertical movement
      
      // Provide haptic feedback when reaching swipe threshold
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      
      if ((shouldSwipeRight || shouldSwipeLeft) && Math.abs(event.translationX) > SWIPE_THRESHOLD && Math.abs(event.translationX) < SWIPE_THRESHOLD + 20) {
        runOnJS(Vibration.vibrate)(15);
      }
    },
    onEnd: (event) => {
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;

      if (shouldSwipeRight) {
        // Strong haptic feedback for successful swipe
        runOnJS(Vibration.vibrate)(25);
        translateX.value = withSpring(width * 1.5, { damping: 15, stiffness: 120 }, () => {
          runOnJS(handleVote)('hot');
          // Reset position immediately for the next card
          translateX.value = 0;
          translateY.value = 0;
        });
      } else if (shouldSwipeLeft) {
        // Strong haptic feedback for successful swipe
        runOnJS(Vibration.vibrate)(25);
        translateX.value = withSpring(-width * 1.5, { damping: 15, stiffness: 120 }, () => {
          runOnJS(handleVote)('not');
          // Reset position immediately for the next card
          translateX.value = 0;
          translateY.value = 0;
        });
      } else {
        // Soft haptic feedback for bounce back
        runOnJS(Vibration.vibrate)(8);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
      
      scale.value = withSpring(1);
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

  if (currentIndex >= safeTakes.length) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.endScrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingMore}
              onRefresh={handleLoadMore}
              tintColor={theme.primary}
              title="Pull down to load more hot takes"
              titleColor={theme.textSecondary}
            />
          }
        >
          <View style={styles.endContainer}>
            <Text style={styles.endEmoji}>🎉</Text>
            <Text style={[styles.endTitle, { color: theme.text }]}>
              {safeTakes.length === 0 ? 'No takes available yet!' : 'You\'ve reached the end!'}
            </Text>
            <Text style={[styles.endMessage, { color: theme.textSecondary }]}>
              {isLoadingMore 
                ? 'Loading more hot takes...' 
                : 'Pull down to load more content!'
              }
            </Text>
            
            {onLoadMore && (
              <Text style={[styles.pullHint, { color: theme.primary }]}>
                {isLoadingMore ? '⏳' : '⬇️ Pull Down ⬇️'}
              </Text>
            )}
            
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
              {safeTakes.length === 0 
                ? 'Or submit your own hot takes!'
                : 'Or tap the clipboard icon (📋) to see your takes'
              }
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const currentTake = safeTakes[currentIndex];
  const nextTake = safeTakes[currentIndex + 1];

  return (
    <View style={styles.container}>
      <VoteIndicator vote={currentVote} isDarkMode={isDarkMode} />
      
      {/* Next card (background) */}
      {nextTake && (
        <View style={[styles.cardContainer, styles.nextCard]}>
          <TakeCard take={nextTake} isDarkMode={isDarkMode} />
        </View>
      )}
      
      {/* Current card (foreground) */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.cardContainer, animatedStyle]}>
          <TakeCard take={currentTake} isDarkMode={isDarkMode} />
          
          {/* Overlay indicators */}
          <Animated.View style={[styles.overlayLeft, notOverlayStyle]}>
            <Text style={styles.overlayText}>NOT</Text>
          </Animated.View>
          
          <Animated.View style={[styles.overlayRight, hotOverlayStyle]}>
            <Text style={styles.overlayText}>HOT</Text>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
      
      {/* Skip Button */}
      <AnimatedPressable 
        style={styles.skipButton} 
        onPress={handleSkip}
        scaleValue={0.9}
        hapticIntensity={12}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
      </AnimatedPressable>
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
  },
  nextCard: {
    transform: [{ scale: 0.95 }],
    opacity: 0.5,
  },
  endContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.xl,
    paddingVertical: dimensions.spacing.xl,
  },
  endScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
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
  pullHint: {
    fontSize: dimensions.fontSize.xlarge,
    textAlign: 'center',
    fontWeight: 'bold',
    marginVertical: dimensions.spacing.lg,
  },
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
    backgroundColor: '#FF3838',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '15deg' }],
  },
  overlayRight: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#FF4757',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    position: 'absolute',
    bottom: 20,
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
});