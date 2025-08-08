import { TakeSubmission } from '../types/Take';
import { getPromptByD20 } from './enhancedPrompts';

// Categories from your existing takes
const CATEGORIES = [
  'food', 'work', 'pets', 'technology', 'life', 'entertainment', 
  'environment', 'wellness', 'society', 'politics', 'sports', 'travel', 'relationships'
];

interface AIGeneratedTake {
  text: string;
  category: string;
  confidence: number; // 0-1 score for content quality
}

// OpenAI API configuration
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Get category prompt using D20 system
const getCategoryPrompt = (category: string, d20Roll?: number): string => {
  return getPromptByD20(category, d20Roll);
};

// Check if content is too similar to existing takes
const isContentUnique = async (newText: string, category: string): Promise<boolean> => {
  try {
    const { getApprovedTakes } = await import('./takeService');
    const existingTakes = await getApprovedTakes();
    
    // Filter to same category
    const categoryTakes = existingTakes.filter(take => take.category === category);
    
    // Convert to lowercase for comparison
    const newTextLower = newText.toLowerCase();
    
    // Check for exact matches or very similar content
    for (const take of categoryTakes) {
      const existingText = take.text.toLowerCase();
      
      // Exact match check
      if (existingText === newTextLower) {
        return false;
      }
      
      // Similar content check (shared key phrases)
      const newWords = newTextLower.split(/\s+/).filter(w => w.length > 3);
      const existingWords = existingText.split(/\s+/).filter(w => w.length > 3);
      
      // If 60%+ of meaningful words overlap, consider it too similar
      const sharedWords = newWords.filter(word => existingWords.includes(word));
      const similarity = sharedWords.length / Math.max(newWords.length, 1);
      
      if (similarity > 0.6) {
        console.log(`⚠️ Content too similar to existing: "${take.text}"`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking content uniqueness:', error);
    return true; // Default to allowing content if check fails
  }
};

// Generate a single AI take for a specific category with uniqueness checking
export const generateAITake = async (category?: string, maxRetries: number = 3): Promise<AIGeneratedTake> => {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Please set EXPO_PUBLIC_OPENAI_API_KEY in your environment.');
  }

  const selectedCategory = category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // D20 roll for prompt selection (separate from personality roll)
    const promptD20Roll = Math.floor(Math.random() * 20) + 1;
    const categoryPrompt = getCategoryPrompt(selectedCategory, promptD20Roll);
    
    // Add variety factors to make each attempt more unique
    const varietyFactors = [
      'Be specific and avoid generic statements',
      'Focus on a niche aspect most people wouldn\'t think of',
      'Challenge a widely accepted belief',
      'Take an unexpected angle on a common topic',
      'Be bold and make people think twice'
    ];
    const varietyFactor = varietyFactors[Math.floor(Math.random() * varietyFactors.length)];

    // Generate personality context with D4/D20 system (separate roll)
    const { generatePersonalityContext, buildEnhancedPrompt } = await import('./personalityEngine');
    const personalityContext = generatePersonalityContext(selectedCategory);
    
    // Debug logging for prompt selection
    if (promptD20Roll >= 16) {
      console.log(`🎲 D20 Prompt Roll: ${promptD20Roll} - Using rngSpice prompt`);
    }

    const baseSystemPrompt = `You are a creative content generator for a "Hot or Not Takes" app where users vote on controversial opinions.

CRITICAL: Generate completely original content. Avoid generic or common hot takes.

INSTRUCTIONS:
- Generate ONE controversial "hot take" that sounds like a real person wrote it
- Keep it SHORT and PUNCHY - between 15-100 characters maximum
- Make it opinion-based, not factual claims
- Avoid discriminatory, or harmful content
- Use conversational, confident tone like you're stating your opinion
- BE CONCISE - think casual conversation, not formal writing
- NO em-dashes (—) - use spaces + regular dashes ( - ) or commas instead
- NO questions like "Hot or not?" - just state the opinion directly
- Sound human and natural - like something someone would actually say
- ${varietyFactor}

CATEGORY: ${selectedCategory}
SPECIFIC FOCUS: ${categoryPrompt}

Examples of natural, human-sounding takes:
- "Pineapple belongs on pizza and I'll die on this hill"
- "Small talk is just socially acceptable interrogation" 
- "Cats are better roommates than most humans"
- "Cereal with warm milk is actually superior"
- "Airport food is overpriced theater food"

Return ONLY the hot take text, nothing else.`;

    // Build enhanced prompt with personality context
    const systemPrompt = buildEnhancedPrompt(
      baseSystemPrompt,
      selectedCategory,
      categoryPrompt,
      varietyFactor,
      personalityContext
    );

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ],
          max_tokens: 60, // Reduced for brevity
          temperature: 0.9 + (attempt * 0.1), // Increase creativity with each retry
          presence_penalty: 0.8, // Strongly encourage unique ideas
          frequency_penalty: 0.5, // Reduce repetition
          top_p: 0.9, // Add nucleus sampling for variety
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content?.trim();

      if (!generatedText) {
        throw new Error('No content generated from OpenAI API');
      }

      // Basic content validation - enforce brevity
      if (generatedText.length < 15 || generatedText.length > 120) {
        console.log(`⚠️ Attempt ${attempt}: Content length out of bounds (${generatedText.length} chars)`);
        continue;
      }

      // Clean up content to make it more human
      let cleanedText = generatedText
        .replace(/—/g, '-') // Replace em-dashes with regular dashes
        .replace(/'/g, "'") // Replace curly quotes with straight quotes
        .replace(/"/g, '"') // Replace curly quotes with straight quotes
        .trim();

      // Check for unwanted phrases that sound too AI-generated
      const unwantedPhrases = [
        'hot or not',
        'what do you think',
        'thoughts?',
        'agree or disagree',
        'controversial opinion:',
        'hot take:',
        'unpopular opinion:'
      ];
      
      const containsUnwanted = unwantedPhrases.some(phrase => 
        cleanedText.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (containsUnwanted) {
        console.log(`⚠️ Attempt ${attempt}: Content contains unwanted phrases, retrying...`);
        continue;
      }

      // Use the cleaned text
      const finalText = cleanedText;

      // Check uniqueness using the cleaned text
      const isUnique = await isContentUnique(finalText, selectedCategory);
      if (!isUnique) {
        console.log(`⚠️ Attempt ${attempt}: Content not unique, retrying...`);
        continue;
      }

      // Success! Content is unique and human-sounding
      let confidence = Math.min(0.95, Math.max(0.4, 
        (finalText.length / 150) * 0.6 + 
        (finalText.includes('!') ? 0.1 : 0) +
        (finalText.split(' ').length > 6 ? 0.2 : 0) +
        (attempt === 1 ? 0.1 : 0) // Bonus for first attempt success
      ));

      // Personality mode bonus: personality-driven takes are potentially more engaging
      if (personalityContext.isPersonalityMode) {
        confidence = Math.min(0.95, confidence + 0.15); // 15% bonus for personality mode
        
        // Additional bonus for specific references (D20 rolls 16-20)
        if (personalityContext.specificReference) {
          confidence = Math.min(0.95, confidence + 0.05); // Extra 5% for specific references
        }
      }

      console.log(`✅ Generated unique human-like take (attempt ${attempt})${personalityContext.isPersonalityMode ? ' [PERSONALITY]' : ''}: "${finalText}"`);
      
      // Debug personality activation
      if (personalityContext.isPersonalityMode) {
        console.log(`🎭 Personality Details: ${personalityContext.specificReference || personalityContext.archetype || 'unknown'}`);
      }

      return {
        text: finalText,
        category: selectedCategory,
        confidence
      };

    } catch (error) {
      console.error(`Error on attempt ${attempt}:`, error);
      if (attempt === maxRetries) {
        throw new Error(`Failed to generate unique AI content after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Delay between retries
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Failed to generate unique content');
};

// Generate multiple AI takes across different categories
export const generateMultipleAITakes = async (count: number = 5): Promise<AIGeneratedTake[]> => {
  const takes: AIGeneratedTake[] = [];
  const errors: string[] = [];
  let personalityActivations = 0;
  const personalityTypes: { [key: string]: number } = {};

  // Distribute across different categories
  const categoriesToUse = [...CATEGORIES].sort(() => Math.random() - 0.5).slice(0, count);
  
  for (let i = 0; i < count; i++) {
    try {
      const category = categoriesToUse[i] || CATEGORIES[i % CATEGORIES.length];
      const take = await generateAITake(category);
      takes.push(take);
      
      // Track personality activations for debugging
      const { generatePersonalityContext } = await import('./personalityEngine');
      const personalityCheck = generatePersonalityContext(category);
      if (personalityCheck.isPersonalityMode) {
        personalityActivations++;
        const personalityKey = personalityCheck.specificReference || personalityCheck.archetype || 'unknown';
        personalityTypes[personalityKey] = (personalityTypes[personalityKey] || 0) + 1;
      }
      
      // Small delay to avoid rate limiting
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      errors.push(`Take ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Debug personality statistics
  if (takes.length > 0) {
    const activationRate = (personalityActivations / takes.length * 100).toFixed(1);
    console.log(`📊 Personality Stats - Generated: ${takes.length}, Personality Active: ${personalityActivations} (${activationRate}%)`);
    
    if (personalityActivations > 0) {
      console.log(`🎭 Personality Types:`, personalityTypes);
    }
  }

  if (takes.length === 0) {
    throw new Error(`Failed to generate any takes. Errors: ${errors.join(', ')}`);
  }

  if (errors.length > 0) {
    console.warn(`Generated ${takes.length}/${count} takes. Errors:`, errors);
  }

  return takes;
};

// Convert AI-generated take to TakeSubmission format
export const convertAITakeToSubmission = (aiTake: AIGeneratedTake): TakeSubmission => ({
  text: aiTake.text,
  category: aiTake.category,
});

// Auto-seed the database with AI takes when running low
export const autoSeedAITakes = async (targetCount: number = 10): Promise<number> => {
  try {
    // Get current user from Firebase Auth
    const { auth } = await import('./firebase');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('No authenticated user - skipping AI seeding');
      return 0;
    }

    const { getApprovedTakes } = await import('./takeService');
    const currentTakes = await getApprovedTakes();
    
    if (currentTakes.length >= targetCount) {
      console.log(`Database has ${currentTakes.length} takes, no seeding needed`);
      return 0;
    }

    const needed = targetCount - currentTakes.length;
    console.log(`Generating ${needed} AI takes to reach target of ${targetCount}`);
    
    const aiTakes = await generateMultipleAITakes(needed);
    
    // Submit AI takes to Firestore using current authenticated user
    const { submitTake } = await import('./takeService');
    let submitted = 0;
    
    for (const aiTake of aiTakes) {
      try {
        const submission = convertAITakeToSubmission(aiTake);
        await submitTake(submission, currentUser.uid);
        submitted++;
        console.log(`✅ Submitted AI take: "${aiTake.text}" (${aiTake.category})`);
      } catch (error) {
        console.error(`❌ Failed to submit AI take:`, error);
      }
    }
    
    console.log(`🤖 Successfully seeded ${submitted}/${needed} AI-generated takes`);
    return submitted;
    
  } catch (error) {
    console.error('Error in auto-seed process:', error);
    throw error;
  }
};

// Manual admin function to generate and preview takes
export const generateAndPreviewTakes = async (count: number = 3): Promise<AIGeneratedTake[]> => {
  console.log(`🤖 Generating ${count} AI takes for preview...`);
  return await generateMultipleAITakes(count);
};

// Test personality system activation rates
export const testPersonalityActivation = async (category: string = 'food', iterations: number = 10): Promise<void> => {
  console.log(`🧪 Testing personality activation for ${category} (${iterations} iterations):`);
  
  let personalityCount = 0;
  let specificReferenceCount = 0;
  const archetypeCount: { [key: string]: number } = {};
  
  const { generatePersonalityContext } = await import('./personalityEngine');
  
  for (let i = 0; i < iterations; i++) {
    const context = generatePersonalityContext(category);
    
    if (context.isPersonalityMode) {
      personalityCount++;
      
      if (context.specificReference) {
        specificReferenceCount++;
        console.log(`  ${i + 1}. 🎯 Specific Reference: ${context.specificReference}`);
      } else if (context.archetype) {
        archetypeCount[context.archetype] = (archetypeCount[context.archetype] || 0) + 1;
        console.log(`  ${i + 1}. 🎭 Archetype: ${context.archetype}`);
      }
    } else {
      console.log(`  ${i + 1}. ⭕ Standard mode`);
    }
  }
  
  const activationRate = (personalityCount / iterations * 100).toFixed(1);
  const specificRate = (specificReferenceCount / iterations * 100).toFixed(1);
  
  console.log(`
📊 Results:`);
  console.log(`  Total personality activations: ${personalityCount}/${iterations} (${activationRate}%)`);
  console.log(`  Specific references: ${specificReferenceCount} (${specificRate}%)`);
  console.log(`  Archetypes:`, archetypeCount);
  console.log(`  Expected ~25% activation rate, actual: ${activationRate}%`);
};