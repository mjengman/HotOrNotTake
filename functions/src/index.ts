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

interface GeneratedTakeCandidate {
  text: string;
  categoryFit: 'yes' | 'no';
  qualityScore: 1 | 2 | 3 | 4 | 5;
  rejectionReason: string | null;
}

interface GeneratedTakeCandidateOutput {
  take: string;
  categoryFit: 'yes' | 'no';
  qualityScore: 1 | 2 | 3 | 4 | 5;
  rejectionReason: string | null;
}

type GenerationAttempt = 'initial' | 'retry';

interface CategoryGravityWellGuidance {
  avoidTopics: string[];
  avoidFrames: string[];
  freshLanes: string[];
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

const categoryVoiceExamples: Record<Category, string[]> = {
  food: [
    'Restaurant dessert menus are usually not worth the money.',
    'Cooking for friends beats going out almost every time.',
  ],
  work: [
    'Unlimited PTO mostly benefits companies that make people afraid to use it.',
    'A quiet office should count as an employee benefit.',
  ],
  pets: [
    'Dog owners should have to train themselves before training the dog.',
    'Cat people understand boundaries better than dog people.',
  ],
  technology: [
    'Smart home gadgets create more tiny chores than they solve.',
    'Phones got boring once every camera became good enough.',
  ],
  life: [
    'Being early is usually just anxiety dressed up as virtue.',
    'Most people would be happier with fewer plans on their calendar.',
  ],
  entertainment: [
    'A short, messy album is better than a bloated perfect one.',
    'Most streaming shows would be stronger as two-hour movies.',
  ],
  environment: [
    'Reusable bags are theater if the grocery store still wraps everything in plastic.',
    'Cities should make driving inconvenient before begging people to take transit.',
  ],
  wellness: [
    'Morning routines are overrated if your sleep is bad.',
    'A boring workout you actually do beats an optimized plan you quit.',
  ],
  society: [
    'Adults need third places more than they need another delivery app.',
    'Schools should teach conflict repair as seriously as math.',
  ],
  politics: [
    'Local elections affect daily life more than the races people argue about online.',
    'Politicians should have to use the public services they control.',
  ],
  sports: [
    'Instant replay has made some sports more correct and less fun.',
    'A loyal fan base matters more than a perfect stadium experience.',
  ],
  travel: [
    'A slow neighborhood walk tells you more about a city than its famous landmark.',
    'Overplanned vacations feel like errands in a nicer place.',
  ],
  relationships: [
    'Compatibility matters more than chemistry after the first month.',
    'A clean breakup is kinder than a slow fade.',
  ],
};

const bannedGenerationFrames = [
  'is overrated and way too',
  'people need to stop pretending',
  'should be normalized',
  'is not talked about enough',
  'is a scam',
  'should be mandatory',
  'we need to',
  'X is nice, but Y is the real issue',
  'generic advice or safe consensus statements',
  'obvious virtue statements',
  'X is better than Y structures unless highly specific and opinionated',
  'semicolons',
];

const avoidedGenerationTopics = [
  'open office layouts and productivity',
  'four-day work weeks',
  'pineapple on pizza',
  'road trips vs flying',
];

const categoryGravityWellGuidance: Record<Category, CategoryGravityWellGuidance> = {
  food: {
    avoidTopics: [
      'pineapple on pizza',
      'avocado toast prices',
      'breakfast for dinner',
      'coffee as a personality',
    ],
    avoidFrames: [
      'X food is overrated',
      'X belongs or does not belong on pizza',
      'generic best food debates',
    ],
    freshLanes: [
      'restaurant etiquette',
      'delivery app guilt',
      'kids menus',
      'splitting appetizers',
      'tipping at counter service',
      'food allergies in groups',
      'home cooking expectations',
      'diet identity',
      'expensive groceries',
      'potluck behavior',
    ],
  },
  work: {
    avoidTopics: [
      'open office layouts',
      'four-day work week',
      'hustle culture',
      'work-life balance as a generic idea',
    ],
    avoidFrames: [
      'X kills productivity',
      'we need to normalize Y',
    ],
    freshLanes: [
      'office friendships',
      'performance reviews',
      'salary transparency',
      'middle management',
      'networking events',
      'return-to-office mandates',
      'manager behavior',
      'side hustles as identity',
      'promotions and workplace politics',
      'retirement age',
    ],
  },
  pets: {
    avoidTopics: [
      'cats vs dogs as a generic debate',
      'adopt do not shop as a generic slogan',
      'grooming',
    ],
    avoidFrames: [
      'X pet owners are better than Y pet owners',
    ],
    freshLanes: [
      'off-leash dogs in shared spaces',
      'pets in restaurants or planes',
      'vet costs and pet insurance',
      'outdoor cats',
      'raw diets',
      'emotional support animal designations',
      'dog parks',
      'pet grief',
      'breed bans',
      'pet clothing and strollers',
      'fur baby language',
    ],
  },
  technology: {
    avoidTopics: [
      'phone addiction as a generic idea',
      'AI art as a generic idea',
      'privacy as a generic idea',
    ],
    avoidFrames: [
      'X is ruining Y',
    ],
    freshLanes: [
      'algorithmic feeds and mood',
      'right to repair',
      'smart home devices',
      'subscription software fatigue',
      'tech support falling on tech-savvy family members',
      'LinkedIn culture',
      'Bluetooth earbuds etiquette',
      'digital minimalism as status',
      'group chat expectations',
      'kids with tablets in public',
    ],
  },
  life: {
    avoidTopics: [
      'wake up early',
      'be kind',
      'simple productivity advice',
      'generic adulthood is hard jokes',
    ],
    avoidFrames: [
      'everyone should do X',
      'X is the secret to happiness',
    ],
    freshLanes: [
      'neighbor etiquette',
      'birthday expectations',
      'being late',
      'gift giving',
      'house guests',
      'chores and invisible labor',
      'public phone calls',
      'social plans as obligation',
      'money habits among friends',
      'family group chats',
    ],
  },
  entertainment: {
    avoidTopics: [
      'Marvel or superhero fatigue as a generic idea',
      'streaming has too much content as a generic idea',
    ],
    avoidFrames: [
      'X is overrated',
    ],
    freshLanes: [
      'reality TV as legitimate culture',
      'award shows',
      'reboots and IP recycling',
      'music festivals',
      'parasocial relationships with creators',
      'background TV habits',
      'movie theater experience',
      'binge-watching vs week-to-week',
      'celebrity culture',
    ],
  },
  environment: {
    avoidTopics: [
      'recycling',
      'electric cars',
      'solar panels',
      'reusable bags',
      'planting trees',
      'carbon offsets as a generic idea',
    ],
    avoidFrames: [
      'X helps but will not save the planet unless Y',
      'we need systemic change',
      'we need to',
    ],
    freshLanes: [
      'lawns and suburbs',
      'air conditioning',
      'nuclear power',
      'meat and dairy',
      'water rights',
      'greenwashing',
      'corporate accountability vs individual guilt',
      'eco-friendly product status signaling',
      'outdoor cats',
      'flight shaming',
      'fast fashion',
    ],
  },
  wellness: {
    avoidTopics: [
      'cold showers',
      'supplements as a generic idea',
      'therapy as a generic idea',
      'self-care as a generic idea',
      'skincare routines',
    ],
    avoidFrames: [
      'X is mostly a scam',
      'Y is the real self-care',
    ],
    freshLanes: [
      'wellness as class privilege',
      'fitness culture toxicity',
      'diet culture and body image',
      'sleep tracking obsession',
      'sober curiosity trend',
      'therapy-speak overuse in everyday conversation',
      'Ozempic and weight loss drugs',
      'meditation apps',
      'healthy lifestyle as identity',
      'gym bro culture',
    ],
  },
  society: {
    avoidTopics: [
      'kids these days',
      'social media is bad as a generic idea',
      'schools should teach taxes',
      'be nicer in public',
    ],
    avoidFrames: [
      'society needs to',
      'X should be mandatory',
    ],
    freshLanes: [
      'public space etiquette',
      'third places',
      'family obligations',
      'dress codes',
      'wedding and funeral norms',
      'school discipline',
      'neighborhood surveillance culture',
      'generational money tension',
      'customer service expectations',
      'noise in shared spaces',
    ],
  },
  politics: {
    avoidTopics: [
      'generic Trump takes',
      'generic Biden takes',
      'party identity slogans',
      'everyone should vote as a generic statement',
    ],
    avoidFrames: [
      'X politician is terrible',
      'the other side is dumb',
    ],
    freshLanes: [
      'local government competence',
      'term limits',
      'campaign donations',
      'age limits for office',
      'ballot measures',
      'public services',
      'zoning politics',
      'school boards',
      'political yard signs',
      'debate performance vs governing ability',
    ],
  },
  sports: {
    avoidTopics: [
      'GOAT debates as a generic idea',
      'LeBron vs Jordan',
      'baseball is too slow',
      'soccer is boring',
    ],
    avoidFrames: [
      'X is the greatest, no debate',
      'real fans know',
    ],
    freshLanes: [
      'youth sports parents',
      'sports betting culture',
      'fantasy sports loyalty',
      'load management',
      'stadium food prices',
      'college athlete pay',
      'bandwagon fans',
      'sports documentaries',
      'coach accountability',
      'rule changes that alter tradition',
    ],
  },
  travel: {
    avoidTopics: [
      'road trips vs flying',
      'travel broadens the mind as a generic idea',
      'packing tips',
    ],
    avoidFrames: [
      'X is overrated for travelers',
    ],
    freshLanes: [
      'over-tourism',
      'travel influencers',
      'destination weddings',
      'solo travel',
      'authentic travel snobbery',
      'cruise ships',
      'tourist traps vs locals',
      'resort vs independent travel',
      'travel as identity or status',
      'airport behavior',
      'souvenirs',
    ],
  },
  relationships: {
    avoidTopics: [
      'love languages',
      'boundaries as a generic idea',
      'dating apps as a generic idea',
      'long-distance as a generic idea',
    ],
    avoidFrames: [
      'boundaries are essential',
      'communication is key',
    ],
    freshLanes: [
      'texting response expectations',
      'exes staying friends',
      'splitting checks or bills',
      'jealousy',
      'cohabitation before marriage',
      'weddings and guest behavior',
      'age gaps',
      'social media behavior in relationships',
      'meeting organically vs apps',
      'relationship timelines',
      'public vs private couples',
    ],
  },
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

  const text = value
    .replace(/\s+/g, ' ')
    .replace(/^["']+|["']+$/g, '')
    .replace(/^hot take:\s*/i, '')
    .trim();

  return text.length ? text : null;
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

const stripMarkdownFences = (content: string): string => {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
};

const isGeneratedTakeCandidateOutput = (value: unknown): value is GeneratedTakeCandidateOutput => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const qualityScore = candidate.qualityScore;

  return (
    typeof candidate.take === 'string' &&
    (candidate.categoryFit === 'yes' || candidate.categoryFit === 'no') &&
    (qualityScore === 1 ||
      qualityScore === 2 ||
      qualityScore === 3 ||
      qualityScore === 4 ||
      qualityScore === 5) &&
    (candidate.rejectionReason === null || typeof candidate.rejectionReason === 'string')
  );
};

const parseGeneratedTakes = (data: OpenAIChatCompletionResponse): GeneratedTakeCandidate[] => {
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI generation returned no content.');
  }

  const parsed = JSON.parse(stripMarkdownFences(content)) as GeneratedTakeBatch;
  if (!Array.isArray(parsed.takes)) {
    throw new Error('OpenAI generation returned an invalid take list.');
  }

  const seen = new Set<string>();
  const takes: GeneratedTakeCandidate[] = [];

  for (const rawTake of parsed.takes) {
    if (!isGeneratedTakeCandidateOutput(rawTake)) {
      throw new Error('OpenAI generation returned a take with missing or invalid evaluation fields.');
    }

    const normalized = normalizeGeneratedTake(rawTake.take);
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
      takes.push({
        text,
        categoryFit: rawTake.categoryFit,
        qualityScore: rawTake.qualityScore,
        rejectionReason: rawTake.rejectionReason,
      });
    } catch {
      // Skip malformed model output instead of failing the whole batch.
    }
  }

  if (takes.length === 0) {
    throw new Error('OpenAI generation returned no usable takes.');
  }

  return takes.slice(0, 10);
};

const generationPromptForAttempt = (category: Category, attempt: GenerationAttempt): string => {
  const retryInstruction = attempt === 'retry'
    ? 'This is a retry because the previous batch had low-quality, mismatched, duplicated, or policy-rejected candidates. Be more specific, more varied, and more category-grounded. '
    : '';
  const gravityWellGuidance = categoryGravityWellGuidance[category];

  return (
    retryInstruction +
    `Generate ${GENERATED_TAKE_COUNT} fresh hot-or-not takes for the "${category}" category. ` +
    `Category scope: ${categoryGenerationGuidance[category]} ` +
    `Voice examples for tone and range only: ${categoryVoiceExamples[category].map(example => `"${example}"`).join(' / ')} ` +
    `Known repeated topics to avoid for this category: ${gravityWellGuidance.avoidTopics.join(' | ')}. ` +
    `Known repeated rhetorical frames to avoid for this category: ${gravityWellGuidance.avoidFrames.join(' | ')}. ` +
    `Fresh lanes to explore for this category: ${gravityWellGuidance.freshLanes.join(' | ')}. ` +
    'Quality target: A good take should make two normal people disagree at brunch without becoming toxic. It is specific, social, and rooted in real lived behavior, not generic advice, virtue signaling, or recycled internet debates. ' +
    'Each take must be opinionated, specific, debatable, and feel like something a real person would post. ' +
    'Mix short punchy takes with longer argumentative takes. Do not use the same sentence structure twice in a row. ' +
    'Stake a clear position. Do not write observations, questions, vague culture commentary, or hedged takes. ' +
    'Do not use hedging language like might, could arguably, or some would say. Vary sentence openers. ' +
    'First person is allowed, but not required. ' +
    `Never use these reusable frames: ${bannedGenerationFrames.join(' | ')}. ` +
    `Avoid these repeated topics entirely: ${avoidedGenerationTopics.join(' | ')}. ` +
    'Do not use semicolons. Not one. Use periods, commas, or dashes instead. ' +
    'Avoid generic filler, slurs, explicit sexual content, threats, medical advice, legal advice, hashtags, links, questions, and "hot take" prefixes. ' +
    `Keep every take between ${MIN_TAKE_LENGTH} and ${MAX_TAKE_LENGTH} characters. ` +
    'For each candidate, self-evaluate honestly. categoryFit must be "no" if the take could fit any generic category. ' +
    'Reject candidates that are generic advice, obvious virtue statements, safe consensus opinions, recycled category tropes, common internet arguments, "X is nice, but Y is the real issue" scaffolding, "we need to" framing, or "X should be mandatory" framing. ' +
    'Use qualityScore 5 only for specific, opinionated takes rooted in real social friction that would genuinely split a room. ' +
    'Use qualityScore 4 only for a clear opinion with recognizable conflict that is not a trope or cliche. ' +
    'Use qualityScore 3 for plausible but generic, safe, or weakly opinionated takes. Use 2 for virtue statements, advice, or obvious consensus. Use 1 for harmful, off-category, or incoherent takes. ' +
    'Set rejectionReason to null only when categoryFit is "yes" and qualityScore is 4 or 5. Otherwise provide a short rejectionReason. ' +
    'Return raw JSON only. No markdown fences, no prose, no explanation.'
  );
};

const generateTakeCandidates = async (
  category: Category,
  attempt: GenerationAttempt = 'initial'
): Promise<GeneratedTakeCandidate[]> => {
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
            'You write sharp, human-sounding debate prompts for a swipe voting app. You also judge your own candidates strictly. Return raw JSON only, with no markdown fences or explanation text.',
        },
        {
          role: 'user',
          content: generationPromptForAttempt(category, attempt),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'evaluated_hot_take_batch',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['takes'],
            properties: {
              takes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['take', 'categoryFit', 'qualityScore', 'rejectionReason'],
                  properties: {
                    take: {
                      type: 'string',
                    },
                    categoryFit: {
                      type: 'string',
                      enum: ['yes', 'no'],
                    },
                    qualityScore: {
                      type: 'integer',
                      enum: [1, 2, 3, 4, 5],
                    },
                    rejectionReason: {
                      anyOf: [
                        { type: 'string' },
                        { type: 'null' },
                      ],
                    },
                  },
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

const tryGenerateTakeCandidates = async (
  category: Category,
  attempt: GenerationAttempt
): Promise<GeneratedTakeCandidate[]> => {
  try {
    const candidates = await generateTakeCandidates(category, attempt);
    logger.info('OpenAI generated evaluated candidates.', {
      category,
      attempt,
      candidates,
    });
    return candidates;
  } catch (error) {
    logger.error('OpenAI generation produced no usable candidates.', {
      category,
      attempt,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
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

      const firstBatchCandidates = await tryGenerateTakeCandidates(category, 'initial');
      let generatedCandidateCount = firstBatchCandidates.length;
      const comparisonTexts = await getRecentApprovedTakeTextsByCategory(category);
      let addedCount = 0;
      const skipped = {
        duplicate: 0,
        generation: 0,
        categoryMismatch: 0,
        lowQuality: 0,
        punctuation: 0,
        localPolicy: 0,
        moderation: 0,
      };
      const takeIds: string[] = [];

      const processCandidateBatch = async (
        candidates: GeneratedTakeCandidate[],
        attempt: GenerationAttempt
      ) => {
        if (candidates.length === 0) {
          skipped.generation += 1;
        }

        for (const candidate of candidates) {
          if (addedCount >= GENERATED_TAKE_COUNT) {
            break;
          }

          const { text } = candidate;

          if (candidate.categoryFit !== 'yes') {
            skipped.categoryMismatch += 1;
            logger.info('Skipped category-mismatched generated take.', {
              category,
              attempt,
              candidate: text,
              reason: candidate.rejectionReason,
            });
            continue;
          }

          if (candidate.qualityScore < 4) {
            skipped.lowQuality += 1;
            logger.info('Skipped low-quality generated take.', {
              category,
              attempt,
              qualityScore: candidate.qualityScore,
              candidate: text,
              reason: candidate.rejectionReason,
            });
            continue;
          }

          if (candidate.rejectionReason) {
            skipped.lowQuality += 1;
            logger.info('Skipped self-rejected generated take.', {
              category,
              attempt,
              qualityScore: candidate.qualityScore,
              candidate: text,
              reason: candidate.rejectionReason,
            });
            continue;
          }

          if (text.includes(';')) {
            skipped.punctuation += 1;
            logger.info('Skipped generated take containing semicolon.', {
              category,
              attempt,
              candidate: text,
            });
            continue;
          }

          const similarTake = findSimilarTake(text, comparisonTexts);
          if (similarTake) {
            skipped.duplicate += 1;
            logger.info('Skipped similar generated take.', {
              category,
              attempt,
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

      await processCandidateBatch(firstBatchCandidates, 'initial');

      const firstAttemptSkipped =
        skipped.generation +
        skipped.categoryMismatch +
        skipped.lowQuality +
        skipped.punctuation +
        skipped.duplicate +
        skipped.localPolicy +
        skipped.moderation;
      const shouldRegenerate = firstAttemptSkipped > 0 && addedCount < GENERATED_TAKE_COUNT;

      if (shouldRegenerate) {
        const skippedBeforeRetry = { ...skipped };
        const retryCandidates = await tryGenerateTakeCandidates(category, 'retry');
        generatedCandidateCount += retryCandidates.length;
        await processCandidateBatch(retryCandidates, 'retry');

        const retrySkippedCount =
          skipped.generation - skippedBeforeRetry.generation +
          skipped.categoryMismatch - skippedBeforeRetry.categoryMismatch +
          skipped.lowQuality - skippedBeforeRetry.lowQuality +
          skipped.punctuation - skippedBeforeRetry.punctuation +
          skipped.duplicate - skippedBeforeRetry.duplicate +
          skipped.localPolicy - skippedBeforeRetry.localPolicy +
          skipped.moderation - skippedBeforeRetry.moderation;

        if (retrySkippedCount > 0) {
          logger.info('Retry generation still produced rejected candidates; remaining failures were skipped.', {
            category,
            retrySkippedCount,
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
        retried: shouldRegenerate,
      });

      response.status(200).json({
        result: {
          requestedCategory,
          category,
          generatedCount: generatedCandidateCount,
          addedCount,
          takeIds,
          skipped,
          retried: shouldRegenerate,
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
