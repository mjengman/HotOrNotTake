// AI Moderation Service for user-submitted takes
// Checks for hate speech, profanity, and inappropriate content

import Constants from 'expo-constants';

interface ModerationResult {
  approved: boolean;
  reason?: string;
}

interface SemanticMatchResult {
  matches: boolean;
  confidence: number;
  suggestedCategory?: string;
}

// ChatGPT's bulletproof solution: Use expo-constants for manifest embedding
// Fallback to process.env for development
const OPENAI_API_KEY = 
  (Constants.expoConfig?.extra as any)?.openaiApiKey ?? 
  process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ChatGPT's enhanced debug logging
console.log('🔐 OpenAI Debug Info (ChatGPT Method):');
console.log('  Key present?', !!OPENAI_API_KEY);
console.log('  Key preview:', String(OPENAI_API_KEY || '').slice(0, 7) + '…');
console.log('  Key source:', 
  (Constants.expoConfig as any)?.extra?.openaiApiKey ? 'expoConfig' : 
  process.env.EXPO_PUBLIC_OPENAI_API_KEY ? 'process.env' : 'none'
);
console.log('  Environment:', __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION');

// Test OpenAI API connection (Grok's suggestion)
export const testOpenAIConnection = async (): Promise<{ success: boolean; error?: string }> => {
  console.log('🧪 Testing OpenAI API connection...');
  
  if (!OPENAI_API_KEY) {
    const error = '🔴 CRITICAL: OpenAI API key missing!';
    console.error(error);
    return { success: false, error };
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    });
    
    const status = response.ok ? 'SUCCESS' : `FAILED (${response.status})`;
    console.log(`🟢 OpenAI API Test: ${status}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error('🔴 API Error Details:', errorText);
      return { success: false, error: `API returned ${response.status}: ${errorText}` };
    }
    
    return { success: true };
  } catch (error: any) {
    const errorMsg = `Network/Connection error: ${error.message}`;
    console.error('🔴 OpenAI API Test Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
};

// Simple category validation using GPT prompt
export const validateTakeCategory = async (takeText: string, category: string): Promise<{ matches: boolean; reason?: string }> => {
  if (!OPENAI_API_KEY) {
    const error = '🔴 CRITICAL: OpenAI API key not configured for category validation';
    console.error(error);
    throw new Error('AI category validation unavailable - missing API key');
  }

  try {
    console.log(`🎯 Validating take category: "${takeText.substring(0, 30)}..." in "${category}"`);

    const categoryPrompt = `You are a content classifier for a "Hot Takes" app. Be EXTREMELY LENIENT with category matching.

CATEGORY: ${category}
HOT TAKE: "${takeText}"

CATEGORY DEFINITIONS (be VERY inclusive):
- technology: Anything about computers, phones, gaming, software, AI, internet, tech companies, digital platforms, gadgets, etc
- food: Meals, restaurants, cooking, eating habits, cuisines, drinks, diets, nutrition, etc
- work: Jobs, careers, workplace, productivity, management, business, money, success, etc
- life: General life advice, lifestyle, habits, personal growth, philosophy, wisdom, etc
- entertainment: Movies, TV, music, celebrities, books, media, content, etc
- politics: Government, politicians, policies, social issues, current events, ideologies, etc
- relationships: Dating, marriage, friendship, family, social interactions, love, etc
- pets: Animals, pet care, animal behavior, wildlife, etc
- wellness: Health, fitness, mental health, therapy, self-care, medicine, doctors, hospitals, healing, wellness culture, etc
- travel: Tourism, places, transportation, vacation, exploration, etc
- society: Social issues, culture, generational topics, social norms, trends, etc
- environment: Climate, nature, sustainability, green issues, pollution, etc
- sports: All sports, athletes, teams, competitions, fitness activities, games, leagues, exercise, etc

IMPORTANT WELLNESS EXAMPLES (ALL VALID):
- "Therapy is BS" → wellness ✓ (criticism of mental health treatment)
- "I don't believe in therapy" → wellness ✓ (mental health opinion)
- "Doctors are scammers" → wellness ✓ (healthcare criticism)
- "Exercise is overrated" → wellness ✓ (fitness opinion)
- "Mental health is a scam" → wellness ✓ (controversial wellness take)
- "Meditation is stupid" → wellness ✓ (self-care criticism)
- "Vaccines are dangerous" → wellness ✓ (medical opinion)

DEFAULT TO YES - Only reject if completely unrelated (e.g., "I love pizza" in sports, "Buy my product" spam).
Any criticism, praise, or opinion about the category topic should be approved.
Respond with ONLY "yes" or "no".`;

    const requestPayload = {
      model: 'gpt-4o-mini', // More permissive model
      messages: [
        {
          role: 'user',
          content: categoryPrompt
        }
      ],
      max_tokens: 5,
      temperature: 0.1,
    };

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const validationResponse = data.choices?.[0]?.message?.content?.trim();

    console.log(`🎯 Category validation response: "${validationResponse}"`);

    const cleanResponse = validationResponse?.toLowerCase().trim();
    
    if (cleanResponse === 'yes' || cleanResponse?.includes('yes')) {
      console.log('✅ Take matches category');
      return { matches: true };
    } else if (cleanResponse === 'no' || cleanResponse?.includes('no')) {
      console.log(`❌ Take doesn't match category`);
      return { matches: false, reason: `This doesn't belong in the ${category} category.` };
    } else {
      // Default to approval for unexpected responses
      console.warn(`⚠️ Unexpected validation response: "${validationResponse}" - defaulting to approval`);
      return { matches: true };
    }

  } catch (error) {
    console.error('❌ Category validation failed:', error);
    // Default to approval if validation fails
    return { matches: true };
  }
};

export const moderateUserTake = async (takeText: string): Promise<ModerationResult> => {
  if (!OPENAI_API_KEY) {
    const error = '🔴 CRITICAL: OpenAI API key not configured for moderation';
    console.error(error);
    console.error('⚠️ Make sure EXPO_PUBLIC_OPENAI_API_KEY is set in EAS secrets');
    throw new Error('AI moderation unavailable - missing API key');
  }
  
  // Additional debugging for device builds
  console.log(`🔑 API Key exists: ${OPENAI_API_KEY ? 'YES' : 'NO'}`);
  console.log(`🔑 API Key length: ${OPENAI_API_KEY ? OPENAI_API_KEY.length : 0}`);
  console.log(`🔑 API Key starts with sk-: ${OPENAI_API_KEY ? OPENAI_API_KEY.startsWith('sk-') : 'NO'}`);
  console.log(`📱 Environment: ${__DEV__ ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  console.log(`🌐 API URL: ${OPENAI_API_URL}`);

  try {
    console.log(`🛡️ Moderating take: "${takeText.substring(0, 50)}..."`);

    const moderationPrompt = `You are a content moderator for a "Hot or Not Takes" app where users share controversial opinions.

SUBMISSION: "${takeText}"

RULES:
- Be EXTREMELY LENIENT and POLITICALLY NEUTRAL.
- ALLOW ALL political opinions, factual claims, and controversial takes (e.g., immigration, politicians, economics, social issues, religion, conspiracies).
- DO NOT fact-check or reject for "misinformation" or "inaccuracy."
- ONLY REJECT for:
  1. Direct personal threats (e.g., "I will kill [name]")
  2. Doxxing (e.g., addresses, phone numbers)
  3. Graphic sexual content involving minors
  4. Explicit racial slurs (e.g., n-word)
  5. Specific calls for violence (e.g., "Murder [name]")
- DEFAULT TO APPROVAL when in doubt.

ALLOWED EXAMPLES:
- "Immigrants should be deported"
- "Open borders for all"
- "Trump is the best/worst"
- "Trump is a convicted felon"
- "Climate change is fake"
- "Vaccines cause autism"
- "Socialism > capitalism"
- "Religion is nonsense"

Respond with EXACTLY:
- "APPROVED"
- "REJECTED: [specific reason]"

APPROVE unless it clearly violates the 5 rules above.`;

    const requestPayload = {
      model: 'gpt-4o-mini', // More permissive model
      messages: [
        {
          role: 'system',
          content: 'You are a content moderator. Respond only with APPROVED or REJECTED: reason.'
        },
        {
          role: 'user',
          content: moderationPrompt
        }
      ],
      max_tokens: 20,
      temperature: 0.1, // Low temperature for consistent moderation
    };

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
    const moderationResponse = data.choices?.[0]?.message?.content?.trim()?.toLowerCase();

    console.log(`🛡️ Moderation response: "${moderationResponse}"`);

    if (!moderationResponse) {
      console.warn('⚠️ Empty moderation response - defaulting to approval');
      return { approved: true };
    }

    // Robust response parsing (case-insensitive)
    if (moderationResponse.includes('approved')) {
      console.log('✅ Take approved by AI moderation');
      return { approved: true };
    } else if (moderationResponse.includes('rejected')) {
      const reason = moderationResponse.replace('rejected:', '').trim() || 'Unspecified violation';
      console.log(`❌ Take rejected by AI moderation: ${reason}`);
      return { approved: false, reason };
    } else {
      // Unexpected response format - default to approval for safety
      console.warn(`⚠️ Unexpected moderation response: "${moderationResponse}" - defaulting to approval`);
      return { approved: true };
    }

  } catch (error) {
    console.error('❌ AI moderation failed:', error);
    // Default to approval if moderation service fails
    console.log('⚠️ Moderation service failed - defaulting to approval');
    return { approved: true };
  }
};

// Test the moderation service
export const testModerationService = async (): Promise<void> => {
  console.log('🧪 Testing AI moderation service...');
  
  const testCases = [
    "Pineapple on pizza is absolutely disgusting and anyone who likes it has terrible taste",
    "Politicians are all corrupt liars who don't care about regular people", 
    "I hate all [slur] people they should die", // Should be rejected
    "Social media is destroying society and making everyone narcissistic"
  ];

  for (const testCase of testCases) {
    try {
      const result = await moderateUserTake(testCase);
      console.log(`Test: "${testCase.substring(0, 30)}..." → ${result.approved ? 'APPROVED' : 'REJECTED: ' + result.reason}`);
    } catch (error) {
      console.error(`Test failed for: "${testCase.substring(0, 30)}..."`, error);
    }
  }
};