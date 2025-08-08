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
  embedding?: number[]; // OpenAI embedding for semantic similarity
}

// OpenAI API configuration
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Get category prompt using D20 system
const getCategoryPrompt = (category: string, d20Roll?: number): string => {
  return getPromptByD20(category, d20Roll);
};

// Calculate engagement score based on punchy words and phrases
const calculateEngagementScore = (text: string): number => {
  const lowerText = text.toLowerCase();
  let score = 0;
  
  // High-impact words (0.2 points each)
  const highImpactWords = [
    'never', 'always', 'worst', 'best', 'terrible', 'amazing', 'ridiculous', 
    'absurd', 'insane', 'crazy', 'stupid', 'brilliant', 'genius', 'overrated', 
    'underrated', 'scam', 'fake', 'waste', 'pointless', 'useless', 'perfect',
    'disgusting', 'gross', 'revolting', 'obsessed', 'addicted', 'toxic',
    'cringe', 'annoying', 'obnoxious', 'pretentious', 'pathetic', 'embarrassing'
  ];
  
  // Medium-impact words (0.1 points each)
  const mediumImpactWords = [
    'seriously', 'honestly', 'literally', 'actually', 'obviously', 'clearly',
    'definitely', 'absolutely', 'completely', 'totally', 'basically', 'just',
    'really', 'super', 'extremely', 'highly', 'incredibly', 'massively',
    'wildly', 'purely', 'simply', 'genuinely', 'truly', 'utterly'
  ];
  
  // Controversial phrases (0.15 points each)
  const controversialPhrases = [
    'unpopular opinion', 'fight me', 'change my mind', 'hot take', 'am i wrong',
    'no cap', 'full stop', 'period', 'end of story', 'dont @ me', 'sorry not sorry',
    'just saying', 'prove me wrong', 'i said what i said', 'thats just facts',
    'wake up sheeple', 'calling it now', 'mark my words', 'let\'s be real', 'screw the rules',
    'before it was cool', 'literally dying', 'can\'t even', 'no filter', 'keeping it real',
    'back in my day', 'kids these days', 'it\'s giving', 'main character energy', 'periodt'
  ];
  
  // Engagement indicators (0.1 points each)
  const engagementIndicators = [
    '!', '?', 'why', 'how', 'wtf', 'omg', 'lol', 'smh', 'fr', 'ngl',
    'tbh', 'imo', 'imho', 'facts', 'truth', 'real talk', 'no joke'
  ];
  
  // Count high-impact words
  highImpactWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;
    score += matches * 0.2;
  });
  
  // Count medium-impact words
  mediumImpactWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;
    score += matches * 0.1;
  });
  
  // Count controversial phrases
  controversialPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) {
      score += 0.15;
    }
  });
  
  // Count engagement indicators
  engagementIndicators.forEach(indicator => {
    if (lowerText.includes(indicator)) {
      score += 0.1;
    }
  });
  
  // Bonus for contractions (more conversational)
  const contractions = ["'re", "'ve", "'ll", "'d", "n't", "'s", "'m"];
  contractions.forEach(contraction => {
    if (text.includes(contraction)) {
      score += 0.05;
    }
  });
  
  // Bonus for ALL CAPS words (emphasis)
  const allCapsWords = text.match(/\b[A-Z]{2,}\b/g) || [];
  score += allCapsWords.length * 0.08;
  
  // Penalty for overly formal language
  const formalWords = [
    'furthermore', 'however', 'nevertheless', 'consequently', 'therefore',
    'moreover', 'additionally', 'subsequently', 'accordingly', 'thus'
  ];
  
  formalWords.forEach(word => {
    if (lowerText.includes(word)) {
      score -= 0.1;
    }
  });
  
  // Normalize score (cap at 1.0)
  return Math.min(score, 1.0);
};

// Check if content is semantically unique using embeddings
const isContentUnique = async (newText: string, category: string): Promise<boolean> => {
  try {
    const { getApprovedTakes } = await import('./takeService');
    const SemanticSimilarityService = (await import('./semanticSimilarity')).default;
    
    console.log(`🔍 Checking semantic uniqueness for "${newText.substring(0, 50)}..."`);
    
    const existingTakes = await getApprovedTakes();
    
    // Filter to same category for more relevant comparison
    const categoryTakes = existingTakes.filter(take => take.category === category);
    
    if (categoryTakes.length === 0) {
      console.log('✅ No existing takes in category, content is unique');
      return true;
    }
    
    // Get embeddings from existing takes (if available) or their text
    const existingEmbeddings: number[][] = [];
    const textsNeedingEmbedding: string[] = [];
    
    for (const take of categoryTakes) {
      if (take.embedding && take.embedding.length > 0) {
        // Use existing embedding if available
        existingEmbeddings.push(take.embedding);
      } else {
        // Need to generate embedding for this text
        textsNeedingEmbedding.push(take.text);
      }
    }
    
    // Generate embeddings for texts that don't have them
    if (textsNeedingEmbedding.length > 0) {
      console.log(`🔄 Generating embeddings for ${textsNeedingEmbedding.length} existing takes...`);
      const newEmbeddings = await SemanticSimilarityService.batchGenerateEmbeddings(textsNeedingEmbedding);
      existingEmbeddings.push(...newEmbeddings);
    }
    
    if (existingEmbeddings.length === 0) {
      console.log('✅ No embeddings available, content considered unique');
      return true;
    }
    
    // Check semantic similarity using category-specific threshold
    const result = await SemanticSimilarityService.checkCategorySimilarity(
      newText, 
      existingEmbeddings, 
      category
    );
    
    return !result.isSimilar;
    
  } catch (error) {
    console.log('⚠️ Semantic similarity check failed:', error instanceof Error ? error.message : 'unknown error');
    console.log('🔄 Falling back to word-based similarity check...');
    
    // Fallback to old word-based method if embedding fails
    try {
      const { getApprovedTakes } = await import('./takeService');
      const existingTakes = await getApprovedTakes();
      const categoryTakes = existingTakes.filter(take => take.category === category);
      const newTextLower = newText.toLowerCase();
      
      for (const take of categoryTakes) {
        const existingText = take.text.toLowerCase();
        if (existingText === newTextLower) {
          return false;
        }
        
        const newWords = newTextLower.split(/\s+/).filter(w => w.length > 3);
        const existingWords = existingText.split(/\s+/).filter(w => w.length > 3);
        const sharedWords = newWords.filter(word => existingWords.includes(word));
        const similarity = sharedWords.length / Math.max(newWords.length, 1);
        
        if (similarity > 0.6) {
          console.log(`⚠️ Fallback: Content too similar to existing: "${take.text}"`);
          return false;
        }
      }
      
      return true;
    } catch (fallbackError) {
      console.log('⚠️ Fallback similarity check also failed:', fallbackError instanceof Error ? fallbackError.message : 'unknown error');
      return true; // Default to allowing content if all checks fail
    }
  }
};

// Generate a single AI take for a specific category with uniqueness checking
export const generateAITake = async (category?: string, maxRetries: number = 5): Promise<AIGeneratedTake> => {
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
      'Be bold and make people think twice',
      'Introduce a cultural element or a specific group\'s perspective',
      'Focus on a common frustration or pet peeve',
      'Present a "backward" or counter-intuitive take',
      'Use a hyper-specific, almost bizarre detail',
      'Frame the take as a question of etiquette or social norms'
    ];
    const varietyFactor = varietyFactors[Math.floor(Math.random() * varietyFactors.length)];

    // Generate personality context with D4/D20 system (separate roll)
    const { generatePersonalityContext, buildEnhancedPrompt } = await import('./personalityEngine');
    const personalityContext = generatePersonalityContext(selectedCategory);
    
    // Log prompt selection details (use the same personalityContext from above)
    const promptTier = promptD20Roll >= 16 ? 'rngSpice' : (promptD20Roll >= 6 ? 'focused' : 'generic');
    console.log(`🎲 AI Generation: ${selectedCategory} | D20: ${promptD20Roll} (${promptTier}) | Personality: ${personalityContext.isPersonalityMode ? 'YES' : 'NO'}`);
    
    // Log personality details if active
    if (personalityContext.isPersonalityMode) {
      if (personalityContext.specificReference) {
        console.log(`🎯 Specific Reference: ${personalityContext.specificReference}`);
      } else if (personalityContext.archetype) {
        console.log(`🎭 Archetype: ${personalityContext.archetype}`);
      }
    }

    const baseSystemPrompt = `You are a creative content generator for a "Hot or Not Takes" app where users vote on controversial opinions.

CRITICAL: Generate completely original content.

INSTRUCTIONS:
- Generate ONE controversial "hot take" that sounds like a real person wrote it
- Keep it SHORT and PUNCHY (between 20-130 characters maximum)
- Make it opinion-based, not factual claims
- Use conversational, confident tone like you're stating your opinion
- Sound human and natural (like something someone would actually say)
- NO questions like "Hot or not?" (just state the opinion directly)
- ${varietyFactor}

CATEGORY: ${selectedCategory}
SPECIFIC FOCUS: ${categoryPrompt}

Return ONLY the hot take text, nothing else.`;

    // Build enhanced prompt with personality context
    const systemPrompt = buildEnhancedPrompt(
      baseSystemPrompt,
      selectedCategory,
      categoryPrompt,
      varietyFactor,
      personalityContext
    );

    // Log the actual prompt being sent to OpenAI (for debugging content quality)
    console.log(`📝 PROMPT SENT TO OPENAI:`);
    console.log(`Category: ${selectedCategory}`);
    console.log(`Variety Factor: ${varietyFactor}`);
    if (personalityContext.isPersonalityMode) {
      console.log(`Personality: ${personalityContext.specificReference || personalityContext.archetype}`);
    }
    console.log(`System Prompt:\n${systemPrompt}`);
    console.log(`📝 END PROMPT`);
    
    try {
      const requestPayload = {
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
      };
      
      console.log(`⚡ OpenAI Request: temp=${requestPayload.temperature}, attempt=${attempt}`);
      
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content?.trim();
      
      console.log(`✨ OpenAI Response: "${generatedText || 'NULL'}"`);

      if (!generatedText) {
        throw new Error('No content generated from OpenAI API');
      }

      // Basic content validation - enforce brevity (relaxed upper limit)
      if (generatedText.length < 20 || generatedText.length > 130) {
        console.log(`⚠️ Attempt ${attempt}: Length out of bounds (${generatedText.length} chars, need 20-130)`);
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

      // Engagement word validation for punchy takes
      const engagementScore = calculateEngagementScore(cleanedText);
      if (engagementScore < 0.2) { // Lowered threshold - was too strict at 0.3
        console.log(`⚠️ Attempt ${attempt}: Low engagement score (${engagementScore.toFixed(2)}), retrying...`);
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
        (finalText.length / 150) * 0.3 + // Reduced base length score
        (engagementScore * 0.4) + // Major factor: engagement score
        (finalText.split(' ').length > 6 ? 0.15 : 0) + // Word count bonus
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

      console.log(`✅ SUCCESS (attempt ${attempt}): "${finalText}"${personalityContext.isPersonalityMode ? ` [${personalityContext.specificReference || personalityContext.archetype}]` : ''}`);
      console.log(`📊 Engagement: ${engagementScore.toFixed(2)} | Confidence: ${confidence.toFixed(2)}`);

      // Generate embedding for the final text for future similarity checks
      let embedding: number[] | undefined = undefined;
      try {
        const SemanticSimilarityService = (await import('./semanticSimilarity')).default;
        embedding = await SemanticSimilarityService.generateEmbedding(finalText);
        console.log(`🔍 Generated embedding for new take: ${embedding.length} dimensions`);
      } catch (embeddingError) {
        console.log('⚠️ Skipping embedding generation:', embeddingError instanceof Error ? embeddingError.message : 'service unavailable');
        // Continue without embedding - it's not critical for the take generation
      }

      return {
        text: finalText,
        category: selectedCategory,
        confidence,
        embedding
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

  // Distribute across different categories
  const categoriesToUse = [...CATEGORIES].sort(() => Math.random() - 0.5).slice(0, count);
  
  for (let i = 0; i < count; i++) {
    try {
      const category = categoriesToUse[i] || CATEGORIES[i % CATEGORIES.length];
      const take = await generateAITake(category);
      takes.push(take);
      
      // Track personality activations for debugging (reuse the context from generation, don't roll again)
      // Note: We need to track this from the actual generation, not a separate roll
      // This is a simplified tracking for now - the real stats are in the individual generation logs above
      
      // Small delay to avoid rate limiting
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      errors.push(`Take ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Debug summary
  if (takes.length > 0) {
    console.log(`📊 Generation Summary - Successfully generated: ${takes.length} takes`);
    console.log(`🎲 Individual personality results logged above during generation`);
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
        await submitTake(submission, currentUser.uid, true, aiTake.embedding); // true = isAIGenerated, pass embedding
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
export const testPersonalityActivation = async (category: string = 'food', iterations: number = 20): Promise<void> => {
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

// Test engagement scoring system
export const testEngagementScoring = (): void => {
  console.log('🧪 Testing engagement scoring system:');
  
  const testCases = [
    // Low engagement examples
    "This is a reasonable opinion about food preferences.",
    "I think that technology has both advantages and disadvantages.",
    "Some people might disagree with this perspective on work.",
    
    // Medium engagement examples
    "Pizza is definitely overrated and I'm tired of pretending it's not.",
    "Remote work is actually making people less productive, fight me.",
    "Coffee shops are basically just expensive offices now.",
    
    // High engagement examples
    "Pineapple on pizza is DISGUSTING and anyone who likes it is wrong!",
    "TikTok is literally destroying our attention spans and we're all addicted.",
    "Working from home is just an excuse to be lazy - change my mind!",
    
    // Very high engagement examples
    "Starbucks is overpriced garbage and you're a sheep if you go there daily!",
    "Marvel movies are absolutely terrible and anyone who likes them has no taste whatsoever.",
    "Gordon Ramsay would be embarrassed by how awful most restaurant food has become!"
  ];
  
  testCases.forEach((text, index) => {
    const score = calculateEngagementScore(text);
    const level = score < 0.3 ? 'LOW' : score < 0.6 ? 'MEDIUM' : score < 0.8 ? 'HIGH' : 'VERY HIGH';
    console.log(`  ${index + 1}. [${level}] ${score.toFixed(2)}: "${text}"`);
  });
};

// Test category-specific similarity thresholds
export const testCategoryThresholds = async (): Promise<void> => {
  console.log('🎯 Testing category-specific similarity thresholds:');
  
  const SemanticSimilarityService = (await import('./semanticSimilarity')).default;
  const thresholds = SemanticSimilarityService.getAllCategoryThresholds();
  
  console.log('\n📊 Category Threshold Settings:');
  
  // Group by threshold level for better visualization
  const groupedThresholds = Object.entries(thresholds).reduce((acc, [category, threshold]) => {
    const level = threshold <= 0.82 ? 'STRICT' : threshold <= 0.85 ? 'STANDARD' : 'LENIENT';
    if (!acc[level]) acc[level] = [];
    acc[level].push({ category, threshold });
    return acc;
  }, {} as { [key: string]: { category: string; threshold: number }[] });
  
  Object.entries(groupedThresholds).forEach(([level, categories]) => {
    console.log(`\n🎯 ${level} (${categories.length} categories):`);
    categories
      .sort((a, b) => a.threshold - b.threshold)
      .forEach(({ category, threshold }) => {
        console.log(`   • ${category}: ${(threshold * 100).toFixed(1)}%`);
      });
  });
  
  console.log('\n💡 Threshold Logic:');
  console.log('   • STRICT (80-82%): High diversity categories (tech, politics, society)');
  console.log('   • STANDARD (85%): Medium diversity categories (entertainment, travel, life)');
  console.log('   • LENIENT (86-88%): Lower diversity categories (food, pets, sports)');
  
  // Test some example category lookups
  const testCategories = ['technology', 'food', 'politics', 'pets', 'nonexistent'];
  console.log('\n🧪 Test Category Lookups:');
  testCategories.forEach(category => {
    const threshold = SemanticSimilarityService.getCategoryThreshold(category);
    const level = threshold <= 0.82 ? 'STRICT' : threshold <= 0.85 ? 'STANDARD' : 'LENIENT';
    console.log(`   • ${category}: ${(threshold * 100).toFixed(1)}% (${level})`);
  });
};

// Comprehensive testing function for take quality
export const runTakeQualityTest = async (category: string = 'food', testCount: number = 5): Promise<void> => {
  console.log('🧪 COMPREHENSIVE TAKE QUALITY TEST');
  console.log('=====================================');
  console.log(`Category: ${category} | Test Count: ${testCount}`);
  console.log('');

  const results = {
    generated: 0,
    failed: 0,
    personalityModeCount: 0,
    specificReferenceCount: 0,
    archetypeCount: {} as Record<string, number>,
    engagementScores: [] as number[],
    confidenceScores: [] as number[],
    lengthStats: [] as number[],
    uniquenessResults: [] as boolean[],
    totalAttempts: 0
  };

  const SemanticSimilarityService = (await import('./semanticSimilarity')).default;
  const categoryThreshold = SemanticSimilarityService.getCategoryThreshold(category);
  
  console.log(`🎯 Using ${category} similarity threshold: ${(categoryThreshold * 100).toFixed(1)}%`);
  console.log('');

  for (let i = 1; i <= testCount; i++) {
    console.log(`📝 Test ${i}/${testCount}:`);
    console.log('------------------------');
    
    try {
      // Generate AI take with full pipeline
      const startTime = Date.now();
      const aiTake = await generateAITake(category, 3); // Allow up to 3 retries
      const endTime = Date.now();
      
      // Track successful generation
      results.generated++;
      results.totalAttempts += 1; // This would need to be tracked from within generateAITake for accuracy
      
      // Analyze the generated take
      const engagementScore = calculateEngagementScore(aiTake.text);
      results.engagementScores.push(engagementScore);
      results.confidenceScores.push(aiTake.confidence);
      results.lengthStats.push(aiTake.text.length);
      
      // Test personality detection
      const { generatePersonalityContext } = await import('./personalityEngine');
      const personalityContext = generatePersonalityContext(category);
      
      if (personalityContext.isPersonalityMode) {
        results.personalityModeCount++;
        if (personalityContext.specificReference) {
          results.specificReferenceCount++;
        } else if (personalityContext.archetype) {
          results.archetypeCount[personalityContext.archetype] = 
            (results.archetypeCount[personalityContext.archetype] || 0) + 1;
        }
      }
      
      // Test uniqueness
      const { getApprovedTakes } = await import('./takeService');
      const existingTakes = await getApprovedTakes();
      const categoryTakes = existingTakes.filter(take => take.category === category);
      
      let isUnique = true;
      if (categoryTakes.length > 0) {
        const existingTexts = categoryTakes.map(take => take.text);
        const similarity = await SemanticSimilarityService.analyzeSimilarityDistribution([...existingTexts, aiTake.text]);
        isUnique = similarity.maxSimilarity < categoryThreshold;
      }
      results.uniquenessResults.push(isUnique);
      
      // Output results for this take
      console.log(`✅ Generated: "${aiTake.text}"`);
      console.log(`   Length: ${aiTake.text.length} chars`);
      console.log(`   Engagement: ${engagementScore.toFixed(2)} | Confidence: ${aiTake.confidence.toFixed(2)}`);
      console.log(`   Personality: ${personalityContext.isPersonalityMode ? 'YES' : 'NO'}${personalityContext.isPersonalityMode ? ` (${personalityContext.specificReference || personalityContext.archetype})` : ''}`);
      console.log(`   Unique: ${isUnique ? 'YES' : 'NO'}`);
      console.log(`   Generation time: ${endTime - startTime}ms`);
      
      // Small delay between tests
      if (i < testCount) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      results.failed++;
    }
    
    console.log('');
  }

  // Final summary
  console.log('🏁 FINAL TEST SUMMARY');
  console.log('====================');
  console.log(`Success Rate: ${results.generated}/${testCount} (${(results.generated / testCount * 100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed}`);
  console.log('');
  
  if (results.generated > 0) {
    // Engagement statistics
    const avgEngagement = results.engagementScores.reduce((a, b) => a + b, 0) / results.engagementScores.length;
    const minEngagement = Math.min(...results.engagementScores);
    const maxEngagement = Math.max(...results.engagementScores);
    
    console.log('📊 ENGAGEMENT ANALYSIS:');
    console.log(`   Average: ${avgEngagement.toFixed(2)} | Min: ${minEngagement.toFixed(2)} | Max: ${maxEngagement.toFixed(2)}`);
    console.log(`   Above 0.2 threshold: ${results.engagementScores.filter(s => s >= 0.2).length}/${results.engagementScores.length}`);
    console.log('');
    
    // Confidence statistics
    const avgConfidence = results.confidenceScores.reduce((a, b) => a + b, 0) / results.confidenceScores.length;
    const minConfidence = Math.min(...results.confidenceScores);
    const maxConfidence = Math.max(...results.confidenceScores);
    
    console.log('🎯 CONFIDENCE ANALYSIS:');
    console.log(`   Average: ${avgConfidence.toFixed(2)} | Min: ${minConfidence.toFixed(2)} | Max: ${maxConfidence.toFixed(2)}`);
    console.log('');
    
    // Length statistics
    const avgLength = results.lengthStats.reduce((a, b) => a + b, 0) / results.lengthStats.length;
    const minLength = Math.min(...results.lengthStats);
    const maxLength = Math.max(...results.lengthStats);
    
    console.log('📏 LENGTH ANALYSIS:');
    console.log(`   Average: ${avgLength.toFixed(1)} chars | Min: ${minLength} | Max: ${maxLength}`);
    console.log(`   Within 20-130 range: ${results.lengthStats.filter(l => l >= 20 && l <= 130).length}/${results.lengthStats.length}`);
    console.log('');
    
    // Personality statistics
    const personalityRate = (results.personalityModeCount / results.generated * 100).toFixed(1);
    const specificRate = (results.specificReferenceCount / results.generated * 100).toFixed(1);
    
    console.log('🎭 PERSONALITY ANALYSIS:');
    console.log(`   Personality activation: ${results.personalityModeCount}/${results.generated} (${personalityRate}%)`);
    console.log(`   Specific references: ${results.specificReferenceCount} (${specificRate}%)`);
    
    if (Object.keys(results.archetypeCount).length > 0) {
      console.log('   Archetypes used:');
      Object.entries(results.archetypeCount).forEach(([archetype, count]) => {
        console.log(`     • ${archetype}: ${count} times`);
      });
    }
    console.log('');
    
    // Uniqueness statistics
    const uniqueCount = results.uniquenessResults.filter(u => u).length;
    const uniqueRate = (uniqueCount / results.uniquenessResults.length * 100).toFixed(1);
    
    console.log('🔍 UNIQUENESS ANALYSIS:');
    console.log(`   Unique takes: ${uniqueCount}/${results.uniquenessResults.length} (${uniqueRate}%)`);
    console.log(`   Similarity threshold used: ${(categoryThreshold * 100).toFixed(1)}%`);
    console.log('');
    
    // Overall quality assessment
    const qualityMetrics = {
      engagementPass: results.engagementScores.filter(s => s >= 0.2).length / results.engagementScores.length,
      lengthPass: results.lengthStats.filter(l => l >= 20 && l <= 130).length / results.lengthStats.length,
      uniquenessPass: uniqueCount / results.uniquenessResults.length,
      personalityRate: results.personalityModeCount / results.generated
    };
    
    const overallQuality = (qualityMetrics.engagementPass * 0.3 + 
                           qualityMetrics.lengthPass * 0.2 + 
                           qualityMetrics.uniquenessPass * 0.3 + 
                           qualityMetrics.personalityRate * 0.2) * 100;
    
    console.log('🏆 OVERALL QUALITY SCORE:');
    console.log(`   ${overallQuality.toFixed(1)}% (Weighted: Engagement 30%, Uniqueness 30%, Length 20%, Personality 20%)`);
    
    const grade = overallQuality >= 90 ? 'A+' : 
                  overallQuality >= 80 ? 'A' : 
                  overallQuality >= 70 ? 'B' : 
                  overallQuality >= 60 ? 'C' : 'D';
    
    console.log(`   Grade: ${grade}`);
  }
  
  console.log('');
  console.log('✨ Test completed!');
};

// Quick take quality test for faster validation
export const quickQualityTest = async (category: string = 'food'): Promise<{
  success: boolean;
  take: string;
  engagement: number;
  confidence: number;
  length: number;
  personality: boolean;
  unique: boolean;
  generationTime: number;
}> => {
  console.log(`🚀 Quick quality test for ${category}:`);
  
  const startTime = Date.now();
  
  try {
    // Generate single take
    const aiTake = await generateAITake(category);
    const endTime = Date.now();
    
    // Quick analysis
    const engagementScore = calculateEngagementScore(aiTake.text);
    const { generatePersonalityContext } = await import('./personalityEngine');
    const personalityContext = generatePersonalityContext(category);
    
    // Basic uniqueness check (simplified)
    const { getApprovedTakes } = await import('./takeService');
    const existingTakes = await getApprovedTakes();
    const categoryTakes = existingTakes.filter(take => take.category === category);
    const isUnique = !categoryTakes.some(take => take.text.toLowerCase() === aiTake.text.toLowerCase());
    
    const result = {
      success: true,
      take: aiTake.text,
      engagement: engagementScore,
      confidence: aiTake.confidence,
      length: aiTake.text.length,
      personality: personalityContext.isPersonalityMode,
      unique: isUnique,
      generationTime: endTime - startTime
    };
    
    // Log results
    console.log(`✅ "${result.take}"`);
    console.log(`   📊 Engagement: ${result.engagement.toFixed(2)} | Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`   📏 Length: ${result.length} chars | 🎭 Personality: ${result.personality ? 'YES' : 'NO'}`);
    console.log(`   🔍 Unique: ${result.unique ? 'YES' : 'NO'} | ⏱️ Time: ${result.generationTime}ms`);
    
    return result;
    
  } catch (error) {
    console.log(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      take: '',
      engagement: 0,
      confidence: 0,
      length: 0,
      personality: false,
      unique: false,
      generationTime: Date.now() - startTime
    };
  }
};

// Batch test multiple categories for comparison
export const batchCategoryTest = async (categories: string[] = ['food', 'technology', 'politics', 'pets'], testsPerCategory: number = 3): Promise<void> => {
  console.log('🎯 BATCH CATEGORY QUALITY TEST');
  console.log('===============================');
  console.log(`Categories: ${categories.join(', ')} | Tests per category: ${testsPerCategory}`);
  console.log('');
  
  const categoryResults: Record<string, {
    successRate: number;
    avgEngagement: number;
    avgConfidence: number;
    avgLength: number;
    personalityRate: number;
    uniqueRate: number;
    avgGenerationTime: number;
  }> = {};
  
  for (const category of categories) {
    console.log(`🔍 Testing ${category}...`);
    
    const results: Array<Awaited<ReturnType<typeof quickQualityTest>>> = [];
    
    for (let i = 0; i < testsPerCategory; i++) {
      const result = await quickQualityTest(category);
      results.push(result);
      
      // Small delay between tests
      if (i < testsPerCategory - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Calculate statistics for this category
    const successful = results.filter(r => r.success);
    if (successful.length > 0) {
      categoryResults[category] = {
        successRate: successful.length / results.length,
        avgEngagement: successful.reduce((sum, r) => sum + r.engagement, 0) / successful.length,
        avgConfidence: successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length,
        avgLength: successful.reduce((sum, r) => sum + r.length, 0) / successful.length,
        personalityRate: successful.filter(r => r.personality).length / successful.length,
        uniqueRate: successful.filter(r => r.unique).length / successful.length,
        avgGenerationTime: successful.reduce((sum, r) => sum + r.generationTime, 0) / successful.length
      };
    } else {
      categoryResults[category] = {
        successRate: 0, avgEngagement: 0, avgConfidence: 0, avgLength: 0,
        personalityRate: 0, uniqueRate: 0, avgGenerationTime: 0
      };
    }
    
    console.log('');
  }
  
  // Summary comparison
  console.log('📊 CATEGORY COMPARISON SUMMARY');
  console.log('==============================');
  
  categories.forEach(category => {
    const stats = categoryResults[category];
    console.log(`\n🎯 ${category.toUpperCase()}:`);
    console.log(`   Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`   Avg Engagement: ${stats.avgEngagement.toFixed(2)} | Avg Confidence: ${stats.avgConfidence.toFixed(2)}`);
    console.log(`   Avg Length: ${stats.avgLength.toFixed(0)} chars | Personality Rate: ${(stats.personalityRate * 100).toFixed(1)}%`);
    console.log(`   Unique Rate: ${(stats.uniqueRate * 100).toFixed(1)}% | Avg Time: ${stats.avgGenerationTime.toFixed(0)}ms`);
  });
  
  console.log('\n✨ Batch testing completed!');
};