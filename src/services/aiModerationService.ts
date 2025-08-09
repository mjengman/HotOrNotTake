// AI Moderation Service for user-submitted takes
// Checks for hate speech, profanity, and inappropriate content

interface ModerationResult {
  approved: boolean;
  reason?: string;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const moderateUserTake = async (takeText: string): Promise<ModerationResult> => {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ No OpenAI API key - auto-approving take');
    return { approved: true };
  }

  try {
    console.log(`🛡️ Moderating take: "${takeText.substring(0, 50)}..."`);

    const moderationPrompt = `You are a content moderator for a social "Hot or Not Takes" app where users share controversial opinions.

REVIEW THIS USER SUBMISSION:
"${takeText}"

MODERATION RULES:
✅ APPROVE: Controversial opinions, political views, strong disagreements, edgy humor
✅ APPROVE: Passionate takes about any topic (even if many would disagree)  
✅ APPROVE: Philosophical statements, life advice, personal reflections
✅ APPROVE: Opinion pieces on any topic - controversial or not
❌ REJECT: Hate speech targeting groups, explicit sexual content, graphic violence
❌ REJECT: Personal harassment, doxxing, illegal activity promotion
❌ REJECT: Excessive profanity (multiple f-words, racial slurs, etc.)

Respond with EXACTLY one of these formats:
"APPROVED" (if content is acceptable)
"REJECTED: [brief reason]" (if content violates rules)

Be very lenient - this is a platform for ALL types of takes and opinions, controversial or not.`;

    const requestPayload = {
      model: 'gpt-3.5-turbo',
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
      max_tokens: 50,
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
    const moderationResponse = data.choices?.[0]?.message?.content?.trim();

    console.log(`🛡️ Moderation response: "${moderationResponse}"`);

    if (!moderationResponse) {
      throw new Error('Empty moderation response');
    }

    // Parse the response
    if (moderationResponse.startsWith('APPROVED')) {
      console.log('✅ Take approved by AI moderation');
      return { approved: true };
    } else if (moderationResponse.startsWith('REJECTED:')) {
      const reason = moderationResponse.replace('REJECTED:', '').trim();
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