import React from 'react';
import { generateMultipleAITakes, convertAITakeToSubmission } from './aiContentService';
import { submitTake, getTakesByCategory } from './takeService';
import { auth } from './firebase';

// All available categories
const CATEGORIES = [
  'food', 'work', 'pets', 'technology', 'life', 'entertainment', 
  'environment', 'wellness', 'society', 'politics', 'sports', 'travel', 'relationships'
];

const MINIMUM_TAKES_PER_CATEGORY = 5; // Only generate when truly needed
const TARGET_TAKES_PER_CATEGORY = 10; // Generate fewer at a time

// Track seeding activity to prevent over-seeding
const seedingActivity: Record<string, { lastSeeded: number; generatedCount: number }> = {};

// Dynamic cooldown based on user activity and generation success
const getDynamicCooldown = (category: string): number => {
  const activity = seedingActivity[category];
  if (!activity) return 0; // No cooldown for first generation
  
  // Base cooldown of 1 minute, but scale based on how much we've generated
  const baseMs = 60 * 1000; // 1 minute base
  const scaleFactor = Math.min(activity.generatedCount / 5, 3); // Scale up to 3x for heavy generation
  
  return baseMs * (1 + scaleFactor); // 1-4 minute dynamic cooldown
};

// Check if a category needs seeding (with dynamic cooldown)
const categoryNeedsSeeding = (category: string): boolean => {
  const activity = seedingActivity[category];
  if (!activity) return true; // No previous activity = ready to seed
  
  const lastSeeded = activity.lastSeeded;
  const cooldownPeriod = getDynamicCooldown(category);
  const now = Date.now();
  
  const isReady = (now - lastSeeded) > cooldownPeriod;
  
  if (!isReady) {
    const remainingMs = cooldownPeriod - (now - lastSeeded);
    const remainingMin = Math.ceil(remainingMs / (60 * 1000));
    console.log(`⏳ Category "${category}" on cooldown for ${remainingMin} more minutes`);
  }
  
  return isReady;
};

// Mark category as recently seeded and track generation count
const markCategorySeeded = (category: string, generatedCount: number): void => {
  const now = Date.now();
  const currentActivity = seedingActivity[category] || { lastSeeded: 0, generatedCount: 0 };
  
  seedingActivity[category] = {
    lastSeeded: now,
    generatedCount: currentActivity.generatedCount + generatedCount
  };
  
  // Reset generation count after 1 hour to prevent permanent long cooldowns
  setTimeout(() => {
    if (seedingActivity[category]) {
      seedingActivity[category].generatedCount = Math.max(0, seedingActivity[category].generatedCount - generatedCount);
    }
  }, 60 * 60 * 1000); // 1 hour decay
};

// Generate AI takes for a specific category
const generateTakesForCategory = async (category: string, count: number): Promise<number> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log(`No authenticated user - skipping AI seeding for ${category}`);
    return 0;
  }

  try {
    console.log(`🤖 Generating ${count} AI takes for category: ${category}`);
    
    // Generate multiple takes for this specific category
    const aiTakes = [];
    for (let i = 0; i < count; i++) {
      try {
        const { generateAITake } = await import('./aiContentService');
        const aiTake = await generateAITake(category);
        aiTakes.push(aiTake);
        
        // Small delay to avoid rate limiting
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      } catch (error) {
        console.error(`Failed to generate AI take ${i + 1} for ${category}:`, error);
      }
    }

    // Submit the generated takes
    let submitted = 0;
    for (const aiTake of aiTakes) {
      try {
        const submission = convertAITakeToSubmission(aiTake);
        await submitTake(submission, currentUser.uid);
        submitted++;
        console.log(`✅ Seeded ${category}: "${aiTake.text.substring(0, 50)}..."`);
      } catch (error) {
        console.error(`Failed to submit AI take for ${category}:`, error);
      }
    }

    markCategorySeeded(category, submitted);
    return submitted;

  } catch (error) {
    console.error(`Error generating takes for category ${category}:`, error);
    return 0;
  }
};

// Check all categories and seed those that are running low FOR THE CURRENT USER
export const checkAndSeedCategories = async (): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return; // Wait for authentication
  }

  console.log('🔍 Checking user-specific category content levels...');
  
  // Import user-aware content checking
  const { getUserAvailableTakesByCategory } = await import('./userAvailableContent');
  const userAvailableCounts = await getUserAvailableTakesByCategory();
  
  for (const category of CATEGORIES) {
    try {
      // Skip if recently seeded
      if (!categoryNeedsSeeding(category)) {
        continue;
      }

      const availableForUser = userAvailableCounts[category] || 0;

      // Only generate if user has fewer than 5 unseen takes in this category
      if (availableForUser < MINIMUM_TAKES_PER_CATEGORY) {
        const needed = Math.min(5, TARGET_TAKES_PER_CATEGORY - availableForUser); // Generate max 5 at a time
        console.log(`📉 User has only ${availableForUser} unseen "${category}" takes, seeding ${needed} more`);
        
        const seeded = await generateTakesForCategory(category, needed);
        if (seeded > 0) {
          console.log(`🌱 Successfully seeded ${seeded} takes for "${category}"`);
        }
      } else {
        console.log(`✅ User has ${availableForUser} unseen "${category}" takes (sufficient)`);
      }

      // Small delay between category checks to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay

    } catch (error) {
      console.error(`Error checking category "${category}":`, error);
    }
  }
};

// Background monitoring service
let monitoringInterval: NodeJS.Timeout | null = null;
const MONITORING_INTERVAL = 15 * 60 * 1000; // Check every 15 minutes (less frequent)

export const startInvisibleAISeeding = (): void => {
  if (monitoringInterval) {
    return; // Already running
  }

  console.log('🤖 Starting invisible AI content seeding...');

  // Initial check after a delay to let the app initialize
  setTimeout(() => {
    checkAndSeedCategories().catch(console.error);
  }, 10000); // 10 second delay

  // Set up periodic monitoring
  monitoringInterval = setInterval(() => {
    checkAndSeedCategories().catch(console.error);
  }, MONITORING_INTERVAL);
};

export const stopInvisibleAISeeding = (): void => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Stopped invisible AI content seeding');
  }
};

// Hook for integration with React components
export const useInvisibleAISeeding = () => {
  React.useEffect(() => {
    startInvisibleAISeeding();
    
    return () => {
      // Don't stop on unmount - let it run globally
      // stopInvisibleAISeeding();
    };
  }, []);
};

// Manual trigger for testing (not exposed in UI)
export const triggerCategoryCheck = async (): Promise<void> => {
  await checkAndSeedCategories();
};

// Simplified function for manual pull-to-refresh generation
export const generateTakesForSingleCategory = async (category: string, count: number = 20): Promise<number> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log('No authenticated user - cannot generate content');
    return 0;
  }

  try {
    console.log(`🎯 Generating ${count} takes for category: ${category}`);
    
    const aiTakes = [];
    const { generateAITake } = await import('./aiContentService');
    
    // Generate the requested number of takes
    for (let i = 0; i < count; i++) {
      try {
        const aiTake = await generateAITake(category);
        aiTakes.push(aiTake);
        
        // Small delay to avoid rate limiting
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to generate take ${i + 1}:`, error);
      }
    }

    // Submit all generated takes
    let submitted = 0;
    for (const aiTake of aiTakes) {
      try {
        const submission = convertAITakeToSubmission(aiTake);
        await submitTake(submission, currentUser.uid);
        submitted++;
        console.log(`✅ Generated: "${aiTake.text.substring(0, 50)}..."`);
      } catch (error) {
        console.error('Failed to submit AI take:', error);
      }
    }

    console.log(`🎉 Successfully generated ${submitted}/${count} takes for ${category}`);
    return submitted;

  } catch (error) {
    console.error(`Error generating takes for ${category}:`, error);
    return 0;
  }
};