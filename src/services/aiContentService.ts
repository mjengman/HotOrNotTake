import { TakeSubmission } from '../types/Take';

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

// Diverse sub-topics for each category to ensure variety
const getCategoryPrompts = (category: string): string[] => {
  const promptSets = {
    food: [
      'Generate a controversial opinion about a specific cuisine or cooking method',
      'Create a hot take about restaurant culture, tipping, or dining etiquette', 
      'Make a bold statement about a popular food trend or ingredient',
      'Share a controversial opinion about grocery shopping, meal prep, or food waste',
      'Create a divisive take about cooking shows, celebrity chefs, or food media'
    ],
    work: [
      'Generate a controversial opinion about remote work vs office culture',
      'Create a hot take about work-life balance, productivity, or career advice',
      'Make a bold statement about corporate culture, meetings, or management',
      'Share a controversial opinion about job interviews, resumes, or networking',
      'Create a divisive take about workplace technology, automation, or the gig economy'
    ],
    pets: [
      'Generate a controversial opinion about dog breeds, training, or ownership',
      'Create a hot take about cats, cat behavior, or cat vs dog preferences',
      'Make a bold statement about exotic pets, pet adoption, or breeding',
      'Share a controversial opinion about pet care, veterinary costs, or pet insurance',
      'Create a divisive take about service animals, pet-friendly spaces, or animal rights'
    ],
    technology: [
      'Generate a controversial opinion about social media platforms or influencer culture',
      'Create a hot take about smartphones, apps, or digital addiction',
      'Make a bold statement about artificial AI, automation, or tech jobs',
      'Share a controversial opinion about privacy, data collection, or tech companies',
      'Create a divisive take about gaming, streaming, or digital entertainment'
    ],
    life: [
      'Generate a controversial opinion about money, spending habits, or financial advice',
      'Create a hot take about happiness, success, or life goals',
      'Make a bold statement about aging, generations, or life stages',
      'Share a controversial opinion about education, learning, or self-improvement',
      'Create a divisive take about family, friendships, or personal values'
    ],
    entertainment: [
      'Generate a controversial opinion about a specific movie genre, franchise, or trend',
      'Create a hot take about music, artists, or the music industry',
      'Make a bold statement about TV shows, streaming services, or binge-watching',
      'Share a controversial opinion about celebrities, fame, or award shows',
      'Create a divisive take about books, reading, or literary culture'
    ],
    environment: [
      'Generate a controversial opinion about climate change solutions or policies',
      'Create a hot take about recycling, waste reduction, or sustainable living',
      'Make a bold statement about electric vehicles, renewable energy, or green technology',
      'Share a controversial opinion about environmental activism or corporate responsibility',
      'Create a divisive take about conservation, wildlife protection, or eco-tourism'
    ],
    wellness: [
      'Generate a controversial opinion about diet trends, nutrition, or supplements',
      'Create a hot take about exercise, fitness culture, or gym etiquette',
      'Make a bold statement about mental health, therapy, or self-care',
      'Share a controversial opinion about alternative medicine, wellness trends, or healthcare',
      'Create a divisive take about sleep, stress management, or work-life balance'
    ],
    society: [
      'Generate a controversial opinion about social norms, etiquette, or manners',
      'Create a hot take about inequality, privilege, or social justice',
      'Make a bold statement about education systems, parenting, or childhood',
      'Share a controversial opinion about community, neighborhoods, or urban vs rural living',
      'Create a divisive take about generational differences or cultural shifts'
    ],
    politics: [
      'Generate a controversial opinion about voting, elections, or political participation',
      'Create a hot take about government policies, regulations, or bureaucracy',
      'Make a bold statement about political parties, candidates, or campaign strategies',
      'Share a controversial opinion about political media, debates, or coverage',
      'Create a divisive take about civic engagement, activism, or political apathy'
    ],
    sports: [
      'Generate a controversial opinion about a specific sport, team, or athlete',
      'Create a hot take about professional sports, salaries, or fan culture',
      'Make a bold statement about college sports, youth athletics, or competition',
      'Share a controversial opinion about sports media, commentary, or statistics',
      'Create a divisive take about fitness trends, exercise culture, or athletic performance'
    ],
    travel: [
      'Generate a controversial opinion about specific destinations or tourist attractions',
      'Create a hot take about travel culture, tourism, or vacation planning',
      'Make a bold statement about airlines, hotels, or travel experiences',
      'Share a controversial opinion about cultural differences, expat life, or international relations',
      'Create a divisive take about adventure travel, luxury travel, or budget travel'
    ],
    relationships: [
      'Generate a controversial opinion about dating apps, modern dating, or romance',
      'Create a hot take about marriage, commitment, or relationship expectations',
      'Make a bold statement about friendship, social circles, or networking',
      'Share a controversial opinion about parenting styles, family dynamics, or raising children',
      'Create a divisive take about breakups, divorce, or relationship advice'
    ]
  };
  
  return promptSets[category as keyof typeof promptSets] || promptSets.life;
};

// Get a random diverse prompt for the category
const getCategoryPrompt = (category: string): string => {
  const prompts = getCategoryPrompts(category);
  return prompts[Math.floor(Math.random() * prompts.length)];
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
    const categoryPrompt = getCategoryPrompt(selectedCategory); // Get fresh prompt each time
    
    // Add variety factors to make each attempt more unique
    const varietyFactors = [
      'Be specific and avoid generic statements',
      'Focus on a niche aspect most people wouldn\'t think of',
      'Challenge a widely accepted belief',
      'Take an unexpected angle on a common topic',
      'Be bold and make people think twice'
    ];
    const varietyFactor = varietyFactors[Math.floor(Math.random() * varietyFactors.length)];

    const systemPrompt = `You are a creative content generator for a "Hot or Not Takes" app where users vote on controversial opinions.

CRITICAL: Generate completely original content. Avoid generic or common hot takes.

INSTRUCTIONS:
- Generate ONE controversial "hot take" that sounds like a real person wrote it
- Keep it SHORT and PUNCHY - between 15-100 characters maximum
- Make it opinion-based, not factual claims
- Avoid offensive, discriminatory, or harmful content
- Use conversational, confident tone like you're stating your opinion
- BE CONCISE - think casual conversation, not formal writing
- NO em-dashes (—) - use regular dashes (-) or commas instead
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
      const confidence = Math.min(0.95, Math.max(0.4, 
        (finalText.length / 150) * 0.6 + 
        (finalText.includes('!') ? 0.1 : 0) +
        (finalText.split(' ').length > 6 ? 0.2 : 0) +
        (attempt === 1 ? 0.1 : 0) // Bonus for first attempt success
      ));

      console.log(`✅ Generated unique human-like take (attempt ${attempt}): "${finalText}"`);

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
      
      // Small delay to avoid rate limiting
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      errors.push(`Take ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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