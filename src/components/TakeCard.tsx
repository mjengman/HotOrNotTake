import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  Share,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import { Take } from '../types';
import { colors, dimensions, motion, type Colors } from '../constants';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../hooks/useAuth';
import { addToFavorites, removeFromFavorites, isInFavorites } from '../services/favoritesService';
import { VisualShareCard } from './VisualShareCard';
import { getResultReaction, type ResultReactionTone } from '../utils/resultReaction';
import {
  recordContrarianVote,
  recordSaveAction,
  recordShareAction,
  type UnlockedAchievement,
} from '../services/achievementService';

interface TakeCardProps {
  take: Take;
  isDarkMode?: boolean;
  onNotPress?: () => void;
  onHotPress?: () => void;
  showStats?: boolean;
  userVote?: 'hot' | 'not' | null;
  isFlipped?: boolean;
  animateResults?: boolean;
  holdResultCountAtZero?: boolean;
  onChangeVote?: (take: Take, currentVote?: 'hot' | 'not' | null) => void;
  onVoteNow?: (take: Take) => void;
  identityTeaser?: string | null;
  onIdentityTeaserPress?: () => void;
  firstVoteHint?: string | null;
  onFirstVoteHintDismiss?: () => void;
  onAdminRemoveRequest?: (take: Take) => void;
  trackResultAchievements?: boolean;
  onAchievementUnlocked?: (achievement: UnlockedAchievement) => void;
}

const getReactionToneColor = (tone: ResultReactionTone, theme: Colors) => {
  switch (tone) {
    case 'hot':
      return theme.hot;
    case 'not':
      return theme.not;
    case 'split':
      return theme.accent;
    case 'contrarian':
      return theme.secondary;
    case 'rare-contrarian':
      return theme.hot;
    case 'consensus':
      return theme.success;
    case 'low-signal':
    default:
      return theme.textSecondary;
  }
};

export const TakeCard: React.FC<TakeCardProps> = ({
  take,
  isDarkMode = false,
  onNotPress,
  onHotPress,
  showStats = true,
  userVote = null,
  isFlipped = false,
  animateResults = false,
  holdResultCountAtZero = false,
  onChangeVote,
  onVoteNow,
  identityTeaser = null,
  onIdentityTeaserPress,
  firstVoteHint = null,
  onFirstVoteHintDismiss,
  onAdminRemoveRequest,
  trackResultAchievements = false,
  onAchievementUnlocked,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const responsive = useResponsive();
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const visualShareRef = useRef<ViewShot>(null);
  const categoryTapCountRef = useRef(0);
  const categoryTapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedContrarianTakeIdsRef = useRef<Set<string>>(new Set());
  const shouldEnableResultActions = isFlipped && showStats;
  const initialResultCountProgress = isFlipped && holdResultCountAtZero && !animateResults ? 0 : 1;
  const resultCountAnim = useRef(new Animated.Value(initialResultCountProgress)).current;
  const [resultCountProgress, setResultCountProgress] = useState(initialResultCountProgress);

  // Dynamic text sizing based on card height
  // For smaller cards (< 400px), reduce text size for better readability
  const getAdaptiveTextSize = () => {
    const cardHeight = responsive.card.height;
    if (cardHeight < 400) {
      // Small cards: use responsive medium instead of large
      return responsive.fontSize.medium;
    } else if (cardHeight < 500) {
      // Medium cards: scale down responsive large slightly
      return responsive.fontSize.large * 0.9;
    } else {
      // Large cards: use full responsive large
      return responsive.fontSize.large;
    }
  };

  // Adaptive spacing for small cards to give text more room
  const getAdaptiveSpacing = () => {
    const cardHeight = responsive.card.height;
    if (cardHeight < 400) {
      return {
        cardPadding: responsive.spacing.md, // Reduce from lg (24px) to md (16px)
        headerMargin: responsive.spacing.sm, // Reduce from md (16px) to sm (8px)
        footerMargin: responsive.spacing.md, // Reduce from lg (24px) to md (16px)
        contentPadding: responsive.spacing.sm, // Reduce content horizontal padding
      };
    } else {
      return {
        cardPadding: responsive.spacing.lg,
        headerMargin: responsive.spacing.md,
        footerMargin: responsive.spacing.lg,
        contentPadding: responsive.spacing.md,
      };
    }
  };

  const adaptiveTextSize = getAdaptiveTextSize();
  const adaptiveSpacing = getAdaptiveSpacing();
  const isCompactResultCard = responsive.card.height < 430;
  const resultTextSize = Math.min(adaptiveTextSize * 0.84, responsive.fontSize.medium + 1);
  const resultTextLineHeight = resultTextSize * 1.28;
  const resultTextLines = responsive.card.height < 440 ? 3 : responsive.card.height < 520 ? 4 : 5;
  const cardSurface = isDarkMode ? '#2B2B2B' : '#FEFCF8';
  const cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.07)' : '#EFE7DA';
  const cardHighlight = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.82)';

  // Calculate percentages for the reveal
  // Some takes may not have totalVotes, so calculate from individual votes
  const totalVotes = take.totalVotes || (take.hotVotes + take.notVotes) || 0;
  const hotPercentage = totalVotes > 0 ? Math.round((take.hotVotes / totalVotes) * 100) : 50;
  const notPercentage = totalVotes > 0 ? Math.round((take.notVotes / totalVotes) * 100) : 50;
  const displayedHotPercentage = Math.round(hotPercentage * resultCountProgress);
  const displayedNotPercentage = Math.round(notPercentage * resultCountProgress);
  const resultReaction = getResultReaction({
    userVote,
    hotPercentage,
    notPercentage,
    totalVotes,
    seed: take.id,
  });
  const userAgreementPercentage =
    userVote === 'hot' ? hotPercentage : userVote === 'not' ? notPercentage : null;
  const isContrarianShareMoment =
    userAgreementPercentage !== null &&
    userAgreementPercentage <= 30 &&
    (resultReaction.tone === 'contrarian' || resultReaction.tone === 'rare-contrarian');
  const shareVerdict = isContrarianShareMoment
    ? `Only ${userAgreementPercentage}% agreed with me on this one 🧭`
    : resultReaction.subtext
    ? `${resultReaction.headline}\n${resultReaction.subtext}`
    : resultReaction.headline;
  const reactionColor = getReactionToneColor(resultReaction.tone, theme);
  const isRareContrarian = resultReaction.tone === 'rare-contrarian';
  const splitIsClose = resultReaction.tone === 'split';
  const notIsWinningSide = notPercentage >= hotPercentage;
  const hotIsWinningSide = hotPercentage >= notPercentage;
  const notPercentageEmphasis = splitIsClose || notIsWinningSide;
  const hotPercentageEmphasis = splitIsClose || hotIsWinningSide;
  const winningPercentageBoost = splitIsClose ? 4 : 8;
  const quietPercentageBoost = 1;
  const notPercentageSize = responsive.fontSize.xlarge + (
    notPercentageEmphasis ? winningPercentageBoost : quietPercentageBoost
  );
  const hotPercentageSize = responsive.fontSize.xlarge + (
    hotPercentageEmphasis ? winningPercentageBoost : quietPercentageBoost
  );
  const resultSpacerStyle = {
    flex: isCompactResultCard ? 0.55 : 1,
    minHeight: isCompactResultCard ? responsive.spacing.xs : responsive.spacing.sm,
  };
  const resultActionSpacerStyle = {
    flex: isCompactResultCard ? 0.35 : 1.25,
    minHeight: isCompactResultCard ? responsive.spacing.xs : responsive.spacing.md,
  };

  useEffect(() => {
    if (
      !trackResultAchievements ||
      !shouldEnableResultActions ||
      !userVote ||
      !isContrarianShareMoment ||
      trackedContrarianTakeIdsRef.current.has(take.id)
    ) {
      return;
    }

    trackedContrarianTakeIdsRef.current.add(take.id);
    recordContrarianVote(take.id)
      .then(achievement => {
        if (achievement) {
          onAchievementUnlocked?.(achievement);
        }
      })
      .catch(error => {
        console.warn('Unable to record contrarian achievement progress:', error);
      });
  }, [
    isContrarianShareMoment,
    onAchievementUnlocked,
    shouldEnableResultActions,
    take.id,
    trackResultAchievements,
    userVote,
  ]);
  const percentageItemHeight = isCompactResultCard ? 58 : 74;

  useEffect(() => {
    categoryTapCountRef.current = 0;
    if (categoryTapResetTimeoutRef.current) {
      clearTimeout(categoryTapResetTimeoutRef.current);
      categoryTapResetTimeoutRef.current = null;
    }
  }, [take.id]);

  useEffect(() => () => {
    if (categoryTapResetTimeoutRef.current) {
      clearTimeout(categoryTapResetTimeoutRef.current);
    }
  }, []);

  const handleCategoryBadgePress = () => {
    if (!onAdminRemoveRequest || isFlipped) {
      return;
    }

    categoryTapCountRef.current += 1;

    if (categoryTapResetTimeoutRef.current) {
      clearTimeout(categoryTapResetTimeoutRef.current);
    }

    categoryTapResetTimeoutRef.current = setTimeout(() => {
      categoryTapCountRef.current = 0;
      categoryTapResetTimeoutRef.current = null;
    }, 5000);

    if (categoryTapCountRef.current >= 10) {
      categoryTapCountRef.current = 0;
      if (categoryTapResetTimeoutRef.current) {
        clearTimeout(categoryTapResetTimeoutRef.current);
        categoryTapResetTimeoutRef.current = null;
      }
      onAdminRemoveRequest(take);
    }
  };

  useEffect(() => {
    if (!isFlipped) {
      resultCountAnim.stopAnimation();
      resultCountAnim.setValue(1);
      setResultCountProgress(1);
      return undefined;
    }

    if (!animateResults) {
      resultCountAnim.stopAnimation();
      const nextProgress = holdResultCountAtZero ? 0 : 1;
      resultCountAnim.setValue(nextProgress);
      setResultCountProgress(nextProgress);
      return undefined;
    }

    resultCountAnim.stopAnimation();
    resultCountAnim.setValue(0);
    setResultCountProgress(0);

    const listenerId = resultCountAnim.addListener(({ value }) => {
      setResultCountProgress(value);
    });

    Animated.timing(resultCountAnim, {
      toValue: 1,
      duration: motion.duration.resultCountUp,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setResultCountProgress(1);
      }
    });

    return () => {
      resultCountAnim.removeListener(listenerId);
      resultCountAnim.stopAnimation();
    };
  }, [animateResults, holdResultCountAtZero, hotPercentage, isFlipped, notPercentage, resultCountAnim, take.id]);

  // Check if this take is favorited
  useEffect(() => {
    if (!shouldEnableResultActions || !user) {
      setIsFavorited(false);
      return;
    }

    const checkFavoriteStatus = async () => {
      try {
        const favorited = await isInFavorites(user.uid, take.id);
        setIsFavorited(favorited);
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavoriteStatus();
  }, [shouldEnableResultActions, user, take.id]);

  const handleShare = async () => {
    recordShareAction()
      .then(achievement => {
        if (achievement) {
          onAchievementUnlocked?.(achievement);
        }
      })
      .catch(error => {
        console.warn('Unable to record share achievement progress:', error);
      });

    try {
      const SMART_LINK = 'https://hot-or-not-takes.web.app/download';
      const shareCta = `What's YOUR take?\n${SMART_LINK}`;
      const fallbackShareMessage = `${shareVerdict}\n\n"${take.text}"\n\nCommunity split:\n🔥 ${hotPercentage}% HOT\n❄️ ${notPercentage}% NOT\n\n👥 ${totalVotes.toLocaleString()} total votes\n\n${userVote ? `I voted ${userVote.toUpperCase()}. ` : ''}${shareCta}`;

      // Try visual sharing first
      if (visualShareRef.current?.capture) {
        try {

          // Capture the visual share card as image
          const imageUri = await visualShareRef.current.capture();

          if (!imageUri) throw new Error('Capture failed / imageUri missing');

          await RNShare.open({
            title: 'Hot or Not Takes',
            url: imageUri,
            message: shareCta,
            failOnCancel: false,
          });

          return; // Success - exit early

        } catch (visualError) {
        }
      }

      await RNShare.open({
        title: 'Hot or Not Takes',
        message: fallbackShareMessage,
        failOnCancel: false,
      });

    } catch (error) {
      // Final fallback to built-in Share
      try {
        const fallbackMessage = `"${take.text}"\n\nCheck out this hot take! https://hot-or-not-takes.web.app/download`;
        await Share.share({ message: fallbackMessage });
      } catch (finalError) {
      }
    }
  };

  const handleFavoriteToggle = async () => {
    if (!user || favoriteLoading) return;

    setFavoriteLoading(true);
    try {
      if (isFavorited) {
        await removeFromFavorites(user.uid, take.id);
        setIsFavorited(false);
      } else {
        await addToFavorites(user.uid, take.id);
        setIsFavorited(true);
        recordSaveAction()
          .then(achievement => {
            if (achievement) {
              onAchievementUnlocked?.(achievement);
            }
          })
          .catch(error => {
            console.warn('Unable to record save achievement progress:', error);
          });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: cardSurface,
        width: responsive.card.width, // Container already provides margins
        // Remove fixed height - let card fill available container space
        borderRadius: responsive.card.borderRadius,
        borderColor: cardBorder,
        padding: adaptiveSpacing.cardPadding,
        flex: 1, // Fill available height in cardContainer
        justifyContent: 'space-between',
        elevation: isDarkMode ? 10 : 9,
        shadowOpacity: isDarkMode ? 0.34 : 0.18,
        shadowRadius: isDarkMode ? 14 : 18,
      }
    ]}>
      <View
        pointerEvents="none"
        style={[
          styles.cardHighlight,
          {
            backgroundColor: cardHighlight,
            borderTopLeftRadius: responsive.card.borderRadius,
            borderTopRightRadius: responsive.card.borderRadius,
          },
        ]}
      />
      <View style={[
        styles.header,
        { marginBottom: isFlipped ? responsive.spacing.sm : adaptiveSpacing.headerMargin }
      ]}>
        {onAdminRemoveRequest && !isFlipped ? (
          <TouchableOpacity
            style={[styles.categoryBadge, { backgroundColor: theme.accent + '20' }]}
            onPress={handleCategoryBadgePress}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`${take.category || 'General'} category`}
          >
            <Text style={[
              styles.category,
              {
                color: theme.accent,
                fontSize: responsive.fontSize.small
              }
            ]}>
              {take.category?.toUpperCase() || 'GENERAL'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.categoryBadge, { backgroundColor: theme.accent + '20' }]}>
            <Text style={[
              styles.category,
              {
                color: theme.accent,
                fontSize: responsive.fontSize.small
              }
            ]}>
              {take.category?.toUpperCase() || 'GENERAL'}
            </Text>
          </View>
        )}
      </View>

      <View style={[
        styles.content,
        isFlipped && styles.resultContent,
        { paddingHorizontal: adaptiveSpacing.contentPadding }
      ]}>
        <Text
          style={[
            styles.takeText,
            {
              color: theme.text,
              fontSize: isFlipped ? resultTextSize : adaptiveTextSize,
              lineHeight: isFlipped ? resultTextLineHeight : adaptiveTextSize * 1.4,
            }
          ]}
          numberOfLines={isFlipped ? resultTextLines : 15}
          ellipsizeMode="tail"
        >
          {take.text}
        </Text>
      </View>

      <View style={[
        styles.footer,
        isFlipped && styles.resultFooter,
        { marginTop: isFlipped ? responsive.spacing.sm : adaptiveSpacing.footerMargin }
      ]}>
        {!isFlipped ? (
          // Front of card - voting buttons
          <View style={styles.voteStats}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={onNotPress}
              disabled={!onNotPress}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.statNumber,
                {
                  color: theme.not,
                  fontSize: responsive.fontSize.large
                }
              ]}>
                {showStats ? take.notVotes.toLocaleString() : '?'}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  {
                    color: theme.textSecondary,
                    fontSize: responsive.fontSize.small
                  }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                ❄️ NOT
              </Text>
            </TouchableOpacity>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <TouchableOpacity
              style={styles.statItem}
              onPress={onHotPress}
              disabled={!onHotPress}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.statNumber,
                {
                  color: theme.hot,
                  fontSize: responsive.fontSize.large
                }
              ]}>
                {showStats ? take.hotVotes.toLocaleString() : '?'}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  {
                    color: theme.textSecondary,
                    fontSize: responsive.fontSize.small
                  }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                🔥 HOT
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Back of card - stats reveal
          <View style={[
            styles.revealContainer,
            {
              backgroundColor: cardSurface,
              paddingTop: responsive.spacing.sm,
              paddingBottom: isCompactResultCard ? 0 : responsive.spacing.xs,
            }
          ]}>
            <View style={[
              styles.reactionSection,
              isRareContrarian && {
                backgroundColor: isDarkMode ? 'rgba(255, 71, 87, 0.12)' : 'rgba(255, 71, 87, 0.08)',
                borderColor: isDarkMode ? 'rgba(255, 165, 2, 0.45)' : 'rgba(255, 165, 2, 0.38)',
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: 18,
                paddingVertical: responsive.spacing.xs,
              },
            ]}>
              <Text style={[
                styles.reactionHeadline,
                {
                  color: reactionColor,
                  fontSize: responsive.fontSize.large,
                  lineHeight: responsive.fontSize.large * 1.16,
                },
              ]}>
                {resultReaction.headline}
              </Text>
              {resultReaction.subtext && (
                <Text style={[
                  styles.reactionSubtext,
                  {
                    color: isRareContrarian ? theme.accent : theme.text,
                    fontSize: responsive.fontSize.small,
                    lineHeight: responsive.fontSize.small * 1.28,
                    fontWeight: isRareContrarian ? '800' : '700',
                  },
                ]}>
                  {resultReaction.subtext}
                </Text>
              )}
            </View>

            {firstVoteHint && (
              <TouchableOpacity
                style={[
                  styles.firstVoteHint,
                  {
                    backgroundColor: reactionColor + '14',
                    borderColor: reactionColor + '30',
                  },
                ]}
                onPress={onFirstVoteHintDismiss}
                activeOpacity={0.74}
                accessibilityRole="button"
                accessibilityLabel="Dismiss first vote results hint"
              >
                <Text
                  style={[
                    styles.firstVoteHintText,
                    {
                      color: theme.textSecondary,
                      fontSize: responsive.fontSize.small,
                    },
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {firstVoteHint}
                </Text>
              </TouchableOpacity>
            )}

            {identityTeaser && (
              <TouchableOpacity
                style={[
                  styles.identityTeaser,
                  {
                    backgroundColor: reactionColor + '18',
                    borderColor: reactionColor + '35',
                  },
                ]}
                onPress={onIdentityTeaserPress}
                disabled={!onIdentityTeaserPress}
                activeOpacity={0.74}
                accessibilityRole="button"
                accessibilityLabel="Open your voting style"
              >
                <Text
                  style={[
                    styles.identityTeaserText,
                    {
                      color: reactionColor,
                      fontSize: responsive.fontSize.small,
                    },
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  🧭 {identityTeaser}
                </Text>
              </TouchableOpacity>
            )}

            <View style={[styles.resultGroupSpacer, resultSpacerStyle]} />

            <View style={[
              styles.resultStatsGroup,
              { gap: responsive.spacing.sm }
            ]}>
              <View style={[styles.percentageContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <View style={[
                  styles.percentageItem,
                  {
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: percentageItemHeight,
                  },
                ]}>
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={[
                      styles.bigPercentage,
                      {
                        color: theme.not,
                        fontSize: notPercentageSize,
                        opacity: notPercentageEmphasis ? 1 : 0.68,
                        textAlign: 'center'
                      }
                    ]}>
                      {displayedNotPercentage}%
                    </Text>
                  </View>
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={[
                      styles.percentageLabel,
                      {
                        color: theme.textSecondary,
                        fontSize: responsive.fontSize.small,
                        opacity: notPercentageEmphasis ? 1 : 0.72,
                        textAlign: 'center'
                      }
                    ]}>
                      NOT
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.percentageDivider,
                  {
                    backgroundColor: theme.border,
                    height: responsive.spacing.xl + 8
                  }
                ]} />
                <View style={[
                  styles.percentageItem,
                  {
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: percentageItemHeight,
                  },
                ]}>
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={[
                      styles.bigPercentage,
                      {
                        color: theme.hot,
                        fontSize: hotPercentageSize,
                        opacity: hotPercentageEmphasis ? 1 : 0.68,
                        textAlign: 'center'
                      }
                    ]}>
                      {displayedHotPercentage}%
                    </Text>
                  </View>
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={[
                      styles.percentageLabel,
                      {
                        color: theme.textSecondary,
                        fontSize: responsive.fontSize.small,
                        opacity: hotPercentageEmphasis ? 1 : 0.72,
                        textAlign: 'center'
                      }
                    ]}>
                      HOT
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.resultVoteMetaGroup}>
                {userVote ? (
                  <>
                    <Text style={[
                      styles.userVoteMeta,
                      {
                        color: theme.textSecondary,
                        fontSize: responsive.fontSize.small,
                      },
                    ]}>
                      Your vote: {userVote === 'hot' ? '🔥 HOT' : '❄️ NOT'}
                    </Text>
                    {onChangeVote && (
                      <TouchableOpacity
                        style={styles.changeVoteUtility}
                        onPress={() => onChangeVote(take, userVote)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.changeVoteText,
                          {
                            color: theme.textSecondary,
                            fontSize: responsive.fontSize.small,
                            textAlign: 'center'
                          }
                        ]}>
                          Change vote
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : onVoteNow ? (
                  <TouchableOpacity
                    style={[styles.voteNowButton, { backgroundColor: reactionColor + '18' }]}
                    onPress={() => onVoteNow(take)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.voteNowText,
                      {
                        color: reactionColor,
                        fontSize: responsive.fontSize.small,
                      },
                    ]}>
                      Vote now
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.totalVotesRow}>
                <Text style={[
                  styles.totalVotes,
                  {
                    color: theme.textSecondary,
                    fontSize: responsive.fontSize.small,
                    textAlign: 'center'
                  }
                ]}>
                  {totalVotes.toLocaleString()} total votes
                </Text>
              </View>
            </View>

            <View style={[styles.resultActionSpacer, resultActionSpacerStyle]} />

            {/* Action Buttons */}
            <View style={styles.resultActionsGroup}>
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.accent + '20' }]}
                  onPress={handleFavoriteToggle}
                  activeOpacity={0.7}
                  disabled={favoriteLoading}
                >
                  <Text style={[styles.actionIcon, { color: theme.accent }]}>
                    {isFavorited ? '⭐' : '☆'}
                  </Text>
                  <Text style={[styles.actionText, { color: theme.accent, fontSize: responsive.fontSize.small }]}>
                    {isFavorited ? 'Saved' : 'Save'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.shareActionButton,
                    isContrarianShareMoment && styles.contrarianShareActionButton,
                    {
                      backgroundColor: reactionColor + (isContrarianShareMoment ? '32' : '24'),
                      borderColor: isContrarianShareMoment ? reactionColor + '66' : 'transparent',
                    },
                  ]}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionIcon, { color: reactionColor }]}>↗️</Text>
                  <Text
                    style={[styles.actionText, { color: reactionColor, fontSize: responsive.fontSize.small }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {isContrarianShareMoment ? 'Share this result' : 'Share result'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {shouldEnableResultActions && (
        <View style={styles.offScreenContainer}>
          <ViewShot
            ref={visualShareRef}
            options={{ format: "png", quality: 0.9 }}
          >
            <VisualShareCard
              take={take}
              userVote={userVote}
              isDarkMode={isDarkMode}
            />
          </ViewShot>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    // Dimensions are set dynamically in component
    alignSelf: 'center', // Ensure card centers itself
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 9,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    justifyContent: 'space-between',
    minHeight: '100%', // Ensure card fills full container height
    height: '100%', // Ensure card fills full container height
  },
  cardHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 2,
  },
  header: {
    alignItems: 'center',
    // marginBottom now set dynamically with adaptive spacing
  },
  categoryBadge: {
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 2, 0.3)',
  },
  category: {
    // fontSize now set dynamically with responsive sizing
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    // backgroundColor: 'blue'
    // paddingHorizontal now set dynamically with adaptive spacing
  },
  resultContent: {
    flex: 0,
    flexGrow: 0,
    flexShrink: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  takeText: {
    // fontSize and lineHeight now set dynamically based on card height
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    marginTop: dimensions.spacing.lg,
  },
  resultFooter: {
    flex: 1,
    width: '100%',
  },
  identityTeaser: {
    alignSelf: 'center',
    maxWidth: '96%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.xs,
  },
  identityTeaserText: {
    textAlign: 'center',
    fontWeight: '800',
    lineHeight: 20,
  },
  firstVoteHint: {
    alignSelf: 'center',
    maxWidth: '96%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.xs,
    marginTop: dimensions.spacing.xs,
  },
  firstVoteHintText: {
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 20,
  },
  voteStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    minHeight: motion.touchTarget.minimum,
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  statNumber: {
    // fontSize now set dynamically with responsive sizing
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    // fontSize now set dynamically with responsive sizing
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
    // backgroundColor and opacity now set via theme.border
  },
  // Reveal styles
  revealContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingVertical: dimensions.spacing.md,
    justifyContent: 'flex-start',
  },
  reactionSection: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: dimensions.spacing.xs,
  },
  reactionHeadline: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: dimensions.spacing.xs,
  },
  reactionSubtext: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  userVoteMeta: {
    fontWeight: '700',
    textAlign: 'center',
  },
  voteNowButton: {
    minHeight: motion.touchTarget.minimum,
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.xs,
    marginTop: dimensions.spacing.xs,
  },
  voteNowText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  changeVoteText: {
    // fontSize now set dynamically with responsive sizing
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  percentageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  resultStatsGroup: {
    width: '100%',
    alignItems: 'center',
    gap: dimensions.spacing.sm,
  },
  resultVoteMetaGroup: {
    alignItems: 'center',
    width: '100%',
    gap: 2,
  },
  totalVotesRow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultGroupSpacer: {
    flex: 1,
    minHeight: dimensions.spacing.sm,
  },
  resultActionSpacer: {
    flex: 1.25,
    minHeight: dimensions.spacing.md,
  },
  percentageItem: {
    alignItems: 'center',
    flex: 1,
    minHeight: 74,
    justifyContent: 'center',
  },
  bigPercentage: {
    fontSize: 36, // Will be overridden by responsive calculation
    fontWeight: 'bold',
    marginBottom: 4,
  },
  percentageLabel: {
    // fontSize now set dynamically with responsive sizing
    fontWeight: '600',
  },
  percentageDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#E1E8ED',
    opacity: 0.5,
  },
  totalVotes: {
    // fontSize now set dynamically with responsive sizing
    fontStyle: 'italic',
  },
  continueHint: {
    // fontSize now set dynamically with responsive sizing
    marginTop: dimensions.spacing.md,
    fontStyle: 'italic',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  resultActionsGroup: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 0,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: motion.touchTarget.minimum,
    borderRadius: 20,
    gap: 4,
  },
  shareActionButton: {
    paddingHorizontal: 16,
  },
  contrarianShareActionButton: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
  },
  changeVoteUtility: {
    minHeight: motion.touchTarget.minimum,
    justifyContent: 'center',
    paddingHorizontal: dimensions.spacing.md,
    marginTop: 2,
  },
  actionIcon: {
    fontSize: 14,
  },
  actionText: {
    fontWeight: '600',
  },
  offScreenContainer: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 400,
    height: 600,
  },
});
