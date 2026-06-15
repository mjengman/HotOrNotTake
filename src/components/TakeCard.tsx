import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import { Take } from '../types';
import { colors, dimensions, motion } from '../constants';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../hooks/useAuth';
import { addToFavorites, removeFromFavorites, isInFavorites } from '../services/favoritesService';
import { reportTake } from '../services/takeService';
import { VisualShareCard } from './VisualShareCard';

interface TakeCardProps {
  take: Take;
  isDarkMode?: boolean;
  onNotPress?: () => void;
  onHotPress?: () => void;
  showStats?: boolean;
  userVote?: 'hot' | 'not' | null;
  isFlipped?: boolean;
  onChangeVote?: (take: Take) => void;
  onVoteNow?: (take: Take) => void;
}

export const TakeCard: React.FC<TakeCardProps> = ({ 
  take, 
  isDarkMode = false,
  onNotPress,
  onHotPress,
  showStats = true,
  userVote = null,
  isFlipped = false,
  onChangeVote,
  onVoteNow,
}) => {
  const theme = isDarkMode ? colors.dark : colors.light;
  const responsive = useResponsive();
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const visualShareRef = useRef<ViewShot>(null);
  
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
  const resultTextSize = Math.min(adaptiveTextSize * 0.84, responsive.fontSize.medium + 1);
  const resultTextLineHeight = resultTextSize * 1.28;
  const resultTextLines = responsive.card.height < 440 ? 3 : 4;
  const cardSurface = isDarkMode ? '#2B2B2B' : '#FEFCF8';
  const cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.07)' : '#EFE7DA';
  const cardHighlight = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.82)';
  const canReport = take.id !== 'preview';
  
  // Calculate percentages for the reveal
  // Some takes may not have totalVotes, so calculate from individual votes
  const totalVotes = take.totalVotes || (take.hotVotes + take.notVotes) || 0;
  
  // Check if this take is favorited
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (user) {
        try {
          const favorited = await isInFavorites(user.uid, take.id);
          setIsFavorited(favorited);
        } catch (error) {
          console.error('Error checking favorite status:', error);
        }
      }
    };
    
    checkFavoriteStatus();
  }, [user, take.id]);
  
  const handleShare = async () => {
    try {
      const SMART_LINK = 'https://hot-or-not-takes.web.app/download';
      
      // Try visual sharing first
      if (visualShareRef.current?.capture) {
        try {
          console.log('🖼️ Generating visual share card...');
          
          // Capture the visual share card as image
          const imageUri = await visualShareRef.current.capture();

          if (!imageUri) throw new Error('Capture failed / imageUri missing');
          console.log('✅ Visual share card generated:', imageUri);
          
          // Share ONLY the image - no text, no links
          await RNShare.open({
            url: imageUri,
            failOnCancel: false,
          });
          
          return; // Success - exit early
          
        } catch (visualError) {
          console.log('⚠️ Visual sharing failed, falling back to text:', visualError);
        }
      }
      
      // Fallback to enhanced text sharing
      const hotPercentage = totalVotes > 0 ? Math.round((take.hotVotes / totalVotes) * 100) : 50;
      const notPercentage = totalVotes > 0 ? Math.round((take.notVotes / totalVotes) * 100) : 50;
      
      const shareMessage = `🔥 CHECK OUT THIS HOT TAKE! 🔥\n\n"${take.text}"\n\n📊 COMMUNITY VERDICT:\n🔥 ${hotPercentage}% HOT\n❄️ ${notPercentage}% NOT\n\n👥 ${totalVotes.toLocaleString()} total votes\n\n${userVote ? `I voted ${userVote.toUpperCase()}! ` : ''}What's your take?\n\nJoin the debate: ${SMART_LINK}`;
      
      await RNShare.open({
        title: 'Hot or Not Takes',
        message: shareMessage,
        failOnCancel: false,
      });
      
    } catch (error) {
      console.log('All sharing failed:', error);
      // Final fallback to built-in Share
      try {
        const fallbackMessage = `"${take.text}"\n\nCheck out this hot take! https://hot-or-not-takes.web.app/download`;
        await Share.share({ message: fallbackMessage });
      } catch (finalError) {
        console.log('Final fallback failed:', finalError);
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
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleReport = async () => {
    if (reportLoading) return;

    setReportLoading(true);
    try {
      await reportTake(take.id);
      Alert.alert(
        'Report submitted',
        'Thanks for helping keep Hot or Not Takes safe. For CSAE, CSAM, or child safety concerns, email engmanlabs@gmail.com.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error reporting take:', error);
      Alert.alert(
        'Report failed',
        'Please try again, or email engmanlabs@gmail.com for child safety concerns.',
        [{ text: 'OK' }]
      );
    } finally {
      setReportLoading(false);
    }
  };
  
  
  // Calculate percentages for the reveal (already calculated totalVotes above for debug)
  const hotPercentage = totalVotes > 0 ? Math.round((take.hotVotes / totalVotes) * 100) : 50;
  const notPercentage = totalVotes > 0 ? Math.round((take.notVotes / totalVotes) * 100) : 50;
  
  

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
        justifyContent: isFlipped ? 'flex-start' : 'space-between',
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
        {canReport && (
          <TouchableOpacity
            style={[
              styles.reportButton,
              {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#FFF8EF',
                borderColor: cardBorder,
              },
            ]}
            onPress={handleReport}
            disabled={reportLoading}
            activeOpacity={0.72}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Report this take"
          >
            <Text style={[styles.reportText, { color: theme.textSecondary }]}>
              Report
            </Text>
          </TouchableOpacity>
        )}
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
              paddingVertical: responsive.spacing.xs,
            }
          ]}>
            <View style={[styles.voteSection, { marginBottom: responsive.spacing.xs, justifyContent: 'center', alignItems: 'center' }]}>
              {userVote ? (
                <>
                  <Text style={[
                    styles.yourVote, 
                    { 
                      color: theme.text,
                      fontSize: responsive.fontSize.medium,
                      textAlign: 'center'
                    }
                  ]}>
                    You voted {userVote === 'hot' ? '🔥 HOT' : '❄️ NOT'}
                  </Text>
                  {onChangeVote && (
                    <TouchableOpacity
                      style={styles.changeVoteButton}
                      onPress={() => onChangeVote(take)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.changeVoteText, 
                        { 
                          color: theme.primary,
                          fontSize: responsive.fontSize.small,
                          textAlign: 'center'
                        }
                      ]}>
                        Change your vote
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <Text style={[
                    styles.yourVote, 
                    { 
                      color: theme.textSecondary,
                      fontSize: responsive.fontSize.medium,
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }
                  ]}>
                    You haven't voted yet
                  </Text>
                  {onVoteNow && (
                    <TouchableOpacity
                      style={[styles.changeVoteButton, { backgroundColor: theme.primary + '15' }]}
                      onPress={() => onVoteNow(take)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.changeVoteText, 
                        { 
                          color: theme.primary,
                          fontSize: responsive.fontSize.small,
                          textAlign: 'center',
                          fontWeight: 'bold'
                        }
                      ]}>
                        🗳️ Vote now!
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
            <View style={[styles.percentageContainer, { minHeight: 50, marginBottom: responsive.spacing.xs, justifyContent: 'center', alignItems: 'center' }]}>
              <View style={[styles.percentageItem, { minHeight: 40, justifyContent: 'center', alignItems: 'center' }]}>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[
                    styles.bigPercentage, 
                    { 
                      color: theme.not,
                      fontSize: responsive.fontSize.xlarge + 2,
                      textAlign: 'center'
                    }
                  ]}>
                    {notPercentage}%
                  </Text>
                </View>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[
                    styles.percentageLabel, 
                    { 
                      color: theme.textSecondary,
                      fontSize: responsive.fontSize.small,
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
                  height: responsive.spacing.xl
                }
              ]} />
              <View style={[styles.percentageItem, { minHeight: 40, justifyContent: 'center', alignItems: 'center' }]}>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[
                    styles.bigPercentage, 
                    { 
                      color: theme.hot,
                      fontSize: responsive.fontSize.xlarge + 2,
                      textAlign: 'center'
                    }
                  ]}>
                    {hotPercentage}%
                  </Text>
                </View>
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[
                    styles.percentageLabel, 
                    { 
                      color: theme.textSecondary,
                      fontSize: responsive.fontSize.small,
                      textAlign: 'center'
                    }
                  ]}>
                    HOT
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 4 }}>
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
            
            {/* Action Buttons */}
            <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 6 }}>
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
                  style={[styles.actionButton, { backgroundColor: theme.primary + '20' }]}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionIcon, { color: theme.primary }]}>↗️</Text>
                  <Text style={[styles.actionText, { color: theme.primary, fontSize: responsive.fontSize.small }]}>
                    Share
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
      
      {/* Off-screen VisualShareCard for image generation */}
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
    position: 'relative',
    // marginBottom now set dynamically with adaptive spacing
  },
  reportButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  reportText: {
    fontSize: 11,
    fontWeight: '700',
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
    alignItems: 'center',
    paddingVertical: dimensions.spacing.md,
    // flex: 1, // Fill available space to match front card layout
    justifyContent: 'flex-start', // Align content to top instead of center
  },
  voteSection: {
    alignItems: 'center',
    marginBottom: dimensions.spacing.md,
  },
  yourVote: {
    // fontSize now set dynamically with responsive sizing
    fontWeight: '600',
    marginBottom: dimensions.spacing.xs,
  },
  changeVoteButton: {
    marginTop: dimensions.spacing.xs,
    minHeight: motion.touchTarget.minimum,
    justifyContent: 'center',
  },
  changeVoteText: {
    // fontSize now set dynamically with responsive sizing
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  percentageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginBottom: dimensions.spacing.sm,
  },
  percentageItem: {
    alignItems: 'center',
    flex: 1,
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
    marginTop: dimensions.spacing.xs,
  },
  continueHint: {
    // fontSize now set dynamically with responsive sizing
    marginTop: dimensions.spacing.md,
    fontStyle: 'italic',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
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
