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

// Simple, fast text-based duplicate detection  
const isContentUnique = async (newText: string, category: string): Promise<boolean> => {
  try {
    const { getApprovedTakes } = await import('./takeService');
    
    console.log(`🔍 Checking text uniqueness for "${newText.substring(0, 50)}..."`);
    
    const existingTakes = await getApprovedTakes();
    
    // Filter to same category and limit to most recent 50 takes
    const categoryTakes = existingTakes
      .filter(take => take.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50);
    
    if (categoryTakes.length === 0) {
      console.log('✅ No existing takes in category, content is unique');
      return true;
    }
    
    console.log(`🎯 Comparing against ${categoryTakes.length} recent takes`);
    
    // Normalize text for comparison
    const normalizeText = (text: string): string => {
      return text.toLowerCase()
        .replace(/[.,!?;:"'()\-]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    };
    
    const normalizedNewText = normalizeText(newText);
    const words = normalizedNewText.split(' ');
    
    // Check for exact duplicates or very similar content
    for (const existingTake of categoryTakes) {
      const normalizedExisting = normalizeText(existingTake.text);
      
      // Exact match check
      if (normalizedExisting === normalizedNewText) {
        console.log(`❌ Exact duplicate found: "${existingTake.text}"`);
        return false;
      }
      
      // High word overlap check (>75% words in common)
      const existingWords = normalizedExisting.split(' ');
      const commonWords = words.filter(word => existingWords.includes(word));
      const similarity = commonWords.length / Math.max(words.length, existingWords.length);
      
      if (similarity > 0.75) {
        console.log(`❌ High similarity (${(similarity * 100).toFixed(1)}%) with: "${existingTake.text}"`);
        return false;
      }
    }
    
    console.log('✅ Content appears unique based on text comparison');
    return true;
    
  } catch (error) {
    console.error('❌ Error checking content uniqueness:', error);
    // Fail open - allow content if we can't check
    return true;
  }
};

// Generate a single AI take for a specific category with uniqueness checking
export const generateAITake = async (category?: string, maxRetries: number = 5): Promise<AIGeneratedTake> => {
  if (!OPENAI_API_KEY) {
    const error = 'OpenAI API key not configured. Please set EXPO_PUBLIC_OPENAI_API_KEY in your environment.';
    console.error(error);
    throw new Error(error);
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
    const promptTier = promptD20Roll >= 19 ? 'rngSpice' : (promptD20Roll >= 11 ? 'focused' : 'generic');
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
      console.log(`🔍 DEBUG - Making request to: ${OPENAI_API_URL}`);
      
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestPayload),
      });

      console.log(`🔍 DEBUG - Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = `OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`;
        console.log(`❌ DEBUG - ${errorMessage}`);
        console.log(`❌ DEBUG - Full error:`, errorData);
        throw new Error(errorMessage);
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
        await submitTake(submission, currentUser.uid, true); // true = isAIGenerated
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


// Test functions removed - no longer needed with simplified text-based duplicate detection