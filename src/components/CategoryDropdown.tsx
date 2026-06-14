import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  BackHandler,
} from 'react-native';
import { colors, dimensions, motion } from '../constants';
import { AnimatedPressable } from './transitions/AnimatedPressable';

const CATEGORIES = [
  { value: 'all', label: '🎲 All Categories', emoji: '🎲' },
  { value: 'food', label: '🍕 Food', emoji: '🍕' },
  { value: 'work', label: '💼 Work', emoji: '💼' },
  { value: 'pets', label: '🐕 Pets', emoji: '🐕' },
  { value: 'technology', label: '📱 Technology', emoji: '📱' },
  { value: 'life', label: '🌟 Life', emoji: '🌟' },
  { value: 'entertainment', label: '🎬 Entertainment', emoji: '🎬' },
  { value: 'environment', label: '🌱 Environment', emoji: '🌱' },
  { value: 'wellness', label: '💪 Wellness', emoji: '💪' },
  { value: 'society', label: '🏛️ Society', emoji: '🏛️' },
  { value: 'politics', label: '🗳️ Politics', emoji: '🗳️' },
  { value: 'sports', label: '⚽ Sports', emoji: '⚽' },
  { value: 'travel', label: '✈️ Travel', emoji: '✈️' },
  { value: 'relationships', label: '💕 Relationships', emoji: '💕' },
];

const EMOJI_PREFIX_PATTERN = /^🎲 |^🍕 |^💼 |^🐕 |^📱 |^🌟 |^🎬 |^🌱 |^💪 |^🏛️ |^🗳️ |^⚽ |^✈️ |^💕 /;
const getCategoryName = (label: string) => label.replace(EMOJI_PREFIX_PATTERN, '');

interface CategoryDropdownProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  isDarkMode: boolean;
}

export const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  selectedCategory,
  onCategoryChange,
  isDarkMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = isDarkMode ? colors.dark : colors.light;

  const selectedCategoryData = CATEGORIES.find(cat => cat.value === selectedCategory) || CATEGORIES[0];

  const handleCategorySelect = (categoryValue: string) => {
    onCategoryChange(categoryValue);
    setIsOpen(false);
  };

  // Handle back button when category dropdown is open
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
    <View style={styles.container}>
      <AnimatedPressable
        style={[styles.dropdown, { 
          backgroundColor: isDarkMode ? theme.surface : '#F0F0F1',
          borderColor: theme.border,
        }]}
        onPress={() => setIsOpen(true)}
        scaleValue={0.98}
        hapticIntensity={motion.haptic.light}
        accessibilityRole="button"
        accessibilityLabel={`Selected category: ${getCategoryName(selectedCategoryData.label)}`}
      >
        <Text 
          style={[styles.dropdownText, { color: theme.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {selectedCategoryData.emoji} {getCategoryName(selectedCategoryData.label)}
        </Text>
        <Text style={[styles.dropdownArrow, { color: theme.textSecondary }]}>▼</Text>
      </AnimatedPressable>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? theme.surface : '#FFFFFF' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Choose Category
              </Text>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={styles.closeButton}
              >
                <Text style={[styles.closeButtonText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.categoriesList} showsVerticalScrollIndicator={false}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryItem,
                    selectedCategory === category.value && {
                      backgroundColor: theme.primaryLight || theme.primary + '20',
                    },
                    { borderBottomColor: theme.border }
                  ]}
                  onPress={() => handleCategorySelect(category.value)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.categoryEmoji]}>{category.emoji}</Text>
                  <Text style={[
                    styles.categoryLabel,
                    { color: theme.text },
                    selectedCategory === category.value && { fontWeight: 'bold' }
                  ]}>
                    {getCategoryName(category.label)}
                  </Text>
                  {selectedCategory === category.value && (
                    <Text style={[styles.checkmark, { color: theme.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // marginBottom: dimensions.spacing.md, // Remove bottom margin
    zIndex: 1000, // Ensure it's above other elements
    elevation: 10, // For Android
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: dimensions.spacing.md,
    paddingVertical: dimensions.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  dropdownText: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '500',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: dimensions.fontSize.small,
    marginLeft: dimensions.spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 350,
    maxHeight: '70%',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.34,
    shadowRadius: 6.27,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
  },
  closeButton: {
    minWidth: motion.touchTarget.minimum,
    minHeight: motion.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
  },
  categoriesList: {
    maxHeight: 400,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: dimensions.spacing.lg,
    paddingVertical: dimensions.spacing.md,
    borderBottomWidth: 0.5,
    minHeight: motion.touchTarget.comfortable,
  },
  categoryEmoji: {
    fontSize: dimensions.fontSize.large,
    marginRight: dimensions.spacing.md,
    width: 30,
    textAlign: 'center',
  },
  categoryLabel: {
    fontSize: dimensions.fontSize.medium,
    fontWeight: '500',
    flex: 1,
  },
  checkmark: {
    fontSize: dimensions.fontSize.large,
    fontWeight: 'bold',
  },
});
