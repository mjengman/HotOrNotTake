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
import { colors } from '../constants';
import { useResponsive } from '../hooks/useResponsive';

interface BurgerMenuProps {
  isDarkMode: boolean;
  onMyTakes: () => void;
  onLeaderboard: () => void;
  onRecentVotes: () => void;
  onInstructions: () => void;
  onToggleTheme: () => void;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({
  isDarkMode,
  onMyTakes,
  onLeaderboard,
  onRecentVotes,
  onInstructions,
  onToggleTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = isDarkMode ? colors.dark : colors.light;
  const responsive = useResponsive();

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
          { 
            backgroundColor: isDarkMode ? theme.surface : '#F0F0F1',
            width: responsive.iconSize.xlarge + 2, // Scale from 45 to responsive
            height: responsive.iconSize.xlarge + 2,
            borderRadius: (responsive.iconSize.xlarge + 2) / 2,
            marginTop: responsive.spacing.sm + 2, // Scale from 10 to responsive
          }
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
            <SafeAreaView style={[
              styles.menuContainer,
              {
                marginTop: responsive.spacing.xxl * 2, // Scale from 100 to responsive  
                marginLeft: responsive.spacing.lg,
              }
            ]}>
            <View style={[styles.menu, { backgroundColor: theme.background }]}>
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => handleMenuItemPress(onMyTakes)}
                activeOpacity={0.7}
              >
                <Text 
                  style={styles.menuIcon}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >📝</Text>
                <Text 
                  style={[styles.menuText, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >My Takes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => handleMenuItemPress(onLeaderboard)}
                activeOpacity={0.7}
              >
                <Text 
                  style={styles.menuIcon}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >🏆</Text>
                <Text 
                  style={[styles.menuText, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >Leaderboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => handleMenuItemPress(onRecentVotes)}
                activeOpacity={0.7}
              >
                <Text 
                  style={styles.menuIcon}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >📊</Text>
                <Text 
                  style={[styles.menuText, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >Recent Votes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => handleMenuItemPress(onInstructions)}
                activeOpacity={0.7}
              >
                <Text 
                  style={styles.menuIcon}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >❓</Text>
                <Text 
                  style={[styles.menuText, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >Instructions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuItemPress(onToggleTheme)}
                activeOpacity={0.7}
              >
                <Text 
                  style={styles.menuIcon}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >{isDarkMode ? '☀️' : '🌙'}</Text>
                <Text 
                  style={[styles.menuText, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
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
    width: 45, // Will be overridden inline
    height: 45, // Will be overridden inline  
    borderRadius: 40, // Will be overridden inline
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10, // Will be overridden inline
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