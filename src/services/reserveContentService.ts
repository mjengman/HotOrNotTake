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
  private replenishAttempts: { [category: string]: number } = {}; // Track replenish attempts
  private readonly MAX_REPLENISH_ATTEMPTS = 3; // Max attempts per category
  private lastReplenishTime: { [category: string]: number } = {}; // Track timing
  private readonly REPLENISH_COOLDOWN = 30000; // 30 second cooldown between replenishments

  constructor() {
    // Don't auto-initialize - do it on-demand based on what user requests
  }

  // Initialize reserve pools for specific categories
  private async initializeCategoryIfNeeded(category: string): Promise<void> {
    if (this.reserves[category] && this.reserves[category].length > 0) {
      return; // Already initialized
    }
    
    console.log(`🔄 Initializing ${category} reserves...`);
    
    try {
      this.reserves[category] = [];
      await this.replenishReserves(category, this.RESERVE_SIZE, true);
      console.log(`✅ ${category} ready: ${this.reserves[category].length} reserves`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${category}:`, error);
      this.reserves[category] = []; // Ensure array exists even if initialization fails
    }
  }
  
  // Initialize for "all" mode - ensure variety across categories
  private async initializeForAllMode(): Promise<void> {
    console.log('🔄 Initializing mixed categories for "all" mode...');
    
    // Initialize multiple categories to ensure variety
    // Shuffle and pick 5-6 random categories to start with
    const shuffledCategories = this.shuffleArray([...CATEGORIES]);
    const categoriesToInit = shuffledCategories.slice(0, 6);
    
    console.log(`📋 Initializing categories: ${categoriesToInit.join(', ')}`);
    
    for (const category of categoriesToInit) {
      await this.initializeCategoryIfNeeded(category);
    }
    
    console.log('✅ Mixed categories ready for "all" mode with variety');
  }

  // Get reserve takes for immediate display (smooth UX)
  public async getReserveContent(category: string, count: number = 10): Promise<TakeSubmission[]> {
    console.log(`📦 getReserveContent: Starting for ${category}, count: ${count}`);
    
    // Handle "all" category by mixing from different categories
    if (category === 'all') {
      console.log(`📦 getReserveContent: Initializing for "all" mode...`);
      await this.initializeForAllMode();
      console.log(`📦 getReserveContent: Getting mixed content...`);
      return await this.getReserveContentMix(count);
    }

    // Initialize specific category if needed
    console.log(`📦 getReserveContent: Initializing ${category} if needed...`);
    await this.initializeCategoryIfNeeded(category);
    console.log(`📦 getReserveContent: Initialization complete for ${category}`);
    
    // Get specific category reserves
    const categoryReserves = this.reserves[category] || [];
    const available = Math.min(count, categoryReserves.length);
    
    if (available === 0) {
      console.log(`⚠️ No reserves available for ${category}, generating on-demand`);
      return this.generateImmediateContent(category, count);
    }

    // Return reserves and remove them from pool
    const reservesToReturn = categoryReserves.splice(0, available);
    
    // Trigger background replenishment if running low (with safeguards)
    if (categoryReserves.length < this.MIN_RESERVE_THRESHOLD) {
      this.safeBackgroundReplenish(category);
    }

    console.log(`🎯 Served ${available} ${category} takes`);
    return reservesToReturn;
  }

  // Get mixed content from initialized categories for "all" mode
  private async getReserveContentMix(count: number): Promise<TakeSubmission[]> {
    const allReserves: TakeSubmission[] = [];
    
    // Collect reserves from initialized categories only
    for (const category of CATEGORIES) {
      const categoryReserves = this.reserves[category] || [];
      if (categoryReserves.length > 0) {
        allReserves.push(...categoryReserves);
      }
    }

    if (allReserves.length === 0) {
      console.log(`⚠️ No reserves available for "all", generating on-demand`);
      return this.generateImmediateContent('all', count);
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

    // Trigger background replenishment for categories running low (only initialized ones)
    for (const category of CATEGORIES) {
      if (this.reserves[category] && this.reserves[category].length < this.MIN_RESERVE_THRESHOLD) {
        this.safeBackgroundReplenish(category);
      }
    }

    console.log(`🎯 Mixed reserves: ${selected.length} takes from ${allReserves.length} available`);
    return selected;
  }

  // Generate content immediately when reserves are empty (fallback)
  private async generateImmediateContent(category: string, count: number): Promise<TakeSubmission[]> {
    const content: TakeSubmission[] = [];
    
    try {
      if (category === 'all') {
        // For "all" mode, generate a mix of categories
        const generateCount = Math.min(count, 20); // Allow more for variety
        const categoriesPerBatch = Math.min(5, CATEGORIES.length); // Use 5 different categories per batch
        const takesPerCategory = Math.ceil(generateCount / categoriesPerBatch);
        
        console.log(`⚡ Generating ${generateCount} mixed takes across ${categoriesPerBatch} categories`);
        
        // Shuffle categories to get random selection
        const shuffledCategories = this.shuffleArray([...CATEGORIES]);
        const selectedCategories = shuffledCategories.slice(0, categoriesPerBatch);
        
        for (const selectedCategory of selectedCategories) {
          for (let i = 0; i < takesPerCategory && content.length < generateCount; i++) {
            try {
              const aiTake = await generateAITake(selectedCategory);
              const submission = convertAITakeToSubmission(aiTake);
              content.push(submission);
            } catch (error) {
              console.log(`⚠️ Failed to generate take for ${selectedCategory}:`, error);
            }
          }
        }
        
        // Shuffle the final content to mix categories
        const shuffledContent = this.shuffleArray(content);
        console.log(`✅ Generated ${shuffledContent.length} mixed takes`);
        return shuffledContent;
      } else {
        // Single category generation
        const generateCount = Math.min(count, 5); // Limit to 5 for performance
        
        console.log(`⚡ Generating ${generateCount} immediate takes for ${category}`);
        
        for (let i = 0; i < generateCount; i++) {
          const aiTake = await generateAITake(category);
          const submission = convertAITakeToSubmission(aiTake);
          content.push(submission);
        }
        
        console.log(`✅ Generated ${content.length} immediate takes`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate immediate content for ${category}:`, error);
    }

    return content;
  }

  // Safe background replenishment with loop prevention
  private safeBackgroundReplenish(category: string): void {
    const now = Date.now();
    const lastReplenish = this.lastReplenishTime[category] || 0;
    const attempts = this.replenishAttempts[category] || 0;
    
    // Check cooldown period
    if (now - lastReplenish < this.REPLENISH_COOLDOWN) {
      console.log(`⏸️ ${category} replenishment on cooldown (${Math.round((this.REPLENISH_COOLDOWN - (now - lastReplenish)) / 1000)}s remaining)`);
      return;
    }
    
    // Check max attempts
    if (attempts >= this.MAX_REPLENISH_ATTEMPTS) {
      console.log(`🛑 ${category} hit max replenishment attempts (${attempts}/${this.MAX_REPLENISH_ATTEMPTS})`);
      return;
    }
    
    // Proceed with replenishment
    this.backgroundReplenish(category);
  }

  // Replenish reserves in the background
  private async backgroundReplenish(category: string): Promise<void> {
    if (this.isReplenishing[category]) return; // Avoid duplicate replenishment

    this.isReplenishing[category] = true;
    this.lastReplenishTime[category] = Date.now();
    this.replenishAttempts[category] = (this.replenishAttempts[category] || 0) + 1;

    try {
      const currentCount = this.reserves[category]?.length || 0;
      const needed = Math.min(this.RESERVE_SIZE - currentCount, 5); // Limit to max 5 per replenishment
      
      if (needed > 0) {
        await this.replenishReserves(category, needed, false);
        console.log(`🔄 Replenished ${category}: +${needed} reserves (attempt ${this.replenishAttempts[category]})`);
        
        // Reset attempts on successful replenishment
        if (this.reserves[category]?.length >= this.MIN_RESERVE_THRESHOLD) {
          this.replenishAttempts[category] = 0;
        }
      }
    } catch (error) {
      console.log(`⚠️ Failed to replenish reserves for ${category}: ${error instanceof Error ? error.message : 'unknown error'}`);
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
        console.log(`⚠️ Skipped reserve take ${i + 1} for ${category}: ${error instanceof Error ? error.message : 'generation failed'}`);
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
    console.log(`📤 submitReserveContent: Starting submission of ${reserveContent.length} items`);
    
    const currentUser = auth.currentUser;
    console.log(`📤 submitReserveContent: Current user:`, !!currentUser);
    
    if (!currentUser) {
      const error = 'No authenticated user for reserve content submission';
      console.log(`❌ submitReserveContent: ${error}`);
      throw new Error(error);
    }

    const submittedContent: TakeSubmission[] = [];
    let errors = 0;
    
    for (let i = 0; i < reserveContent.length; i++) {
      const reserve = reserveContent[i];
      console.log(`📤 submitReserveContent: Submitting item ${i + 1}/${reserveContent.length}: "${reserve.text.substring(0, 50)}..."`);
      
      try {
        const docId = await submitTake(reserve, currentUser.uid, true); // true = isAIGenerated
        console.log(`✅ submitReserveContent: Item ${i + 1} submitted successfully with ID: ${docId}`);
        
        // Add document ID to the content
        submittedContent.push({
          ...reserve,
          id: docId
        });
      } catch (error) {
        const errorMsg = `Submission ${i + 1} failed: ${error instanceof Error ? error.message.substring(0, 50) : 'unknown error'}`;
        console.log(`❌ submitReserveContent: ${errorMsg}`);
        errors++;
        // Don't include failed submissions in result
      }
    }

    if (submittedContent.length === 0) {
      throw new Error(`Failed to submit any reserve content: ${errors} errors occurred`);
    }
    
    console.log(`📤 Submitted ${submittedContent.length}/${reserveContent.length} takes to Firebase`);
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
  naturalDelayMs: number = 0 // Removed delay - was causing issues on device
): Promise<TakeSubmission[]> => {
  console.log(`🔥 SMOOTH CONTENT - Starting getSmoothContent for ${category}, count: ${count}`);
  
  try {
    // Skip delay - it was causing issues on device
    // console.log(`🔥 SMOOTH CONTENT - Adding natural delay of ${Math.round(naturalDelayMs)}ms`);
    // await new Promise(resolve => setTimeout(resolve, naturalDelayMs));
    // console.log(`🔥 SMOOTH CONTENT - Delay complete, proceeding...`);
    
    // Get reserve content
    console.log(`🔥 SMOOTH CONTENT - Getting reserve content...`);
    const reserves = await reserveManager.getReserveContent(category, count);
    console.log(`🔥 SMOOTH CONTENT - Got reserves response: ${reserves.length} items`);
  
    if (reserves.length === 0) {
      console.log(`⚠️ SMOOTH CONTENT - No reserves available, returning empty array`);
      return [];
    }
    
    console.log(`🔥 SMOOTH CONTENT - Got ${reserves.length} reserves, submitting to Firebase...`);
    
    try {
      // Submit to Firebase and wait for completion (blocking)
      console.log(`🔥 SMOOTH CONTENT - Calling submitReserveContent...`);
      const submittedContent = await reserveManager.submitReserveContent(reserves);
      console.log(`✅ SMOOTH CONTENT - Successfully submitted ${submittedContent.length} takes to Firebase`);
      
      // Return the content with document IDs for vote targeting
      return submittedContent;
      
    } catch (firebaseError) {
      console.error(`❌ SMOOTH CONTENT - Firebase submission failed:`, firebaseError);
      
      // Fallback: return content without IDs (votes will fail but content shows)
      console.log(`🔄 SMOOTH CONTENT - Returning content without IDs as fallback`);
      return reserves;
    }
    
  } catch (error) {
    console.error(`❌ SMOOTH CONTENT - Top level error:`, error);
    // Re-throw to trigger the error alert in HomeScreen
    throw error;
  }
};