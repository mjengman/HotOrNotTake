import { getApprovedTakes, getUserInteractedTakeIds } from './takeService';
import { auth } from './firebase';

// Get available (unseen) takes for the current user by category
export const getUserAvailableTakesByCategory = async (): Promise<Record<string, number>> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return {};
    }

    // Get all approved takes and user interactions in parallel
    const [allTakes, interactedTakeIds] = await Promise.all([
      getApprovedTakes(),
      getUserInteractedTakeIds(currentUser.uid)
    ]);

    // Filter out takes the user has already interacted with
    const availableTakes = allTakes.filter(take => 
      !interactedTakeIds.includes(take.id)
    );

    // Count by category
    const categoryCounts: Record<string, number> = {};
    const categories = [
      'food', 'work', 'pets', 'technology', 'life', 'entertainment', 
      'environment', 'wellness', 'society', 'politics', 'sports', 'travel', 'relationships'
    ];
    
    // Initialize all categories to 0
    categories.forEach(cat => categoryCounts[cat] = 0);
    
    // Count available takes per category
    availableTakes.forEach(take => {
      if (categoryCounts[take.category] !== undefined) {
        categoryCounts[take.category]++;
      }
    });

    return categoryCounts;
  } catch (error) {
    console.error('Error getting user available takes by category:', error);
    return {};
  }
};

// Check if a specific category needs more content for the current user
export const categoryNeedsContentForUser = async (category: string, threshold: number = 5): Promise<boolean> => {
  try {
    const availableCounts = await getUserAvailableTakesByCategory();
    const availableCount = availableCounts[category] || 0;
    
    console.log(`📊 Category "${category}": ${availableCount} available takes for user`);
    return availableCount < threshold;
  } catch (error) {
    console.error(`Error checking if category ${category} needs content:`, error);
    return false;
  }
};