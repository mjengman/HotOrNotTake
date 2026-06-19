import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  BackHandler,
  Switch,
} from 'react-native';
import { AnimatedPressable } from './transitions/AnimatedPressable';
import { colors, motion } from '../constants';
import { useResponsive } from '../hooks/useResponsive';

interface BurgerMenuProps {
  isDarkMode: boolean;
  onMyTakes: () => void;
  onLeaderboard: () => void;
  onRecentVotes: () => void;
  onFavorites: () => void;
  onInstructions: () => void;
  onInviteFriends: () => void;
  onSafety: () => void;
  onVotingStyle: () => void;
  onToggleTheme: () => void;
  resultsAutoplay: boolean;
  onToggleResultsAutoplay: () => void;
}

const BurgerMenuComponent: React.FC<BurgerMenuProps> = ({
  isDarkMode,
  onMyTakes,
  onLeaderboard,
  onRecentVotes,
  onFavorites,
  onInstructions,
  onInviteFriends,
  onSafety,
  onVotingStyle,
  onToggleTheme,
  resultsAutoplay,
  onToggleResultsAutoplay,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = isDarkMode ? colors.dark : colors.light;
  const responsive = useResponsive();
  const burgerSize = Math.max(motion.touchTarget.comfortable, responsive.iconSize.xlarge + 2);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleMenuItemPress = useCallback((action: () => void) => {
    closeMenu();
    // Small delay to let the modal close before triggering action
    setTimeout(action, 100);
  }, [closeMenu]);

  const menuItems = useMemo(() => [
    {
      label: isDarkMode ? 'Light Mode' : 'Dark Mode',
      icon: isDarkMode ? '☀️' : '🌙',
      onPress: () => handleMenuItemPress(onToggleTheme),
    },
    {
      label: 'Instructions',
      icon: '❓',
      onPress: () => handleMenuItemPress(onInstructions),
    },
    {
      label: 'Invite & Review',
      icon: '💌',
      onPress: () => handleMenuItemPress(onInviteFriends),
    },
    {
      label: 'Leaderboard',
      icon: '🏆',
      onPress: () => handleMenuItemPress(onLeaderboard),
    },
    {
      label: 'My Favorites',
      icon: '⭐',
      onPress: () => handleMenuItemPress(onFavorites),
    },
    {
      label: 'My Takes',
      icon: '📝',
      onPress: () => handleMenuItemPress(onMyTakes),
    },
    {
      label: 'My Voting Style',
      icon: '🧭',
      onPress: () => handleMenuItemPress(onVotingStyle),
    },
    {
      label: 'Results Autoplay',
      icon: '▶️',
      onPress: onToggleResultsAutoplay,
      isSwitch: true,
    },
    {
      label: 'Safety & Reporting',
      icon: '🛡️',
      onPress: () => handleMenuItemPress(onSafety),
    },
    {
      label: 'Vote History',
      icon: '📊',
      onPress: () => handleMenuItemPress(onRecentVotes),
    },
  ].sort((first, second) => first.label.localeCompare(second.label)), [
    handleMenuItemPress,
    isDarkMode,
    onFavorites,
    onInstructions,
    onInviteFriends,
    onLeaderboard,
    onMyTakes,
    onRecentVotes,
    onSafety,
    onToggleResultsAutoplay,
    onToggleTheme,
    onVotingStyle,
  ]);

  // Handle back button when burger menu is open
  useEffect(() => {
    if (!isOpen) return;

    const backAction = () => {
      if (isOpen) {
        closeMenu();
        return true; // Prevent default back behavior
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isOpen]);

  return (
    <>
      {/* Burger Button */}
      <AnimatedPressable
        style={[
          styles.burgerButton,
          { 
            backgroundColor: isDarkMode ? theme.surface : '#F0F0F1',
            width: burgerSize,
            height: burgerSize,
            borderRadius: burgerSize / 2,
            marginTop: responsive.spacing.sm + 2,
          }
        ]}
        onPress={() => setIsOpen(true)}
        scaleValue={0.9}
        hapticFeedback={false}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
      >
        <View style={styles.burgerLines}>
          <View style={[styles.line, { backgroundColor: theme.text }]} />
          <View style={[styles.line, { backgroundColor: theme.text }]} />
          <View style={[styles.line, { backgroundColor: theme.text }]} />
        </View>
      </AnimatedPressable>

      {/* Burger Menu Modal */}
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="none"
        hardwareAccelerated={true}
        statusBarTranslucent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => closeMenu()}
      >
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => closeMenu()}
          >
            <SafeAreaView style={[
              styles.menuContainer,
              {
                marginTop: responsive.spacing.xxl * 2, // Scale from 100 to responsive  
                marginLeft: responsive.spacing.lg,
              }
            ]}>
            <View style={[styles.menu, { backgroundColor: theme.background }]}>
              {menuItems.map((item, index) => {
                const isLastItem = index === menuItems.length - 1;

                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.menuItem,
                      !isLastItem && { borderBottomColor: theme.border },
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                    accessibilityRole={item.isSwitch ? 'switch' : 'button'}
                    accessibilityState={item.isSwitch ? { checked: resultsAutoplay } : undefined}
                    accessibilityLabel={item.label}
                  >
                    <Text
                      style={styles.menuIcon}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >{item.icon}</Text>
                    <Text
                      style={[styles.menuText, { color: theme.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={item.isSwitch ? 0.75 : 0.8}
                    >
                      {item.label}
                    </Text>
                    {item.isSwitch && (
                      <Switch
                        value={resultsAutoplay}
                        onValueChange={onToggleResultsAutoplay}
                        trackColor={{ false: theme.border, true: theme.primaryLight }}
                        thumbColor={resultsAutoplay ? theme.primary : theme.textSecondary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </SafeAreaView>
        </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

export const BurgerMenu = React.memo(BurgerMenuComponent);

const styles = StyleSheet.create({
  burgerButton: {
    width: motion.touchTarget.comfortable,
    height: motion.touchTarget.comfortable,
    borderRadius: motion.touchTarget.comfortable / 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2.62,
  },
  burgerLines: {
    width: 18,
    height: 12,
    justifyContent: 'space-between',
  },
  line: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  menuContainer: {
    marginTop: 100, // Will be overridden inline
    marginLeft: 24, // Placeholder, will use responsive
  },
  menu: {
    borderRadius: 12,
    minWidth: 220,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24, // Placeholder, will use responsive
    paddingVertical: 16, // Placeholder, will use responsive
    minHeight: motion.touchTarget.comfortable,
  },
  menuIcon: {
    fontSize: 24, // Placeholder, will use responsive
    marginRight: 16, // Placeholder, will use responsive
  },
  menuText: {
    fontSize: 16, // Placeholder, will use responsive
    fontWeight: '500',
    flex: 1,
  },
});
