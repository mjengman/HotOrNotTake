import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  BackHandler,
} from 'react-native';
import { AnimatedPressable } from './transitions/AnimatedPressable';
import { colors, dimensions } from '../constants';

interface BurgerMenuProps {
  isDarkMode: boolean;
  onMyTakes: () => void;
  onLeaderboard: () => void;
  onRecentVotes: () => void;
  onToggleTheme: () => void;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({
  isDarkMode,
  onMyTakes,
  onLeaderboard,
  onRecentVotes,
  onToggleTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = isDarkMode ? colors.dark : colors.light;

  const handleMenuItemPress = (action: () => void) => {
    setIsOpen(false);
    // Small delay to let the modal close before triggering action
    setTimeout(action, 100);
  };

  // Handle back button when burger menu is open
  useEffect(() => {
    if (!isOpen) return;

    const backAction = () => {
      if (isOpen) {
        setIsOpen(false);
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
          { backgroundColor: isDarkMode ? theme.surface : '#F0F0F1' }
        ]}
        onPress={() => setIsOpen(true)}
        scaleValue={0.9}
        hapticIntensity={8}
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
        animationType="fade"
        statusBarTranslucent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          >
            <SafeAreaView style={styles.menuContainer}>
            <View style={[styles.menu, { backgroundColor: theme.background }]}>
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => handleMenuItemPress(onMyTakes)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuIcon}>📝</Text>
                <Text style={[styles.menuText, { color: theme.text }]}>My Takes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => handleMenuItemPress(onLeaderboard)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuIcon}>🏆</Text>
                <Text style={[styles.menuText, { color: theme.text }]}>Leaderboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => handleMenuItemPress(onRecentVotes)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuIcon}>📊</Text>
                <Text style={[styles.menuText, { color: theme.text }]}>Recent Votes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuItemPress(onToggleTheme)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
                <Text style={[styles.menuText, { color: theme.text }]}>
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  burgerButton: {
    width: 45,
    height: 45,
    borderRadius: 40,
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
    marginTop: 100, // Position below header
    marginLeft: dimensions.spacing.lg,
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
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
  },
  menuIcon: {
    fontSize: dimensions.fontSize.xlarge,
    marginRight: dimensions.spacing.md,
  },
  menuText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '500',
    flex: 1,
  },
});