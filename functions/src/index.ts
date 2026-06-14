import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const OPENAI_MODERATION_MODEL = 'omni-moderation-latest';
const MIN_TAKE_LENGTH = 10;
const MAX_TAKE_LENGTH = 150;

const VALID_CATEGORIES = new Set([
  'food',
  'work',
  'pets',
  'technology',
  'life',
  'entertainment',
  'environment',
  'wellness',
  'society',
  'politics',
  'sports',
  'travel',
  'relationships',
]);

type TakeStatus = 'pending' | 'approved';

interface SubmitTakeRequest {
  text?: unknown;
  category?: unknown;
}

interface OpenAIModerationResult {
  flagged?: boolean;
  categories?: Record<string, boolean>;
}

interface OpenAIModerationResponse {
  results?: OpenAIModerationResult[];
}

interface ModerationOutcome {
  approved: boolean;
  reason?: string;
}

const db = getFirestore();

const localRejectionRules: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(?:suck\s+my\s+(?:dick|cock)|blow\s+me|send\s+nudes?)\b/i,
    reason: 'Please keep submissions free of explicit sexual language.',
  },
  {
    pattern: /\b(?:dick|cock|pussy|cunt|blowjob|cum)\b/i,
    reason: 'Please keep submissions free of explicit sexual language.',
  },
  {
    pattern: /(?:https?:\/\/|www\.)/i,
    reason: 'Links and promotional posts are not allowed.',
  },
  {
    pattern: /\b(?:hmu+|hit\s+me\s+up|dm\s+me|message\s+me|text\s+me|telegram|whatsapp|snapchat)\b/i,
    reason: 'Solicitation and contact-info posts are not allowed.',
  },
];

const sanitizeText = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Take text is required.');
  }

  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < MIN_TAKE_LENGTH) {
    throw new HttpsError('invalid-argument', `Takes must be at least ${MIN_TAKE_LENGTH} characters.`);
  }
  if (text.length > MAX_TAKE_LENGTH) {
    throw new HttpsError('invalid-argument', `Takes must be ${MAX_TAKE_LENGTH} characters or fewer.`);
  }

  return text;
};

const sanitizeCategory = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Category is required.');
  }

  const category = value.toLowerCase().trim();
  if (!VALID_CATEGORIES.has(category)) {
    throw new HttpsError('invalid-argument', 'Please choose a valid category.');
  }

  return category;
};

const checkLocalPolicy = (text: string): ModerationOutcome => {
  for (const rule of localRejectionRules) {
    if (rule.pattern.test(text)) {
      return { approved: false, reason: rule.reason };
    }
  }

  return { approved: true };
};

const reasonForCategories = (categories: Record<string, boolean> = {}): string => {
  if (categories['sexual/minors']) {
    return 'Content involving minors is not allowed.';
  }
  if (categories.sexual) {
    return 'Please keep submissions free of explicit sexual content.';
  }
  if (categories['hate/threatening'] || categories.hate) {
    return 'Hateful content or slurs are not allowed.';
  }
  if (categories['harassment/threatening'] || categories.harassment) {
    return 'Harassment or threats are not allowed.';
  }
  if (categories['self-harm/instructions'] || categories['self-harm/intent'] || categories['self-harm']) {
    return 'Self-harm instructions or encouragement are not allowed.';
  }
  if (categories['violence/graphic'] || categories.violence) {
    return 'Threats or graphic violence are not allowed.';
  }
  if (categories['illicit/violent'] || categories.illicit) {
    return 'Instructions for illegal activity are not allowed.';
  }

  return 'This take violates the community guidelines.';
};

const moderateWithOpenAI = async (text: string): Promise<ModerationOutcome> => {
  const response = await fetch(OPENAI_MODERATION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODERATION_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`OpenAI moderation failed with ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as OpenAIModerationResponse;
  const result = data.results?.[0];
  if (!result) {
    throw new Error('OpenAI moderation returned no result.');
  }

  if (result.flagged) {
    return {
      approved: false,
      reason: reasonForCategories(result.categories),
    };
  }

  return { approved: true };
};

const createTake = async ({
  text,
  category,
  userId,
  status,
}: {
  text: string;
  category: string;
  userId: string;
  status: TakeStatus;
}): Promise<string> => {
  const isApproved = status === 'approved';
  const takeData: FirebaseFirestore.DocumentData = {
    text,
    category,
    hotVotes: 0,
    notVotes: 0,
    totalVotes: 0,
    createdAt: FieldValue.serverTimestamp(),
    submittedAt: FieldValue.serverTimestamp(),
    userId,
    isApproved,
    status,
    reportCount: 0,
    isAIGenerated: false,
  };

  if (isApproved) {
    takeData.approvedAt = FieldValue.serverTimestamp();
  }

  const docRef = await db.collection('takes').add(takeData);
  return docRef.id;
};

export const submitTake = onCall(
  {
    region: 'us-central1',
    invoker: 'public',
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 30,
  },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError('unauthenticated', 'You must be signed in to submit takes.');
    }

    const data = request.data as SubmitTakeRequest;
    const text = sanitizeText(data?.text);
    const category = sanitizeCategory(data?.category);

    const localPolicy = checkLocalPolicy(text);
    if (!localPolicy.approved) {
      throw new HttpsError(
        'failed-precondition',
        localPolicy.reason ?? 'This take violates the community guidelines.'
      );
    }

    try {
      const moderation = await moderateWithOpenAI(text);
      if (!moderation.approved) {
        throw new HttpsError(
          'failed-precondition',
          moderation.reason ?? 'This take violates the community guidelines.'
        );
      }

      const takeId = await createTake({ text, category, userId, status: 'approved' });
      return { takeId, status: 'approved' };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error('OpenAI moderation failed; storing take as pending.', {
        userId,
        category,
        error: error instanceof Error ? error.message : String(error),
      });

      const takeId = await createTake({ text, category, userId, status: 'pending' });
      return {
        takeId,
        status: 'pending',
        reason: 'Moderation is temporarily unavailable, so this take was sent to review.',
      };
    }
  }
);
