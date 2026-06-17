import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
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
import { dimensions, colors, motion } from '../constants';
import { useResponsive } from '../hooks/useResponsive';
import { vibrate } from '../utils/haptics';

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
  onChangeVote?: (take: Take, currentVote?: 'hot' | 'not' | null) => void;
  onVoteNow?: (take: Take) => void;
  communityTotalVotes?: number;
  autoAdvanceResults?: boolean;
  skipRequestToken?: number;
  identityTeaser?: { takeId: string; text: string } | null;
  onIdentityTeaserPress?: () => void;
  onVisibleResultChange?: (takeId: string | null) => void;
}

// Safe flip for Android - no 3D to avoid compositor crashes
const ANDROID_SAFE_FLIP = Platform.OS === 'android';
const VOTE_COMMIT_ARC_Y = 18;

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
  onVoteNow,
  communityTotalVotes = 0,
  autoAdvanceResults = false,
  skipRequestToken = 0,
  identityTeaser = null,
  onIdentityTeaserPress,
  onVisibleResultChange,
}) => {
  const responsive = useResponsive();
  const screenWidth = responsive.screen.width;
  const screenHeight = responsive.screen.height;
  const swipeThreshold = screenWidth * 0.2;
  const swipeDownThreshold = screenHeight * 0.2;
  const swipeUpThreshold = screenHeight * 0.2;
  const resultExitDuration = Platform.OS === 'android'
    ? motion.duration.cardResultExit + 70
    : motion.duration.cardResultExit;
  const [currentVote, setCurrentVote] = useState<'hot' | 'not' | 'skip' | null>(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [resultsRevealActive, setResultsRevealActive] = useState(false);
  const [lastVote, setLastVote] = useState<'hot' | 'not' | null>(null);
  const [autoDismissTimeout, setAutoDismissTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Track if we should end after dismissing stats (when there's no next card)
  const endAfterDismissRef = React.useRef(false);
  const landingResetTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Debounce loadMore to prevent hammering
  const lastLoadTsRef = React.useRef(0);
  const DEBOUNCE_MS = 900;
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isAnimating = useSharedValue(false);
  const cardEntranceSV = useSharedValue(1);
  
  // 0 = front, 1 = back (stats)
  const flipSV = useSharedValue(0);
  
  // Freeze system to prevent promotion flicker
  const frozenCurrent = React.useRef<Take | null>(null);
  const frozenNext = React.useRef<Take | null>(null);
  const frozenThird = React.useRef<Take | null>(null);
  const [useFrozen, setUseFrozen] = useState(false);
  const [landingTake, setLandingTake] = useState<Take | null>(null);
  const finishFrozenReset = React.useCallback(() => {
    if (landingResetTimeoutRef.current) {
      clearTimeout(landingResetTimeoutRef.current);
      landingResetTimeoutRef.current = null;
    }
    frozenCurrent.current = null;
    frozenNext.current = null;
    frozenThird.current = null;
    setLandingTake(null);
    setUseFrozen(false);
  }, []);
  
  // Drives the local promotion animation of the next card
  const promoteSV = useSharedValue(0);
  const resultExitSV = useSharedValue(0);
  
  // Reactive shared values for worklets (prevents stale boolean capture)
  const frozenSV = useSharedValue(0);
  const flippedSV = useSharedValue(0);
  const animatingSV = useSharedValue(0);
  const resultBaseSV = useSharedValue(0);
  
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
      if (landingResetTimeoutRef.current) {
        clearTimeout(landingResetTimeoutRef.current);
      }
    };
  }, [autoDismissTimeout]);

  useEffect(() => {
    if (autoAdvanceResults || !autoDismissTimeout) return;

    clearTimeout(autoDismissTimeout);
    setAutoDismissTimeout(null);
  }, [autoAdvanceResults, autoDismissTimeout]);

  // Handle external stats card
  useEffect(() => {
    if (externalStatsCard) {
      setLandingTake(null);
      resultExitSV.value = 0;
      // Clear any existing timeout since this is manual
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        setAutoDismissTimeout(null);
      }
      
      // Set the external stats card as the current flipped state
      setIsCardFlipped(true);
      setResultsRevealActive(true);
      setLastVote(externalStatsCard.vote);
      setCurrentVote(null); // No current vote since this is historical
      
      // Set the flip animation to show the stats
      flipSV.value = 1;
      promoteSV.value = 1;
      resultBaseSV.value = 0;
      animatingSV.value = 0;
    } else if (externalStatsCard === null && isCardFlipped) {
      // Reset when external stats card is dismissed
      setIsCardFlipped(false);
      setResultsRevealActive(false);
      setLastVote(null);
      setCurrentVote(null);
      setLandingTake(null);
      
      // Reset animation values
      flipSV.value = 0;
      promoteSV.value = 0;
      resultExitSV.value = 0;
      resultBaseSV.value = 0;
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
    (useFrozen ? (landingTake ?? frozenCurrent.current ?? currentTake) : currentTake);
  const promotedBaseTake = useFrozen && isCardFlipped && !externalStatsCard
    ? frozenNext.current
    : null;
  const frozenNextTake = landingTake
    ? (currentTake?.id === landingTake.id ? nextTake : thirdTake)
    : frozenNext.current;
  const renderNext = useFrozen
    ? (promotedBaseTake ? frozenThird.current : frozenNextTake)
    : nextTake;
  const renderThird = promotedBaseTake ? null : useFrozen ? frozenThird.current : thirdTake;
  const frontTake = promotedBaseTake ?? renderCurrent;
  const statsTake = externalStatsCard
    ? externalStatsCard.take
    : useFrozen
      ? frozenCurrent.current ?? renderCurrent
      : renderCurrent;

  useEffect(() => {
    if (externalStatsCard) {
      return;
    }

    onVisibleResultChange?.(isCardFlipped && statsTake ? statsTake.id : null);
  }, [externalStatsCard, isCardFlipped, onVisibleResultChange, statsTake?.id]);

  useEffect(() => {
    resultBaseSV.value = promotedBaseTake ? 1 : 0;
  }, [promotedBaseTake?.id, resultBaseSV]);

  useEffect(() => {
    if (!useFrozen || !landingTake || isCardFlipped) return;

    if (landingResetTimeoutRef.current) {
      clearTimeout(landingResetTimeoutRef.current);
    }

    const liveFeedIsReady = currentTake?.id === landingTake.id;
    landingResetTimeoutRef.current = setTimeout(() => {
      finishFrozenReset();
    }, liveFeedIsReady ? 80 : 260);

    return () => {
      if (landingResetTimeoutRef.current) {
        clearTimeout(landingResetTimeoutRef.current);
        landingResetTimeoutRef.current = null;
      }
    };
  }, [currentTake?.id, finishFrozenReset, isCardFlipped, landingTake, useFrozen]);

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
      frozenThird.current = null;
      setLandingTake(null);
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
      frozenThird.current = null;
      setLandingTake(null);
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
  const jsSetVote = (val: 'hot' | 'not' | 'skip' | null) => setCurrentVote(val);
  const jsSetAutoDismiss = () => {
    if (!autoAdvanceResults) return;

    const timeout = setTimeout(() => {
      continueToNext();
    }, 1200);
    setAutoDismissTimeout(timeout);
  };
  const finishCardDismiss = React.useCallback(() => {
    const shouldEnd = endAfterDismissRef.current;
    endAfterDismissRef.current = false;

    setIsCardFlipped(false);
    setResultsRevealActive(false);
    setLastVote(null);
    setCurrentVote(null);

    const promotedTake = !shouldEnd ? frozenNext.current : null;
    if (promotedTake) {
      frozenCurrent.current = promotedTake;
      setLandingTake(promotedTake);
      resultExitSV.value = 0;
      return;
    }

    finishFrozenReset();
    resultExitSV.value = 0;
  }, [finishFrozenReset, resultExitSV]);
  
  // Flip the card to reveal stats
  const flipCard = (vote: 'hot' | 'not') => {
    if (!renderCurrent) return; // Safety check
    
    setLastVote(vote);
    setIsCardFlipped(true);
    setResultsRevealActive(false);
    setLandingTake(null);
    resultExitSV.value = 0;
    
    // 🧊 FREEZE: Capture current state immediately when vote is cast
    // Capture the current card BEFORE it gets removed
    frozenCurrent.current = renderCurrent;
    frozenThird.current = renderThird ?? null;
    // Only capture next if it exists
    if (renderNext) {
      frozenNext.current = renderNext;
      endAfterDismissRef.current = false;
    } else {
      frozenNext.current = null;
      endAfterDismissRef.current = true; // no next; after stats we should end
    }
    // MUST set frozen BEFORE the animation to lock in the card. Keep the
    // background card settled so it does not snap backward after a swipe.
    promoteSV.value = 1;
    resultBaseSV.value = frozenNext.current ? 1 : 0;
    setUseFrozen(true);
    
    // Store the vote details but DON'T submit yet
    const voteToSubmit = { id: renderCurrent.id, vote };
    
    // Set animating flag and bounce micro-scale then flip
    animatingSV.value = 1;
    scale.value = withSpring(0.96, {}, () => {
      'worklet';
      flipSV.value = withTiming(1, { duration: motion.duration.cardFlip, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(setResultsRevealActive)(true);
          // NOW submit the vote after the flip is complete and stats are showing
          runOnJS(onVote)(voteToSubmit.id, voteToSubmit.vote);
          // Auto-advance stats card only when Results Autoplay is enabled.
          runOnJS(jsSetAutoDismiss)();
          animatingSV.value = 0; // Clear animation flag
        }
      });
      scale.value = withSpring(1);
    });
  };
  
  // Handle change vote - dismiss stats card and trigger the change vote callback
  const handleChangeVote = (take: Take, currentVote?: 'hot' | 'not' | null) => {
    if (onChangeVote) {
      // Restore the card immediately; HomeScreen handles Firebase cleanup.
      onChangeVote(take, currentVote);
      
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
      resultExitSV.value = 0;
      resultBaseSV.value = 0;
      animatingSV.value = 0;
      
      // Reset state
      setIsCardFlipped(false);
      setResultsRevealActive(false);
      setLastVote(null);
      setCurrentVote(null);
      setLandingTake(null);
      frozenThird.current = null;
      
      // Clear timeout
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        setAutoDismissTimeout(null);
      }
      
      onExternalStatsCardDismiss();
      return;
    }
    
    isAnimating.value = true;

    const hasPromotedTake = Boolean(useFrozen && frozenNext.current && !endAfterDismissRef.current);
    
    const resetAll = () => {
      'worklet';
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      flipSV.value = 0;
      runOnJS(finishCardDismiss)();
      isAnimating.value = false;
    };

    const runReset = () => {
      if (skipAnimation) {
        resetAll();
      } else {
        resultExitSV.value = withTiming(
          1,
          { duration: resultExitDuration, easing: Easing.inOut(Easing.cubic) },
          resetAll
        );
      }
    };

    if (hasPromotedTake) {
      requestAnimationFrame(runReset);
    } else {
      runReset();
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
    
    const direction = vote === 'hot' ? 1 : -1;
    const swipeDistance = swipeThreshold * 0.8;
    const arcY = vote === 'hot' ? -VOTE_COMMIT_ARC_Y : VOTE_COMMIT_ARC_Y;
    
    // Quick leap to edge with timing (no lingering)
    translateX.value = withTiming(swipeDistance * direction, { 
      duration: motion.duration.cardNudge,
      easing: Easing.out(Easing.quad)
    }, () => {
      'worklet';
      // Immediate bouncy return
      translateX.value = withSpring(0, motion.spring.cardReturn);
      translateY.value = withSpring(0);
      scale.value = withSpring(1, motion.spring.cardReturn);
      runOnJS(vibrate)(motion.haptic.vote);
      runOnJS(flipCard)(vote);
    });
    translateY.value = withTiming(arcY, {
      duration: motion.duration.cardNudge,
      easing: Easing.out(Easing.quad),
    });
    
    // Quick scale down
    scale.value = withTiming(0.92, { duration: motion.duration.cardNudge, easing: Easing.out(Easing.quad) });
  };

  // Handle skip with animation (for both button press and swipe up/down)
  const handleSkipWithAnimation = (direction: 'up' | 'down' = 'down') => {
    if (!currentTake || isAnimating.value || externalStatsCard) return;

    setCurrentVote('skip');
    
    // 🧊 FREEZE: Capture current state immediately when skip is triggered
    if (renderCurrent) {
      frozenCurrent.current = renderCurrent;
      frozenThird.current = renderThird ?? null;
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
    vibrate(motion.haptic.medium);
    
    // Animate up or down based on direction
    const targetY = direction === 'up' ? -screenHeight * 0.8 : screenHeight * 0.8;
    
    translateY.value = withSpring(
      targetY,
      motion.spring.cardSkip,
      () => {
        'worklet';
        // Start promoting next card during return animation
        promoteSV.value = withTiming(1, { duration: motion.duration.cardPromote }, () => {
          'worklet';
          // Reset everything for next card
          translateX.value = 0;
          translateY.value = 0;
          scale.value = 1;
          runOnJS(jsSetVote)(null);
          runOnJS(setUseFrozen)(false); // 🔓 UNFREEZE
          animatingSV.value = 0;
          isAnimating.value = false;
        });
      }
    );
  };

  const lastSkipRequestTokenRef = React.useRef(skipRequestToken);
  useEffect(() => {
    if (skipRequestToken === lastSkipRequestTokenRef.current) {
      return;
    }

    lastSkipRequestTokenRef.current = skipRequestToken;
    handleSkipWithAnimation('down');
  }, [skipRequestToken]);

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      if (isAnimating.value || !hasCurrentSV.value) return; // ignore new gestures mid-flight or no card
      scale.value = withSpring(0.95);
      runOnJS(vibrate)(motion.haptic.selection);
    },
    onActive: (event) => {
      if (isAnimating.value || !hasCurrentSV.value) return;
      
      // Allow dragging the stats card too
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      
      // Only show vote indicators when NOT flipped (front card only) and not showing external stats
      if (!flippedSV.value && !externalStatsCard) {
        // Vote indicator based on swipe direction
        const shouldSwipeRight = event.translationX > swipeThreshold;
        const shouldSwipeLeft = event.translationX < -swipeThreshold;
        const shouldSwipeDown = event.translationY > swipeDownThreshold;
        const shouldSwipeUp = event.translationY < -swipeUpThreshold;
        
        // Update vote indicator
        if (shouldSwipeRight) {
          runOnJS(jsSetVote)('hot');
        } else if (shouldSwipeLeft) {
          runOnJS(jsSetVote)('not');
        } else if (shouldSwipeDown || shouldSwipeUp) {
          runOnJS(jsSetVote)('skip');
        } else {
          runOnJS(jsSetVote)(null); // Clear vote when not at threshold
        }
        
        // Horizontal swipe feedback
        if ((shouldSwipeRight || shouldSwipeLeft) && Math.abs(event.translationX) > swipeThreshold && Math.abs(event.translationX) < swipeThreshold + 20) {
          runOnJS(vibrate)(motion.haptic.medium);
        }
        
        // Down swipe feedback
        if (shouldSwipeDown && Math.abs(event.translationY) > swipeDownThreshold && Math.abs(event.translationY) < swipeDownThreshold + 30) {
          runOnJS(vibrate)(motion.haptic.selection);
        }
        
        // Up swipe feedback
        if (shouldSwipeUp && Math.abs(event.translationY) > swipeUpThreshold && Math.abs(event.translationY) < swipeUpThreshold + 30) {
          runOnJS(vibrate)(motion.haptic.selection);
        }
      }
    },
    onEnd: (event) => {
      if (isAnimating.value || !hasCurrentSV.value) return;
      
      // If card is flipped (showing stats), a deliberate swipe continues to next.
      // Plain taps should remain available to the stats card controls.
      if (flippedSV.value) {
        const didSwipe = Math.abs(event.translationX) > 20 || Math.abs(event.translationY) > 20;
        if (didSwipe) {
          const horizontalIntent = Math.abs(event.translationX) >= Math.abs(event.translationY);
          const exitX = horizontalIntent
            ? (event.translationX >= 0 ? screenWidth * 0.75 : -screenWidth * 0.75)
            : event.translationX;
          const exitY = horizontalIntent
            ? event.translationY * 0.35
            : (event.translationY >= 0 ? screenHeight * 0.36 : -screenHeight * 0.36);

          translateX.value = withTiming(exitX, {
            duration: resultExitDuration,
            easing: Easing.out(Easing.cubic),
          });
          translateY.value = withTiming(exitY, {
            duration: resultExitDuration,
            easing: Easing.out(Easing.cubic),
          });
          runOnJS(continueToNext)(false);
        } else {
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          scale.value = withSpring(1);
        }
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
      
      const shouldSwipeRight = event.translationX > swipeThreshold;
      const shouldSwipeLeft = event.translationX < -swipeThreshold;
      const shouldSwipeDown = event.translationY > swipeDownThreshold;
      const shouldSwipeUp = event.translationY < -swipeUpThreshold;

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
        runOnJS(vibrate)(motion.haptic.vote);
        translateX.value = withSpring(0);
        translateY.value = withTiming(-VOTE_COMMIT_ARC_Y, {
          duration: motion.duration.cardNudge,
          easing: Easing.out(Easing.quad),
        }, () => {
          'worklet';
          translateY.value = withSpring(0);
        });
        scale.value = withSpring(1);
        runOnJS(flipCard)('hot');
        return;
      }

      if (shouldSwipeLeft && id && !flippedSV.value) {
        // Front side: Bounce back and flip to reveal
        runOnJS(vibrate)(motion.haptic.vote);
        translateX.value = withSpring(0);
        translateY.value = withTiming(VOTE_COMMIT_ARC_Y, {
          duration: motion.duration.cardNudge,
          easing: Easing.out(Easing.quad),
        }, () => {
          'worklet';
          translateY.value = withSpring(0);
        });
        scale.value = withSpring(1);
        runOnJS(flipCard)('not');
        return;
      }

      // bounce back - clear vote indicator
      runOnJS(vibrate)(motion.haptic.light);
      runOnJS(jsSetVote)(null); // Clear vote indicator
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
    },
  });

  // Outer card gets perspective so the 3D reads nicely
  const card3DStyle = useAnimatedStyle(() => {
    const useResultOverlay = resultBaseSV.value > 0.5;
    const exitProgress = resultExitSV.value;
    const exitOpacity = useResultOverlay
      ? 1
      : interpolate(exitProgress, [0, 1], [1, 0], Extrapolate.CLAMP);
    const exitScale = useResultOverlay
      ? 1
      : interpolate(exitProgress, [0, 1], [1, 0.965], Extrapolate.CLAMP);
    const exitTranslateY = useResultOverlay
      ? 0
      : interpolate(exitProgress, [0, 1], [0, -18], Extrapolate.CLAMP);
    const entranceOpacity = interpolate(cardEntranceSV.value, [0, 1], [0, 1], Extrapolate.CLAMP);
    const entranceScale = interpolate(cardEntranceSV.value, [0, 1], [0.97, 1], Extrapolate.CLAMP);
    const rotate = interpolate(
      translateX.value,
      [-screenWidth, 0, screenWidth],
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, swipeThreshold * 0.7, swipeThreshold],
      [1, 1, 0.7],
      Extrapolate.CLAMP
    );
    const wrapperTranslateX = useResultOverlay ? 0 : translateX.value;
    const wrapperTranslateY = useResultOverlay ? 0 : translateY.value + exitTranslateY;
    const wrapperRotate = useResultOverlay ? '0deg' : `${rotate}deg`;
    const wrapperOpacity = useResultOverlay ? 1 : opacity;

    return {
      transform: [
        { perspective: 1000 }, // 3D space
        { translateX: wrapperTranslateX },
        { translateY: wrapperTranslateY },
        { rotate: wrapperRotate },
        { scale: scale.value * exitScale * entranceScale },
      ],
      opacity: wrapperOpacity * exitOpacity * entranceOpacity,
      zIndex: flippedSV.value || animatingSV.value ? 150 : 100, // Higher during animation but below UI elements (footer: 200)
      elevation: flippedSV.value || animatingSV.value ? 6 : 4, // Android layering fix
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    const isResultHandoff = frozenSV.value > 0.5 && flippedSV.value > 0.5;
    // During a results reveal, keep the next card settled behind the stats card.
    // Re-animating this slot reads as a glitch on Android because the card was
    // already promoted by the swipe gesture before the freeze.
    const p = isResultHandoff
      ? 1
      : frozenSV.value
        ? promoteSV.value
        : Math.min(Math.abs(translateX.value) / swipeThreshold, 1);
    const nextScale = 0.98 + 0.02 * p;
    const nextTranslateY = 8 * (1 - p);
    const nextOpacity = frozenSV.value ? 1 : 0.18 + 0.82 * p;

    return {
      transform: [
        { scale: nextScale },
        { translateY: nextTranslateY },
      ],
      opacity: nextOpacity,
      zIndex: isResultHandoff ? 100 : frozenSV.value ? 80 : 50,
      elevation: isResultHandoff ? 4 : frozenSV.value ? 3 : 2,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0, // Fill full container height
    };
  });

  // 3D flip animations
  const frontFaceStyle = useAnimatedStyle(() => {
    const showResultBase = resultBaseSV.value > 0.5;
    if (showResultBase) {
      return {
        opacity: 1,
        transform: [{ perspective: 1000 }, { rotateY: '0deg' }],
        backfaceVisibility: 'hidden' as const,
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
      };
    }

    if (ANDROID_SAFE_FLIP) {
      return { 
        opacity: 1 - flipSV.value,
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0, // Fill full container height
        zIndex: 1,
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
      zIndex: 1,
    };
  });
  
  const backFaceStyle = useAnimatedStyle(() => {
    const exitProgress = resultExitSV.value;
    const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0], Extrapolate.CLAMP);
    const exitScale = interpolate(exitProgress, [0, 1], [1, 0.965], Extrapolate.CLAMP);
    const exitTranslateY = interpolate(exitProgress, [0, 1], [0, -18], Extrapolate.CLAMP);

    if (ANDROID_SAFE_FLIP) {
      const resultRevealStart = Math.max(0, 1 - motion.duration.resultReveal / motion.duration.cardFlip);
      const resultOpacity = interpolate(
        flipSV.value,
        [resultRevealStart, 1],
        [0, 1],
        Extrapolate.CLAMP
      );
      const resultTranslateY = interpolate(
        flipSV.value,
        [resultRevealStart, 1],
        [20, 0],
        Extrapolate.CLAMP
      );

      return { 
        opacity: resultOpacity * exitOpacity,
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value + resultTranslateY + exitTranslateY },
          { scale: exitScale },
        ],
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0, // ADD MISSING BOTTOM
        zIndex: 2,
      };
    }
    const deg = interpolate(flipSV.value, [0, 1], [180, 360]);
    const resultRevealStart = Math.max(0.5, 1 - motion.duration.resultReveal / motion.duration.cardFlip);
    const opacity = interpolate(
      flipSV.value,
      [resultRevealStart, 1],
      [0, 1],
      Extrapolate.CLAMP
    );
    const resultTranslateY = interpolate(
      flipSV.value,
      [resultRevealStart, 1],
      [20, 0],
      Extrapolate.CLAMP
    );
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${deg}deg` },
        { translateX: translateX.value },
        { translateY: translateY.value + resultTranslateY + exitTranslateY },
        { scale: exitScale },
      ],
      opacity: opacity * exitOpacity,
      backfaceVisibility: 'hidden' as const,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0, // Fill full container height
      zIndex: 2,
    };
  });


  const hotOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, swipeThreshold],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const notOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-swipeThreshold, 0],
      [1, 0],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  // Third card style - sits behind next card (MUST be before any returns!)
  const thirdCardStyle = useAnimatedStyle(() => {
    const thirdScale = 0.96;
    const thirdTranslateY = 16;
    const thirdOpacity = frozenSV.value ? 0 : 0.12;

    return {
      transform: [
        { scale: thirdScale },
        { translateY: thirdTranslateY },
      ],
      opacity: thirdOpacity,
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
            You're all caught up
          </Text>
          <Text style={[styles.endMessage, { color: theme.textSecondary }]}>
            You've seen everything here. More takes are on the way.
          </Text>

          <View style={[styles.communityBadge, { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }]}>
            <Text style={[styles.communityBadgeText, { color: theme.textSecondary }]}>
              Community votes: {communityTotalVotes.toLocaleString()}
            </Text>
          </View>
          
          {onSubmitTake && (
            <AnimatedPressable
              style={[styles.submitButton, { backgroundColor: theme.primary }]}
              onPress={onSubmitTake}
              scaleValue={0.95}
              hapticIntensity={15}
            >
              <Text style={styles.submitButtonText}>✏️ Add a Take</Text>
            </AnimatedPressable>
          )}
          
          <Text style={[styles.endHint, { color: theme.textSecondary, opacity: 0.7 }]}>
            Pull down to check again, or add a fresh take yourself.
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
        {renderThird ? (
          <TakeCard 
            take={renderThird}
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
      <PanGestureHandler
        onGestureEvent={gestureHandler}
        minDist={8}
      >
        <Animated.View 
          key="current-slot" 
          style={[dynamicStyles.cardContainer, card3DStyle]}
          collapsable={false}
        >
          {/* 👻 Invisible sizer only when we actually have a card */}
          {!!frontTake && (
            <View pointerEvents="none" style={styles.ghostSizer}>
              <TakeCard
                take={frontTake}
                isDarkMode={isDarkMode}
                showStats={false}
              />
            </View>
          )}
          
          {/* FRONT */}
          {!!frontTake && (
            <Animated.View
              style={[frontFaceStyle]}
              pointerEvents={isCardFlipped ? 'none' : 'auto'}
            >
              <TakeCard
                take={frontTake}
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
          {!!statsTake && (
            <Animated.View
              style={[backFaceStyle]}
              pointerEvents={isCardFlipped ? 'auto' : 'none'}
            >
              <TakeCard
                take={{
                  ...statsTake,
                  // For external stats cards, don't add optimistic votes since they're historical
                  // For regular votes, add optimistic single-vote bump so stats include user's vote
                  hotVotes: statsTake.hotVotes + (!externalStatsCard && lastVote === 'hot' ? 1 : 0),
                  notVotes: statsTake.notVotes + (!externalStatsCard && lastVote === 'not' ? 1 : 0),
                  totalVotes: statsTake.totalVotes + (!externalStatsCard && lastVote ? 1 : 0),
                }}
                isDarkMode={isDarkMode}
                showStats={true}
                userVote={lastVote}
                isFlipped={true}
                animateResults={resultsRevealActive}
                holdResultCountAtZero={!externalStatsCard}
                onChangeVote={externalStatsCard ? handleChangeVote : undefined}
                onVoteNow={onVoteNow}
                identityTeaser={
                  !externalStatsCard && identityTeaser?.takeId === statsTake.id
                    ? identityTeaser.text
                    : null
                }
                onIdentityTeaserPress={onIdentityTeaserPress}
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
  communityBadge: {
    borderRadius: 18,
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.sm,
    marginBottom: dimensions.spacing.md,
  },
  communityBadgeText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '800',
    textAlign: 'center',
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
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
