import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onRequest } from 'firebase-functions/v2/https';

initializeApp();

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const ADMIN_DELETE_PIN = defineSecret('ADMIN_DELETE_PIN');
const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const OPENAI_MODERATION_MODEL = 'omni-moderation-latest';
const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_GENERATION_MODEL = 'gpt-4o-mini';
const AI_SYSTEM_USER_ID = 'ai-system';
const MIN_TAKE_LENGTH = 10;
const MAX_TAKE_LENGTH = 150;
const GENERATED_TAKE_COUNT = 8;
const GENERATED_DUPLICATE_SIMILARITY_THRESHOLD = 0.75;
const DUPLICATE_COMPARISON_LIMIT = 100;

const VALID_CATEGORY_LIST = [
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
] as const;

type Category = (typeof VALID_CATEGORY_LIST)[number];

const VALID_CATEGORIES = new Set<string>(VALID_CATEGORY_LIST);

type TakeStatus = 'pending' | 'approved';

interface SubmitTakeRequest {
  text?: unknown;
  category?: unknown;
}

interface GenerateTakesRequest {
  category?: unknown;
  requestingUserId?: unknown;
}

interface AdminRemoveTakeRequest {
  takeId?: unknown;
  pin?: unknown;
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

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface GeneratedTakeBatch {
  takes?: unknown;
}

const db = getFirestore();

const profanityWords = new Set([
  'asshole',
  'assholes',
  'bitch',
  'bitches',
  'bullshit',
  'cock',
  'cum',
  'cunt',
  'dick',
  'fuck',
  'fucked',
  'fucker',
  'fuckers',
  'fucking',
  'piss',
  'pissed',
  'pussy',
  'shit',
  'shitty',
]);

const categoryGenerationGuidance: Record<Category, string> = {
  food: 'Food, restaurants, cooking, dining habits, delivery, snacks, coffee, alcohol, and kitchen culture.',
  work: 'Workplace norms, meetings, productivity, bosses, remote work, careers, ambition, and office culture.',
  pets: 'Pet ownership, animal care, pet culture, training, expenses, and common pet-parent habits.',
  technology: 'Consumer tech, social media, AI, phones, streaming, gadgets, privacy, and digital habits.',
  life: 'Everyday routines, etiquette, growing up, friendship, money habits, time, chores, and personal choices.',
  entertainment: 'Movies, TV, music, celebrities, books, fandoms, games, live events, and pop culture.',
  environment: 'Climate, sustainability, recycling, transportation, energy use, conservation, and green habits.',
  wellness: 'Fitness, sleep, mental health, nutrition, therapy, self-care, supplements, and health trends.',
  society: 'Manners, culture, education, public spaces, family norms, generational debates, and social expectations.',
  politics: 'Civic life, campaigns, institutions, policy tradeoffs, voting, public leadership, and political culture.',
  sports: 'Teams, athletes, leagues, fans, rule changes, coaching, youth sports, and sports media.',
  travel: 'Airports, hotels, tourism, road trips, packing, etiquette abroad, destinations, and vacation habits.',
  relationships: 'Dating, marriage, friendship, boundaries, communication, breakups, commitment, and modern romance.',
};

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

const sanitizeCategory = (value: unknown): Category => {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Category is required.');
  }

  const category = value.toLowerCase().trim();
  if (!VALID_CATEGORIES.has(category)) {
    throw new HttpsError('invalid-argument', 'Please choose a valid category.');
  }

  return category as Category;
};

const sanitizeGenerationCategory = (value: unknown): Category | 'all' => {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Category is required.');
  }

  const category = value.toLowerCase().trim();
  if (category === 'all') {
    return 'all';
  }

  if (!VALID_CATEGORIES.has(category)) {
    throw new HttpsError('invalid-argument', 'Please choose a valid category.');
  }

  return category as Category;
};

const sanitizeTakeId = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Take ID is required.');
  }

  return value.trim();
};

const sanitizeAdminPin = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Admin PIN is required.');
  }

  return value.trim();
};

const checkLocalPolicy = (text: string): ModerationOutcome => {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const profanityCount = words.filter((word) => profanityWords.has(word)).length;
  const uniqueWords = new Set(words);

  if (profanityCount >= 2 || (profanityCount > 0 && words.length <= 5)) {
    return {
      approved: false,
      reason: 'Please turn the profanity into an actual take.',
    };
  }

  if (words.length >= 4 && uniqueWords.size <= 2) {
    return {
      approved: false,
      reason: 'Please submit a complete take, not repeated words.',
    };
  }

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

const chooseLeastSuppliedCategory = async (): Promise<Category> => {
  const counts = VALID_CATEGORY_LIST.reduce((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {} as Record<Category, number>);

  const snapshot = await db
    .collection('takes')
    .where('isApproved', '==', true)
    .select('category')
    .get();

  snapshot.forEach((doc) => {
    const category = doc.get('category');
    if (typeof category === 'string' && VALID_CATEGORIES.has(category)) {
      counts[category as Category] += 1;
    }
  });

  const selected = VALID_CATEGORY_LIST.reduce((best, category) => {
    if (counts[category] < counts[best]) {
      return category;
    }
    return best;
  }, VALID_CATEGORY_LIST[0]);

  logger.info('Selected least-supplied category for all-feed generation.', {
    selected,
    counts,
  });

  return selected;
};

const normalizeGeneratedTake = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const withoutPrefix = value
    .replace(/\s+/g, ' ')
    .replace(/^["']+|["']+$/g, '')
    .replace(/^hot take:\s*/i, '')
    .trim();

  const plainPunctuation = withoutPrefix
    .replace(/\s*;\s*([a-z])/g, (_match, letter: string) => `. ${letter.toUpperCase()}`)
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

  return plainPunctuation.length ? plainPunctuation : null;
};

const getTakeTextFingerprint = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTakeForSimilarity = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getTokenSet = (normalizedText: string): Set<string> =>
  new Set(normalizedText.split(' ').filter(Boolean));

const getCharTrigrams = (normalizedText: string): Set<string> => {
  if (normalizedText.length <= 3) {
    return new Set([normalizedText]);
  }

  const trigrams = new Set<string>();
  for (let index = 0; index <= normalizedText.length - 3; index += 1) {
    trigrams.add(normalizedText.slice(index, index + 3));
  }

  return trigrams;
};

const jaccardSimilarity = <T>(first: Set<T>, second: Set<T>): number => {
  if (first.size === 0 && second.size === 0) {
    return 1;
  }

  let intersection = 0;
  first.forEach((value) => {
    if (second.has(value)) {
      intersection += 1;
    }
  });

  return intersection / (first.size + second.size - intersection);
};

const getTakeSimilarity = (firstText: string, secondText: string): number => {
  const first = normalizeTakeForSimilarity(firstText);
  const second = normalizeTakeForSimilarity(secondText);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  const tokenScore = jaccardSimilarity(getTokenSet(first), getTokenSet(second));
  const trigramScore = jaccardSimilarity(getCharTrigrams(first), getCharTrigrams(second));

  return Math.max(tokenScore, trigramScore);
};

const getRecentApprovedTakeTextsByCategory = async (category: Category): Promise<string[]> => {
  const snapshot = await db
    .collection('takes')
    .where('isApproved', '==', true)
    .select('text', 'category')
    .limit(1000)
    .get();

  return snapshot.docs
    .filter((doc) => doc.get('category') === category)
    .map((doc) => doc.get('text'))
    .filter((text): text is string => typeof text === 'string' && text.trim().length > 0)
    .slice(0, DUPLICATE_COMPARISON_LIMIT);
};

const findSimilarTake = (
  text: string,
  comparisonTexts: string[],
  threshold = GENERATED_DUPLICATE_SIMILARITY_THRESHOLD
): { text: string; score: number } | null => {
  let bestMatch: { text: string; score: number } | null = null;

  for (const comparisonText of comparisonTexts) {
    const score = getTakeSimilarity(text, comparisonText);
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { text: comparisonText, score };
    }
  }

  return bestMatch;
};

const parseGeneratedTakes = (data: OpenAIChatCompletionResponse): string[] => {
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI generation returned no content.');
  }

  const parsed = JSON.parse(content) as GeneratedTakeBatch;
  if (!Array.isArray(parsed.takes)) {
    throw new Error('OpenAI generation returned an invalid take list.');
  }

  const seen = new Set<string>();
  const takes: string[] = [];

  for (const rawTake of parsed.takes) {
    const normalized = normalizeGeneratedTake(rawTake);
    if (!normalized) {
      continue;
    }

    try {
      const text = sanitizeText(normalized);
      const duplicateKey = text.toLowerCase();
      if (seen.has(duplicateKey)) {
        continue;
      }

      seen.add(duplicateKey);
      takes.push(text);
    } catch {
      // Skip malformed model output instead of failing the whole batch.
    }
  }

  if (takes.length === 0) {
    throw new Error('OpenAI generation returned no usable takes.');
  }

  return takes.slice(0, 10);
};

const generateTakeCandidates = async (category: Category): Promise<string[]> => {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_GENERATION_MODEL,
      temperature: 0.95,
      messages: [
        {
          role: 'system',
          content:
            'You write short, human-sounding debate prompts for a swipe voting app. Use plain, spoken punctuation and never use semicolons. Return only JSON that matches the schema.',
        },
        {
          role: 'user',
          content:
            `Generate ${GENERATED_TAKE_COUNT} fresh hot-or-not takes for the "${category}" category. ` +
            `Category scope: ${categoryGenerationGuidance[category]} ` +
            'Each take must be opinionated, specific, debatable, and feel like something a real person would post. ' +
            'Use casual, direct phrasing with simple punctuation. Do not use semicolons at all; prefer short sentences, commas, or dashes. ' +
            'Avoid generic filler, slurs, explicit sexual content, threats, medical advice, legal advice, hashtags, links, questions, and "hot take" prefixes. ' +
            `Keep every take between ${MIN_TAKE_LENGTH} and ${MAX_TAKE_LENGTH} characters.`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'hot_take_batch',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['takes'],
            properties: {
              takes: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`OpenAI generation failed with ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
  return parseGeneratedTakes(data);
};

const createTake = async ({
  text,
  category,
  userId,
  status,
  isAIGenerated = false,
}: {
  text: string;
  category: Category;
  userId: string;
  status: TakeStatus;
  isAIGenerated?: boolean;
}): Promise<string> => {
  const isApproved = status === 'approved';
  const takeData: FirebaseFirestore.DocumentData = {
    text,
    textFingerprint: getTakeTextFingerprint(text),
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
    isAIGenerated,
  };

  if (isApproved) {
    takeData.approvedAt = FieldValue.serverTimestamp();
  }

  const docRef = await db.collection('takes').add(takeData);
  return docRef.id;
};

const httpStatusForError = (code: string): number => {
  switch (code) {
    case 'invalid-argument':
      return 400;
    case 'unauthenticated':
      return 401;
    case 'permission-denied':
      return 403;
    case 'not-found':
      return 404;
    case 'failed-precondition':
      return 412;
    default:
      return 500;
  }
};

const extractRequestData = <T extends object>(body: unknown): T => {
  if (!body || typeof body !== 'object') {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }

  const maybeCallableBody = body as { data?: unknown };
  const data = maybeCallableBody.data ?? body;
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Submission data is required.');
  }

  return data as T;
};

const verifyFirebaseAuth = async (
  authHeader: string | undefined,
  action: string
): Promise<string> => {
  const match = authHeader?.match(/^Bearer (.+)$/i);
  if (!match) {
    throw new HttpsError('unauthenticated', `You must be signed in to ${action}.`);
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(match[1]);
    return decodedToken.uid;
  } catch (error) {
    logger.warn('Invalid Firebase auth token on function request.', {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new HttpsError('unauthenticated', `You must be signed in to ${action}.`);
  }
};

export const submitTake = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 30,
  },
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-Auth');
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    try {
      if (request.method !== 'POST') {
        throw new HttpsError('invalid-argument', 'submitTake accepts POST requests only.');
      }

      const userId = await verifyFirebaseAuth(request.header('X-Firebase-Auth'), 'submit takes');
      const data = extractRequestData<SubmitTakeRequest>(request.body);
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
        response.status(200).json({ result: { takeId, status: 'approved' } });
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
        response.status(200).json({
          result: {
            takeId,
            status: 'pending',
            reason: 'Moderation is temporarily unavailable, so this take was sent to review.',
          },
        });
      }
    } catch (error) {
      const code = error instanceof HttpsError ? error.code : 'internal';
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Submission failed.';
      response.status(httpStatusForError(code)).json({
        error: {
          status: code.toUpperCase().replace(/-/g, '_'),
          message,
        },
      });
    }
  }
);

export const generateTakes = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
  },
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-Auth');
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    try {
      if (request.method !== 'POST') {
        throw new HttpsError('invalid-argument', 'generateTakes accepts POST requests only.');
      }

      const userId = await verifyFirebaseAuth(request.header('X-Firebase-Auth'), 'generate takes');
      const data = extractRequestData<GenerateTakesRequest>(request.body);
      const requestedCategory = sanitizeGenerationCategory(data?.category);
      const category = requestedCategory === 'all' ? await chooseLeastSuppliedCategory() : requestedCategory;

      if (typeof data.requestingUserId === 'string' && data.requestingUserId !== userId) {
        logger.warn('generateTakes ignored mismatched requestingUserId.', {
          authenticatedUserId: userId,
          requestingUserId: data.requestingUserId,
        });
      }

      const firstBatchCandidates = await generateTakeCandidates(category);
      let generatedCandidateCount = firstBatchCandidates.length;
      const comparisonTexts = await getRecentApprovedTakeTextsByCategory(category);
      let addedCount = 0;
      const skipped = {
        duplicate: 0,
        localPolicy: 0,
        moderation: 0,
      };
      const takeIds: string[] = [];

      const processCandidateBatch = async (candidates: string[]) => {
        for (const text of candidates) {
          if (addedCount >= GENERATED_TAKE_COUNT) {
            break;
          }

          const similarTake = findSimilarTake(text, comparisonTexts);
          if (similarTake) {
            skipped.duplicate += 1;
            logger.info('Skipped similar generated take.', {
              category,
              score: Math.round(similarTake.score * 1000) / 1000,
              candidate: text,
              matchedText: similarTake.text,
            });
            continue;
          }

          const localPolicy = checkLocalPolicy(text);
          if (!localPolicy.approved) {
            skipped.localPolicy += 1;
            continue;
          }

          try {
            const moderation = await moderateWithOpenAI(text);
            if (!moderation.approved) {
              skipped.moderation += 1;
              continue;
            }
          } catch (error) {
            skipped.moderation += 1;
            logger.error('OpenAI moderation failed for generated take; skipping candidate.', {
              category,
              error: error instanceof Error ? error.message : String(error),
            });
            continue;
          }

          const takeId = await createTake({
            text,
            category,
            userId: AI_SYSTEM_USER_ID,
            status: 'approved',
            isAIGenerated: true,
          });
          takeIds.push(takeId);
          comparisonTexts.push(text);
          addedCount += 1;
        }
      };

      await processCandidateBatch(firstBatchCandidates);

      const shouldRegenerateForDuplicates =
        skipped.duplicate > 0 && addedCount < GENERATED_TAKE_COUNT;

      if (shouldRegenerateForDuplicates) {
        const duplicateCountBeforeRetry = skipped.duplicate;
        const retryCandidates = await generateTakeCandidates(category);
        generatedCandidateCount += retryCandidates.length;
        await processCandidateBatch(retryCandidates);

        if (skipped.duplicate > duplicateCountBeforeRetry) {
          logger.info('Retry generation still produced similar takes; remaining duplicates were skipped.', {
            category,
            duplicateCount: skipped.duplicate - duplicateCountBeforeRetry,
          });
        }
      }

      logger.info('Generated takes request completed.', {
        requestedBy: userId,
        requestedCategory,
        category,
        generatedCount: generatedCandidateCount,
        addedCount,
        takeIds,
        skipped,
        retriedForDuplicates: shouldRegenerateForDuplicates,
      });

      response.status(200).json({
        result: {
          requestedCategory,
          category,
          generatedCount: generatedCandidateCount,
          addedCount,
          takeIds,
          skipped,
          retriedForDuplicates: shouldRegenerateForDuplicates,
        },
      });
    } catch (error) {
      const code = error instanceof HttpsError ? error.code : 'internal';
      const message =
        error instanceof HttpsError && error.message
          ? error.message
          : 'Failed to generate takes.';

      if (!(error instanceof HttpsError)) {
        logger.error('generateTakes failed.', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      response.status(httpStatusForError(code)).json({
        error: {
          status: code.toUpperCase().replace(/-/g, '_'),
          message,
        },
      });
    }
  }
);

export const adminRemoveTake = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    secrets: [ADMIN_DELETE_PIN],
    timeoutSeconds: 20,
  },
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-Auth');
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    try {
      if (request.method !== 'POST') {
        throw new HttpsError('invalid-argument', 'adminRemoveTake accepts POST requests only.');
      }

      const userId = await verifyFirebaseAuth(request.header('X-Firebase-Auth'), 'remove takes');
      const data = extractRequestData<AdminRemoveTakeRequest>(request.body);
      const takeId = sanitizeTakeId(data.takeId);
      const pin = sanitizeAdminPin(data.pin);
      const expectedPin = ADMIN_DELETE_PIN.value();

      if (!expectedPin || pin !== expectedPin) {
        logger.warn('Invalid admin remove PIN.', { userId, takeId });
        throw new HttpsError('permission-denied', 'Invalid admin PIN.');
      }

      const takeRef = db.collection('takes').doc(takeId);
      const takeSnapshot = await takeRef.get();
      if (!takeSnapshot.exists) {
        throw new HttpsError('not-found', 'Take not found.');
      }

      await takeRef.update({
        isApproved: false,
        status: 'rejected',
        rejectedAt: FieldValue.serverTimestamp(),
        rejectionReason: 'Manually removed by admin',
        adminRemovedAt: FieldValue.serverTimestamp(),
        adminRemovedBy: userId,
      });

      logger.info('Take manually removed by admin tool.', { takeId, userId });
      response.status(200).json({ result: { takeId, status: 'rejected' } });
    } catch (error) {
      const code = error instanceof HttpsError ? error.code : 'internal';
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Admin remove failed.';

      if (!(error instanceof HttpsError)) {
        logger.error('adminRemoveTake failed.', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      response.status(httpStatusForError(code)).json({
        error: {
          status: code.toUpperCase().replace(/-/g, '_'),
          message,
        },
      });
    }
  }
);
