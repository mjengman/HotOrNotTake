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
    // Don't auto-initialize - do it on-demand based on what user requests
    console.log('🔄 RESERVE DEBUG - ReserveContentManager created (lazy initialization)');
  }

  // Initialize reserve pools for specific categories
  private async initializeCategoryIfNeeded(category: string): Promise<void> {
    if (this.reserves[category] && this.reserves[category].length > 0) {
      console.log(`✅ RESERVE DEBUG - ${category} already has ${this.reserves[category].length} reserves`);
      return; // Already initialized
    }
    
    console.log(`🔄 RESERVE DEBUG - Initializing ${category} reserves...`);
    
    try {
      this.reserves[category] = [];
      await this.replenishReserves(category, this.RESERVE_SIZE, true);
      console.log(`✅ RESERVE DEBUG - ${category} initialized with ${this.reserves[category].length} reserves`);
    } catch (error) {
      console.error(`❌ RESERVE DEBUG - Failed to initialize ${category}:`, error);
      this.reserves[category] = []; // Ensure array exists even if initialization fails
    }
  }
  
  // Initialize for "all" mode - only the categories we'll actually use
  private async initializeForAllMode(): Promise<void> {
    console.log('🔄 RESERVE DEBUG - Initializing reserves for "all" mode...');
    
    // Only initialize a few key categories for "all" mode to start
    const priorityCategories = ['food', 'technology', 'life', 'work', 'entertainment'];
    
    for (const category of priorityCategories) {
      await this.initializeCategoryIfNeeded(category);
    }
    
    console.log('✅ RESERVE DEBUG - Priority categories initialized for "all" mode');
  }

  // Get reserve takes for immediate display (smooth UX)
  public async getReserveContent(category: string, count: number = 10): Promise<TakeSubmission[]> {
    console.log(`🔥 RESERVE DEBUG - getReserveContent called for ${category}, requested: ${count}`);
    
    // Handle "all" category by mixing from different categories
    if (category === 'all') {
      await this.initializeForAllMode();
      return await this.getReserveContentMix(count);
    }

    // Initialize specific category if needed
    await this.initializeCategoryIfNeeded(category);
    
    // Get specific category reserves
    const categoryReserves = this.reserves[category] || [];
    const available = Math.min(count, categoryReserves.length);
    
    console.log(`🔥 RESERVE DEBUG - ${category} reserves: ${categoryReserves.length}, available: ${available}`);
    
    if (available === 0) {
      console.log(`⚠️ No reserves available for ${category}, generating on-demand`);
      return this.generateImmediateContent(category, count);
    }

    // Return reserves and remove them from pool
    const reservesToReturn = categoryReserves.splice(0, available);
    
    console.log(`🔥 RESERVE DEBUG - Returning ${reservesToReturn.length} reserves for ${category}`);
    reservesToReturn.forEach((reserve, i) => {
      console.log(`🔥 RESERVE DEBUG - Reserve ${i + 1}: "${reserve.text.substring(0, 30)}..."`);
    });
    
    // Trigger background replenishment if running low
    if (categoryReserves.length < this.MIN_RESERVE_THRESHOLD) {
      this.backgroundReplenish(category);
    }

    console.log(`🎯 Served ${available} reserve takes for ${category}`);
    return reservesToReturn;
  }

  // Get mixed content from initialized categories for "all" mode
  private async getReserveContentMix(count: number): Promise<TakeSubmission[]> {
    console.log(`🔥 RESERVE DEBUG - getReserveContentMix called for ${count} items`);
    
    const allReserves: TakeSubmission[] = [];
    
    // Collect reserves from initialized categories only
    for (const category of CATEGORIES) {
      const categoryReserves = this.reserves[category] || [];
      if (categoryReserves.length > 0) {
        console.log(`🔥 RESERVE DEBUG - ${category} has ${categoryReserves.length} reserves`);
        allReserves.push(...categoryReserves);
      }
    }

    console.log(`🔥 RESERVE DEBUG - Total reserves collected: ${allReserves.length}`);

    if (allReserves.length === 0) {
      console.log(`⚠️ No reserves available for "all", generating on-demand`);
      return this.generateImmediateContent('all', count);
    }

    // Shuffle and return requested count
    const shuffled = this.shuffleArray([...allReserves]);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    console.log(`🔥 RESERVE DEBUG - Selected ${selected.length} items from ${shuffled.length} available`);

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

    // Trigger background replenishment for categories running low (only initialized ones)
    for (const category of CATEGORIES) {
      if (this.reserves[category] && this.reserves[category].length < this.MIN_RESERVE_THRESHOLD) {
        this.backgroundReplenish(category);
      }
    }

    console.log(`🔥 RESERVE DEBUG - Returning ${selected.length} mixed reserves`);
    return selected;
  }

  // Generate content immediately when reserves are empty (fallback)
  private async generateImmediateContent(category: string, count: number): Promise<TakeSubmission[]> {
    console.log(`🔥 RESERVE DEBUG - generateImmediateContent for ${category}, count: ${count}`);
    const content: TakeSubmission[] = [];
    
    try {
      const actualCategory = category === 'all' ? CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)] : category;
      const generateCount = Math.min(count, 5); // Limit to 5 for performance
      
      console.log(`🔥 RESERVE DEBUG - Generating ${generateCount} immediate content for ${actualCategory}`);
      
      for (let i = 0; i < generateCount; i++) {
        const aiTake = await generateAITake(actualCategory);
        const submission = convertAITakeToSubmission(aiTake);
        content.push(submission);
        console.log(`🔥 RESERVE DEBUG - Generated immediate content ${i + 1}: "${submission.text.substring(0, 30)}..."`);
      }
      
      console.log(`🔥 RESERVE DEBUG - Generated ${content.length} immediate content items`);
    } catch (error) {
      console.error(`❌ Failed to generate immediate content for ${category}:`, error);
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

  // Submit reserve content to Firebase and update items with document IDs
  public async submitReserveContent(reserveContent: TakeSubmission[]): Promise<TakeSubmission[]> {
    console.log(`🔥 RESERVE DEBUG - submitReserveContent called with ${reserveContent.length} items`);
    
    const currentUser = auth.currentUser;
    console.log(`🔥 RESERVE DEBUG - Current user: ${currentUser ? currentUser.uid : 'NULL'}`);
    
    if (!currentUser) {
      console.log('🔥 RESERVE DEBUG - No authenticated user - cannot submit reserve content');
      throw new Error('No authenticated user for reserve content submission');
    }

    const submittedContent: TakeSubmission[] = [];
    let submitted = 0;
    let errors = 0;
    
    for (let i = 0; i < reserveContent.length; i++) {
      const reserve = reserveContent[i];
      console.log(`🔥 RESERVE DEBUG - Submitting reserve ${i + 1}/${reserveContent.length}`);
      
      try {
        const docId = await submitTake(reserve, currentUser.uid, true); // true = isAIGenerated, no embedding available in reserve
        console.log(`🔥 RESERVE DEBUG - SUCCESS ${i + 1}: ${docId}`);
        
        // Add document ID to the content
        submittedContent.push({
          ...reserve,
          id: docId
        });
        submitted++;
      } catch (error) {
        console.error(`🔥 RESERVE DEBUG - ERROR ${i + 1}:`, error);
        errors++;
        // Don't include failed submissions in result
      }
    }

    console.log(`🔥 RESERVE DEBUG - Final result: ${submitted} submitted, ${errors} errors`);
    
    if (submittedContent.length === 0) {
      throw new Error(`Failed to submit any reserve content: ${errors} errors occurred`);
    }
    
    return submittedContent;
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

  // Manual trigger to force replenishment for specific categories (for testing)
  public async forceReplenishCategory(category: string): Promise<void> {
    console.log(`🔧 Force replenishing ${category} reserves...`);
    await this.backgroundReplenish(category);
  }
  
  // Manual trigger to force replenishment for priority categories (for testing)
  public async forceReplenishPriority(): Promise<void> {
    console.log('🔧 Force replenishing priority categories...');
    const priorityCategories = ['food', 'technology', 'life', 'work', 'entertainment'];
    for (const category of priorityCategories) {
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
  console.log(`🔥 SMOOTH CONTENT - Starting getSmoothContent for ${category}, count: ${count}`);
  
  // Add natural delay for smooth UX
  console.log(`🔥 SMOOTH CONTENT - Adding natural delay of ${Math.round(naturalDelayMs)}ms`);
  await new Promise(resolve => setTimeout(resolve, naturalDelayMs));
  
  // Get reserve content
  console.log(`🔥 SMOOTH CONTENT - Getting reserve content...`);
  const reserves = await reserveManager.getReserveContent(category, count);
  
  if (reserves.length === 0) {
    console.log(`⚠️ SMOOTH CONTENT - No reserves available, returning empty array`);
    return [];
  }
  
  console.log(`🔥 SMOOTH CONTENT - Got ${reserves.length} reserves, submitting to Firebase...`);
  
  try {
    // Submit to Firebase and wait for completion (blocking)
    const submittedContent = await reserveManager.submitReserveContent(reserves);
    console.log(`✅ SMOOTH CONTENT - Successfully submitted ${submittedContent.length} takes to Firebase`);
    
    // Return the content with document IDs for vote targeting
    return submittedContent;
    
  } catch (error) {
    console.error(`❌ SMOOTH CONTENT - Firebase submission failed:`, error);
    
    // Fallback: return content without IDs (votes will fail but content shows)
    console.log(`🔄 SMOOTH CONTENT - Returning content without IDs as fallback`);
    return reserves;
  }
};