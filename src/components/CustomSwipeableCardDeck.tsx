import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  Text,
  Vibration,
  Platform,
  RefreshControl,
  ScrollView,
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
  withTiming,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';
import { Take } from '../types';
import { TakeCard } from './TakeCard';
import { VoteIndicator } from './VoteIndicator';
import { AnimatedPressable } from './transitions/AnimatedPressable';
import { dimensions, colors } from '../constants';
import { useResponsive } from '../hooks/useResponsive';

interface CustomSwipeableCardDeckProps {
  takes: Take[];
  onVote: (takeId: string, vote: 'hot' | 'not') => void;
  onSkip: (takeId: string) => void;
  onSubmitTake?: () => void;
  onShowInstructions?: () => void;
  isDarkMode?: boolean;
  hasMore?: boolean;
  loadMore?: (count?: number) => Promise<void>;
  refreshTakes?: () => Promise<void>;
  loading?: boolean;
  externalStatsCard?: {take: Take, vote: 'hot' | 'not' | null} | null;
  onExternalStatsCardDismiss?: () => void;
  onShowRecentVotes?: () => void;
  onChangeVote?: (take: Take) => void;
  totalVotes?: number;
}

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.2;
const SWIPE_DOWN_THRESHOLD = height * 0.2; // 20% of screen height
const SWIPE_UP_THRESHOLD = height * 0.2; // 20% of screen height for upward swipe

// Safe flip for Android - no 3D to avoid compositor crashes
const ANDROID_SAFE_FLIP = Platform.OS === 'android';

// Stable style object to avoid reparenting during 3D flips
const absoluteFill = StyleSheet.absoluteFillObject;

export const CustomSwipeableCardDeck: React.FC<CustomSwipeableCardDeckProps> = ({
  takes,
  onVote,
  onSkip,
  onSubmitTake,
  onShowInstructions,
  isDarkMode = false,
  hasMore = true,
  loadMore,
  refreshTakes,
  loading = false,
  externalStatsCard = null,
  onExternalStatsCardDismiss,
  onShowRecentVotes,
  onChangeVote,
  totalVotes = 0,
}) => {
  const responsive = useResponsive();
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | null>(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [lastVote, setLastVote] = useState<'hot' | 'not' | null>(null);
  const [autoDismissTimeout, setAutoDismissTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Track if we should end after dismissing stats (when there's no next card)
  const endAfterDismissRef = React.useRef(false);
  
  // Debounce loadMore to prevent hammering
  const lastLoadTsRef = React.useRef(0);
  const DEBOUNCE_MS = 900;
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isAnimating = useSharedValue(false);
  
  // 0 = front, 1 = back (stats)
  const flipSV = useSharedValue(0);
  
  // Freeze system to prevent promotion flicker
  const frozenCurrent = React.useRef<Take | null>(null);
  const frozenNext = React.useRef<Take | null>(null);
  const [useFrozen, setUseFrozen] = useState(false);
  
  // Drives the local promotion animation of the next card
  const promoteSV = useSharedValue(0);
  
  // Reactive shared values for worklets (prevents stale boolean capture)
  const frozenSV = useSharedValue(0);
  const flippedSV = useSharedValue(0);
  const animatingSV = useSharedValue(0);
  
  // Safety gate for gestures - prevent interaction when no current card
  const hasCurrentSV = useSharedValue(0);

  useEffect(() => { frozenSV.value = useFrozen ? 1 : 0; }, [useFrozen]);
  useEffect(() => { flippedSV.value = isCardFlipped ? 1 : 0; }, [isCardFlipped]);

  // Cleanup auto-dismiss timeout on unmount
  useEffect(() => {
    return () => {
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
      }
    };
  }, [autoDismissTimeout]);

  // Handle external stats card
  useEffect(() => {
    if (externalStatsCard) {
      // Clear any existing timeout since this is manual
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        setAutoDismissTimeout(null);
      }
      
      // Set the external stats card as the current flipped state
      setIsCardFlipped(true);
      setLastVote(externalStatsCard.vote);
      setCurrentVote(null); // No current vote since this is historical
      
      // Set the flip animation to show the stats
      flipSV.value = 1;
      promoteSV.value = 1;
      animatingSV.value = 0;
    }
  }, [externalStatsCard]);

  // Ensure takes is always an array
  const safeTakes = takes || [];

  // Always use first three items for smooth transitions
  const currentTake = safeTakes[0];
  const nextTake = safeTakes[1];
  const thirdTake = safeTakes[2];
  
  // Derive what to render - external stats card takes priority, then frozen data during promotion, then live props
  const renderCurrent = externalStatsCard ? externalStatsCard.take : 
    (useFrozen && frozenCurrent.current ? frozenCurrent.current : currentTake);
  const renderNext = useFrozen && frozenNext.current ? frozenNext.current : nextTake;
  
  // Update safety gate for gestures based on current card availability
  useEffect(() => { hasCurrentSV.value = !!renderCurrent ? 1 : 0; }, [renderCurrent]);

  // If we run out of takes, clean up frozen state to prevent crashes
  useEffect(() => {
    if (!currentTake && !nextTake && useFrozen && !isCardFlipped) {
      console.log('🚨 No more takes - cleaning up frozen state');
      // Direct state update - safe in effects
      setUseFrozen(false);
      frozenCurrent.current = null;
      frozenNext.current = null;
      promoteSV.value = 0;
    }
  }, [currentTake, nextTake, useFrozen, isCardFlipped]);

  // Auto-load more when getting low on cards (with debounce)
  useEffect(() => {
    if (!loadMore || loading || !hasMore) return;
    if (safeTakes.length > 5) return;
    
    const now = Date.now();
    if (now - lastLoadTsRef.current < DEBOUNCE_MS) return;
    
    lastLoadTsRef.current = now;
    loadMore(20).catch(console.error);
  }, [safeTakes.length, hasMore, loading, loadMore]);
  
  // Safe cleanup effect - if frozen but nothing to render, unfreeze
  useEffect(() => {
    if (!renderCurrent && useFrozen) {
      setUseFrozen(false);
      frozenCurrent.current = null;
      frozenNext.current = null;
      promoteSV.value = 0;
    }
  }, [renderCurrent, useFrozen, promoteSV]);

  const theme = isDarkMode ? colors.dark : colors.light;

  // Handle pull-to-refresh on end screen
  const handleRefresh = async () => {
    // Prefer refreshTakes for a full refresh, fallback to loadMore
    const refreshFunction = refreshTakes || loadMore;
    if (!refreshFunction) return;
    
    setRefreshing(true);
    try {
      // Force a fresh load attempt - refreshTakes will reset and reload
      await refreshFunction();
    } catch (error) {
      console.error('Error refreshing takes:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // JS-thread helpers for runOnJS
  const jsSetVote = (val: 'hot' | 'not' | null) => setCurrentVote(val);
  const jsOnSkip = (id: string) => onSkip(id);
  const jsSetAutoDismiss = () => {
    const timeout = setTimeout(() => {
      continueToNext();
    }, 1200);
    setAutoDismissTimeout(timeout);
  };
  
  // Flip the card to reveal stats
  const flipCard = (vote: 'hot' | 'not') => {
    if (!renderCurrent) return; // Safety check
    
    setLastVote(vote);
    
    // 🧊 FREEZE: Capture current state immediately when vote is cast
    // Capture the current card BEFORE it gets removed
    frozenCurrent.current = renderCurrent;
    // Only capture next if it exists
    if (renderNext) {
      frozenNext.current = renderNext;
      endAfterDismissRef.current = false;
    } else {
      frozenNext.current = null;
      endAfterDismissRef.current = true; // no next; after stats we should end
    }
    // MUST set frozen BEFORE the animation to lock in the card
    setUseFrozen(true);
    
    // Store the vote details but DON'T submit yet
    const voteToSubmit = { id: renderCurrent.id, vote };
    
    // Set animating flag and bounce micro-scale then flip
    animatingSV.value = 1;
    scale.value = withSpring(0.96, {}, () => {
      'worklet';
      flipSV.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(setIsCardFlipped)(true); // set after flip completes
          // NOW submit the vote after the flip is complete and stats are showing
          runOnJS(onVote)(voteToSubmit.id, voteToSubmit.vote);
          // Auto-dismiss stats card after 2.5 seconds
          runOnJS(jsSetAutoDismiss)();
          // Start promoting next card behind the stats card
          promoteSV.value = withTiming(1, { duration: 300 }, () => {
            'worklet';
            animatingSV.value = 0; // Clear animation flag
          });
        }
      });
      scale.value = withSpring(1);
    });
  };
  
  // Handle change vote - dismiss stats card and trigger the change vote callback
  const handleChangeVote = (take: Take) => {
    if (onChangeVote) {
      // Call the change vote function first
      onChangeVote(take);
      
      // Then dismiss the stats card properly
      continueToNext(true);
    }
  };

  // Continue to next card after reveal - promotion already happened behind stats
  const continueToNext = (skipAnimation = false) => {
    if (isAnimating.value) return;
    
    // Clear auto-dismiss timeout if it exists
    if (autoDismissTimeout) {
      clearTimeout(autoDismissTimeout);
      setAutoDismissTimeout(null);
    }
    
    // If this is an external stats card, dismiss it properly
    if (externalStatsCard && onExternalStatsCardDismiss) {
      // Reset all animation values immediately
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      flipSV.value = 0;
      promoteSV.value = 0;
      animatingSV.value = 0;
      
      // Reset state
      setIsCardFlipped(false);
      setLastVote(null);
      setCurrentVote(null);
      
      // Clear timeout
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        setAutoDismissTimeout(null);
      }
      
      onExternalStatsCardDismiss();
      return;
    }
    
    isAnimating.value = true;
    
    const resetAll = () => {
      'worklet';
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      flipSV.value = 0;
      promoteSV.value = 0;
      runOnJS(setIsCardFlipped)(false);
      runOnJS(setLastVote)(null);
      runOnJS(setCurrentVote)(null);
      runOnJS(setUseFrozen)(false);
      isAnimating.value = false;
    };
    
    if (skipAnimation) {
      resetAll();
    } else {
      translateX.value = withTiming(0, { duration: 200 }, resetAll);
    }
    
    // If we knew there was no next at the time we froze, we're done.
    if (endAfterDismissRef.current) {
      endAfterDismissRef.current = false; // consume the flag
      // Nothing else to do; the normal render pass will show the end screen
    }
  };

  // Safety check: if current take is somehow undefined but we have takes, log error
  if (!currentTake && safeTakes.length > 0) {
    console.error('⚠️ No current take but safeTakes has items! This should not happen.');
  }

  // Handle button press - now triggers pronounced swipe animation then flip
  const handleButtonVote = (vote: 'hot' | 'not') => {
    if (!currentTake || isAnimating.value || isCardFlipped || externalStatsCard) return;
    
    // Show vote indicator just like swipe gestures do
    setCurrentVote(vote);
    
    // Simulate dramatic swipe animation - more pronounced than gesture
    const direction = vote === 'hot' ? 1 : -1; // right for hot, left for not
    const swipeDistance = SWIPE_THRESHOLD * 0.8; // Much bigger swipe for impact
    
    // Quick leap to edge with timing (no lingering)
    translateX.value = withTiming(swipeDistance * direction, { 
      duration: 150, // Quick leap
      easing: Easing.out(Easing.quad)
    }, () => {
      'worklet';
      // Immediate bouncy return
      translateX.value = withSpring(0, { damping: 15, stiffness: 300 });
      translateY.value = withSpring(0);
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      runOnJS(Vibration.vibrate)(30);
      runOnJS(flipCard)(vote);
    });
    
    // Quick scale down
    scale.value = withTiming(0.92, { duration: 150, easing: Easing.out(Easing.quad) });
  };

  // Handle skip with animation (for both button press and swipe up/down)
  const handleSkipWithAnimation = (direction: 'up' | 'down' = 'down') => {
    if (!currentTake || isAnimating.value || externalStatsCard) return;
    
    // 🧊 FREEZE: Capture current state immediately when skip is triggered
    if (renderCurrent) {
      frozenCurrent.current = renderCurrent;
      // Only capture next if it exists
      if (renderNext) {
        frozenNext.current = renderNext;
        endAfterDismissRef.current = false;
      } else {
        frozenNext.current = null;
        endAfterDismissRef.current = true;
      }
      // MUST set frozen BEFORE calling onSkip to prevent end screen flash
      setUseFrozen(true);
      
      // Use requestAnimationFrame to ensure state updates are flushed
      requestAnimationFrame(() => {
        // Submit skip after freeze state is committed
        onSkip(renderCurrent.id);
      });
    }
    
    isAnimating.value = true;
    animatingSV.value = 1;
    Vibration.vibrate(15);
    
    // Animate up or down based on direction
    const targetY = direction === 'up' ? -height * 0.8 : height * 0.8;
    
    translateY.value = withSpring(
      targetY,
      { damping: 15, stiffness: 120, mass: 0.8 },
      () => {
        'worklet';
        // Start promoting next card during return animation
        promoteSV.value = withTiming(1, { duration: 200 }, () => {
          'worklet';
          // Reset everything for next card
          translateX.value = 0;
          translateY.value = 0;
          scale.value = 1;
          runOnJS(setUseFrozen)(false); // 🔓 UNFREEZE
          animatingSV.value = 0;
          isAnimating.value = false;
        });
      }
    );
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      if (isAnimating.value || !hasCurrentSV.value) return; // ignore new gestures mid-flight or no card
      scale.value = withSpring(0.95);
      runOnJS(Vibration.vibrate)(10);
    },
    onActive: (event) => {
      if (isAnimating.value || !hasCurrentSV.value) return;
      
      // Allow dragging the stats card too
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      
      // Only show vote indicators when NOT flipped (front card only) and not showing external stats
      if (!flippedSV.value && !externalStatsCard) {
        // Vote indicator based on swipe direction
        const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
        const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
        const shouldSwipeDown = event.translationY > SWIPE_DOWN_THRESHOLD;
        const shouldSwipeUp = event.translationY < -SWIPE_UP_THRESHOLD;
        
        // Update vote indicator
        if (shouldSwipeRight) {
          runOnJS(jsSetVote)('hot');
        } else if (shouldSwipeLeft) {
          runOnJS(jsSetVote)('not');
        } else if (shouldSwipeDown || shouldSwipeUp) {
          runOnJS(jsSetVote)(null); // Clear vote for skip
        } else {
          runOnJS(jsSetVote)(null); // Clear vote when not at threshold
        }
        
        // Horizontal swipe feedback
        if ((shouldSwipeRight || shouldSwipeLeft) && Math.abs(event.translationX) > SWIPE_THRESHOLD && Math.abs(event.translationX) < SWIPE_THRESHOLD + 20) {
          runOnJS(Vibration.vibrate)(15);
        }
        
        // Down swipe feedback
        if (shouldSwipeDown && Math.abs(event.translationY) > SWIPE_DOWN_THRESHOLD && Math.abs(event.translationY) < SWIPE_DOWN_THRESHOLD + 30) {
          runOnJS(Vibration.vibrate)(12);
        }
        
        // Up swipe feedback
        if (shouldSwipeUp && Math.abs(event.translationY) > SWIPE_UP_THRESHOLD && Math.abs(event.translationY) < SWIPE_UP_THRESHOLD + 30) {
          runOnJS(Vibration.vibrate)(12);
        }
      }
    },
    onEnd: (event) => {
      if (isAnimating.value || !hasCurrentSV.value) return;
      
      // If card is flipped (showing stats), any swipe continues to next
      if (flippedSV.value) {
        // Check if they actually swiped (not just a tap)
        const didSwipe = Math.abs(event.translationX) > 20 || Math.abs(event.translationY) > 20;
        // Continue immediately with no animation if they swiped
        runOnJS(continueToNext)(didSwipe);
        return;
      }
      
      // Don't allow voting on external stats cards - they're just for viewing
      if (externalStatsCard) {
        // Spring back to original position
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        return;
      }
      
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      const shouldSwipeDown = event.translationY > SWIPE_DOWN_THRESHOLD;
      const shouldSwipeUp = event.translationY < -SWIPE_UP_THRESHOLD;

      const id = currentTake?.id; // snapshot (may be undefined)
      const reset = () => {
        'worklet';
        translateX.value = 0;
        translateY.value = 0;
        scale.value = withSpring(1);
      };

      if ((shouldSwipeDown || shouldSwipeUp) && id) {
        // Use the same skip logic as button press for consistency (both up and down skip)
        // Pass direction based on which way they swiped
        const direction = shouldSwipeUp ? 'up' : 'down';
        runOnJS(handleSkipWithAnimation)(direction);
        return;
      }

      if (shouldSwipeRight && id && !flippedSV.value) {
        // Front side: Bounce back and flip to reveal
        runOnJS(Vibration.vibrate)(25);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        runOnJS(flipCard)('hot');
        return;
      }

      if (shouldSwipeLeft && id && !flippedSV.value) {
        // Front side: Bounce back and flip to reveal
        runOnJS(Vibration.vibrate)(25);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        runOnJS(flipCard)('not');
        return;
      }

      // bounce back - clear vote indicator
      runOnJS(Vibration.vibrate)(8);
      runOnJS(jsSetVote)(null); // Clear vote indicator
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
    },
  });

  // Outer card gets perspective so the 3D reads nicely
  const card3DStyle = useAnimatedStyle(() => {
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
        { perspective: 1000 }, // 3D space
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
      opacity,
      zIndex: flippedSV.value || animatingSV.value ? 150 : 100, // Higher during animation but below UI elements (footer: 200)
      elevation: flippedSV.value || animatingSV.value ? 6 : 4, // Android layering fix
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    // When frozen, animate by promoteSV only (0 -> 1), otherwise use drag progress
    const p = frozenSV.value ? promoteSV.value : Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    const nextScale = 0.98 + 0.02 * p;
    const nextTranslateY = 8 * (1 - p);

    return {
      transform: [
        { scale: nextScale },
        { translateY: nextTranslateY },
      ],
      opacity: 1,
      zIndex: frozenSV.value ? 80 : 50, // Higher during promotion, but lower than current card
      elevation: frozenSV.value ? 3 : 2, // Android layering fix
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0, // Fill full container height
    };
  });

  // 3D flip animations
  const frontFaceStyle = useAnimatedStyle(() => {
    if (ANDROID_SAFE_FLIP) {
      return { 
        opacity: 1 - flipSV.value,
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0, // Fill full container height
      };
    }
    const deg = interpolate(flipSV.value, [0, 1], [0, 180]);
    const opacity = interpolate(flipSV.value, [0, 0.45, 0.5], [1, 1, 0], Extrapolate.CLAMP);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }],
      opacity,
      backfaceVisibility: 'hidden' as const,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0, // Fill full container height
    };
  });
  
  const backFaceStyle = useAnimatedStyle(() => {
    if (ANDROID_SAFE_FLIP) {
      return { 
        opacity: flipSV.value,
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0, // ADD MISSING BOTTOM
      };
    }
    const deg = interpolate(flipSV.value, [0, 1], [180, 360]);
    const opacity = interpolate(flipSV.value, [0.5, 0.55, 1], [0, 1, 1], Extrapolate.CLAMP);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }],
      opacity,
      backfaceVisibility: 'hidden' as const,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0, // Fill full container height
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
    const downOpacity = interpolate(
      translateY.value,
      [0, SWIPE_DOWN_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );
    const upOpacity = interpolate(
      translateY.value,
      [-SWIPE_UP_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    );
    return { opacity: Math.max(downOpacity, upOpacity) };
  });

  // Third card style - sits behind next card (MUST be before any returns!)
  const thirdCardStyle = useAnimatedStyle(() => {
    const thirdScale = 0.96;
    const thirdTranslateY = 16;

    return {
      transform: [
        { scale: thirdScale },
        { translateY: thirdTranslateY },
      ],
      opacity: 1,
      zIndex: 25,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0, // Fill full container height
    };
  });

  // Create dynamic styles with responsive card height - MUST be before any returns
  const dynamicStyles = React.useMemo(() => ({
    cardContainer: {
      // backgroundColor: 'orange',
      position: 'relative' as const, // Use relative positioning to respect flexibleMiddle
      alignItems: 'center' as const,
      justifyContent: 'flex-start' as const,
      flex: 1, // Fill available flexibleMiddle space - let flexibleMiddle constrain the height
    }
  }), []);

  // Simplified end screen detection that can't get stuck
  const noCards = safeTakes.length === 0;
  const nothingToRender = !renderCurrent; // already accounts for external/frozen priority
  // Don't show end screen if we're frozen (showing stats) or flipped
  const shouldShowEnd = !useFrozen && !isCardFlipped && nothingToRender && !loading && (!hasMore || noCards);
  if (shouldShowEnd) {
    return (
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            title="Pull down to check for new takes"
            titleColor={theme.textSecondary}
          />
        }
      >
        <View style={styles.endContainer}>
          <Text style={styles.endEmoji}>🎉</Text>
          <Text style={[styles.endTitle, { color: theme.text }]}>
            {noCards ? 'No takes available yet!' : 'You\'ve reached the end!'}
          </Text>
          <Text style={[styles.endMessage, { color: theme.textSecondary }]}>
            {noCards 
              ? 'Submit a new hot take to keep the fun going!'
              : 'Submit more takes to keep the fun going!'
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
            Tap the memo icon 📝 to see all your takes
          </Text>
          
          <Text style={[styles.pullHint, { color: theme.textSecondary, opacity: 0.5, marginTop: 20 }]}>
            Pull down to check for new takes
          </Text>
        </View>
      </ScrollView>
    );
  }

  // If at end but still has more or loading, show empty container (loading happens in background)
  if (nothingToRender && (loading || hasMore) && !useFrozen && !isCardFlipped) {
    if (loadMore && !loading) {
      const now = Date.now();
      if (now - lastLoadTsRef.current >= DEBOUNCE_MS) {
        lastLoadTsRef.current = now;
        loadMore(20).catch(console.error);
      }
    }
    return <View style={styles.container} />;
  }
  
  // The cleanup effect handles the frozen state - no need for fallback here

  return (
    <View style={styles.container}>
      <VoteIndicator vote={currentVote} isDarkMode={isDarkMode} />
      
      {/* Third card (furthest back - prevents flicker during promotion) */}
      <Animated.View 
        key="third-slot" 
        style={[dynamicStyles.cardContainer, styles.nextCard, thirdCardStyle]}
        pointerEvents="none"
        collapsable={false}
      >
        {thirdTake ? (
          <TakeCard 
            take={thirdTake} 
            isDarkMode={isDarkMode} 
            showStats={false}
          />
        ) : (
          <View style={{ width: 1, height: 1 }} />
        )}
      </Animated.View>
      
      {/* Next card (background - always mounted) */}
      <Animated.View 
        key="next-slot" 
        style={[dynamicStyles.cardContainer, styles.nextCard, nextCardStyle]}
        pointerEvents="none"
        collapsable={false}
      >
        {renderNext ? (
          <TakeCard 
            take={renderNext} 
            isDarkMode={isDarkMode} 
            showStats={false}
          />
        ) : (
          <View style={{ width: 1, height: 1 }} />
        )}
      </Animated.View>
      
      {/* Current card (foreground) - Front and Back views */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View 
          key="current-slot" 
          style={[dynamicStyles.cardContainer, card3DStyle]}
          collapsable={false}
        >
          {/* 👻 Invisible sizer only when we actually have a card */}
          {!!renderCurrent && (
            <View pointerEvents="none" style={styles.ghostSizer}>
              <TakeCard
                take={renderCurrent}
                isDarkMode={isDarkMode}
                showStats={false}
              />
            </View>
          )}
          
          {/* FRONT */}
          {!!renderCurrent && (
            <Animated.View
              style={[frontFaceStyle]}
              pointerEvents={isCardFlipped ? 'none' : 'auto'}
            >
              <TakeCard
                take={renderCurrent}
                isDarkMode={isDarkMode}
                onNotPress={() => handleButtonVote('not')}
                onHotPress={() => handleButtonVote('hot')}
                showStats={false}
                userVote={null}
                isFlipped={false}
              />
            </Animated.View>
          )}

          {/* BACK (stats) */}
          {!!renderCurrent && (
            <Animated.View
              style={[backFaceStyle]}
              pointerEvents={isCardFlipped ? 'auto' : 'none'}
            >
              <TakeCard
                take={{
                  ...renderCurrent,
                  // For external stats cards, don't add optimistic votes since they're historical
                  // For regular votes, add optimistic single-vote bump so stats include user's vote
                  hotVotes: renderCurrent.hotVotes + (!externalStatsCard && lastVote === 'hot' ? 1 : 0),
                  notVotes: renderCurrent.notVotes + (!externalStatsCard && lastVote === 'not' ? 1 : 0),
                  totalVotes: renderCurrent.totalVotes + (!externalStatsCard && lastVote ? 1 : 0),
                }}
                isDarkMode={isDarkMode}
                showStats={true}
                userVote={lastVote}
                isFlipped={true}
                onChangeVote={handleChangeVote}
              />
            </Animated.View>
          )}
          
          {/* Overlay indicators - hidden when flipped */}
          {!isCardFlipped && (
            <>
              <Animated.View style={[styles.overlayLeft, { backgroundColor: theme.hot }, hotOverlayStyle]}>
                <Text style={styles.overlayText}>HOT</Text>
              </Animated.View>
              
              <Animated.View style={[styles.overlayRight, { backgroundColor: theme.not }, notOverlayStyle]}>
                <Text style={styles.overlayText}>NOT</Text>
              </Animated.View>

              <Animated.View style={[styles.overlayBottom, { backgroundColor: 'rgba(0,0,0,0.8)' }, skipOverlayStyle]}>
                <Text style={styles.overlayText}>SKIP</Text>
              </Animated.View>
            </>
          )}
        </Animated.View>
      </PanGestureHandler>
      
      
      {/* One-frame blocker to avoid any compositor seam */}
      {useFrozen && <View pointerEvents="none" style={StyleSheet.absoluteFill} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start', // Position at top of available space
  },
  cardContainer: {
    // backgroundColor: 'orange',
    position: 'absolute', // Position absolutely within flexibleMiddle
    top: 10, // Small margin from top of flexibleMiddle
    left: dimensions.spacing.lg, // Add left margin
    right: dimensions.spacing.lg, // Add right margin
    // height: 400, // Fixed height to prevent covering buttons - will make dynamic
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: undefined, // Remove width constraint since we're using left/right
  },
  nextCard: {
    // Static styles moved to nextCardStyle for animation
  },
  cardBack: {
    backfaceVisibility: 'hidden',
  },
  ghostSizer: {
    opacity: 0, // invisible, but participates in layout
    position: 'absolute', // Don't affect layout
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
  pullHint: {
    fontSize: dimensions.fontSize.small,
    textAlign: 'center',
    marginTop: dimensions.spacing.md,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    right: 5,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '15deg' }],
  },
  overlayRight: {
    position: 'absolute',
    top: 50,
    left: 5,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  overlayBottom: {
    // position: 'absolute',
    // bottom: dimensions.spacing.xxl * 2.5,
    top: '50%',
    // left: 0,
    // right: 0,
    width: 300,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});