import { TakeSubmission } from '../types/Take';
import { generateAITake, convertAITakeToSubmission } from './aiContentService';
import { submitTake } from './takeService';
import { auth } from './firebase';

// Categories from your existing takes
const CATEGORIES = [
  'food', 'work', 'pets', 'technology', 'life', 'entertainment', 
  'environment', 'wellness', 'society', 'politics', 'sports', 'travel', 'relationships'
];

interface ReservePool {
  [category: string]: TakeSubmission[];
}

class ReserveContentManager {
  private reserves: ReservePool = {};
  private readonly RESERVE_SIZE = 15; // Number of takes to keep in reserve per category
  private readonly MIN_RESERVE_THRESHOLD = 5; // Minimum before replenishing
  private isReplenishing: { [category: string]: boolean } = {};

  constructor() {
    this.initializeReserves();
  }

  // Initialize reserve pools for all categories
  private async initializeReserves(): Promise<void> {
    console.log('🔄 Initializing reserve content pools...');
    
    for (const category of CATEGORIES) {
      this.reserves[category] = [];
      await this.replenishReserves(category, this.RESERVE_SIZE, true);
    }
    
    console.log('✅ Reserve content pools initialized');
  }

  // Get reserve takes for immediate display (smooth UX)
  public async getReserveContent(category: string, count: number = 10): Promise<TakeSubmission[]> {
    // Handle "all" category by mixing from different categories
    if (category === 'all') {
      return this.getReserveContentMix(count);
    }

    // Get specific category reserves
    const categoryReserves = this.reserves[category] || [];
    const available = Math.min(count, categoryReserves.length);
    
    if (available === 0) {
      console.log(`⚠️ No reserves available for ${category}, generating on-demand`);
      return this.generateImmediateContent(category, count);
    }

    // Return reserves and remove them from pool
    const reservesToReturn = categoryReserves.splice(0, available);
    
    // Trigger background replenishment if running low
    if (categoryReserves.length < this.MIN_RESERVE_THRESHOLD) {
      this.backgroundReplenish(category);
    }

    console.log(`🎯 Served ${available} reserve takes for ${category}`);
    return reservesToReturn;
  }

  // Get mixed content from all categories for "all" mode
  private getReserveContentMix(count: number): TakeSubmission[] {
    const allReserves: TakeSubmission[] = [];
    
    // Collect reserves from all categories
    for (const category of CATEGORIES) {
      const categoryReserves = this.reserves[category] || [];
      allReserves.push(...categoryReserves);
    }

    // Shuffle and return requested count
    const shuffled = this.shuffleArray([...allReserves]);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    // Remove selected items from their respective category reserves
    selected.forEach(selectedTake => {
      for (const category of CATEGORIES) {
        const index = this.reserves[category]?.findIndex(take => 
          take.text === selectedTake.text && take.category === selectedTake.category
        );
        if (index !== undefined && index >= 0) {
          this.reserves[category].splice(index, 1);
        }
      }
    });

    // Trigger background replenishment for categories running low
    for (const category of CATEGORIES) {
      if ((this.reserves[category]?.length || 0) < this.MIN_RESERVE_THRESHOLD) {
        this.backgroundReplenish(category);
      }
    }

    return selected;
  }

  // Generate content immediately when reserves are empty (fallback)
  private async generateImmediateContent(category: string, count: number): Promise<TakeSubmission[]> {
    const content: TakeSubmission[] = [];
    
    try {
      for (let i = 0; i < Math.min(count, 5); i++) { // Limit to 5 for performance
        const aiTake = await generateAITake(category);
        content.push(convertAITakeToSubmission(aiTake));
      }
    } catch (error) {
      console.error(`Failed to generate immediate content for ${category}:`, error);
    }

    return content;
  }

  // Replenish reserves in the background
  private async backgroundReplenish(category: string): Promise<void> {
    if (this.isReplenishing[category]) return; // Avoid duplicate replenishment

    this.isReplenishing[category] = true;
    console.log(`🔄 Background replenishing reserves for ${category}...`);

    try {
      const currentCount = this.reserves[category]?.length || 0;
      const needed = this.RESERVE_SIZE - currentCount;
      
      if (needed > 0) {
        await this.replenishReserves(category, needed, false);
      }
    } catch (error) {
      console.error(`Failed to replenish reserves for ${category}:`, error);
    } finally {
      this.isReplenishing[category] = false;
    }
  }

  // Generate and store new reserves
  private async replenishReserves(category: string, count: number, isInitial: boolean = false): Promise<void> {
    const logPrefix = isInitial ? '🚀' : '🔄';
    console.log(`${logPrefix} Generating ${count} reserve takes for ${category}...`);

    const newReserves: TakeSubmission[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const aiTake = await generateAITake(category);
        newReserves.push(convertAITakeToSubmission(aiTake));
        
        // Small delay to avoid rate limiting
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      } catch (error) {
        console.error(`Failed to generate reserve take ${i + 1} for ${category}:`, error);
      }
    }

    // Add to reserves pool (don't submit to Firebase yet)
    if (!this.reserves[category]) {
      this.reserves[category] = [];
    }
    this.reserves[category].push(...newReserves);

    console.log(`✅ Generated ${newReserves.length}/${count} reserve takes for ${category}`);
  }

  // Submit reserve content to Firebase and return count
  public async submitReserveContent(reserveContent: TakeSubmission[]): Promise<number> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No authenticated user - cannot submit reserve content');
      return 0;
    }

    let submitted = 0;
    for (const reserve of reserveContent) {
      try {
        await submitTake(reserve, currentUser.uid, true); // true = isAIGenerated
        submitted++;
      } catch (error) {
        console.error('Failed to submit reserve content:', error);
      }
    }

    return submitted;
  }

  // Utility function to shuffle array
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Get reserve pool status for debugging
  public getReserveStatus(): { [category: string]: number } {
    const status: { [category: string]: number } = {};
    for (const category of CATEGORIES) {
      status[category] = this.reserves[category]?.length || 0;
    }
    return status;
  }

  // Manual trigger to force replenishment (for testing)
  public async forceReplenishAll(): Promise<void> {
    console.log('🔧 Force replenishing all reserve pools...');
    for (const category of CATEGORIES) {
      await this.backgroundReplenish(category);
    }
  }
}

// Singleton instance
const reserveManager = new ReserveContentManager();
export default reserveManager;

// Export the smooth loading function for UI integration
export const getSmoothContent = async (
  category: string, 
  count: number = 10,
  naturalDelayMs: number = 2000 + Math.random() * 2000 // 2-4 seconds
): Promise<TakeSubmission[]> => {
  // Add natural delay for smooth UX
  await new Promise(resolve => setTimeout(resolve, naturalDelayMs));
  
  // Get reserve content
  const reserves = await reserveManager.getReserveContent(category, count);
  
  // Submit to Firebase in background (non-blocking)
  setTimeout(async () => {
    const submitted = await reserveManager.submitReserveContent(reserves);
    console.log(`📤 Submitted ${submitted} reserve takes to Firebase`);
  }, 0);
  
  return reserves;
};