/**
 * Live corpus quality audit for Hot or Not Takes.
 *
 * Setup:
 * 1. Create/download a Firebase Admin service account key locally.
 * 2. Do not commit the key.
 * 3. Run:
 *    GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json npm run audit:corpus
 *
 * Optional:
 *    npm run audit:corpus -- --project hot-or-not-takes --threshold 0.72 --json ./corpus-audit.json
 *
 * This script reads approved takes from Firestore and writes nothing.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface CorpusTake {
  id: string;
  text: string;
  category: string;
  totalVotes: number;
  isAIGenerated: boolean;
  createdAt?: string;
  approvedAt?: string;
}

interface DuplicateCluster {
  category: string;
  count: number;
  maxSimilarity: number;
  examples: Array<Pick<CorpusTake, 'id' | 'text' | 'category' | 'totalVotes'>>;
}

type ClassifiedAuditTier = 'tier_1' | 'tier_2';

interface ClassifiedAuditCandidate {
  tier: ClassifiedAuditTier;
  id: string;
  text: string;
  category: string;
  reason: string;
  similarity?: number;
  matchedId?: string;
}

interface PhraseFrequency {
  phrase: string;
  count: number;
}

interface DriftFlag {
  id: string;
  text: string;
  category: string;
  suspectedCategory: string;
  matchedTerms: string[];
}

interface StructuralSummary {
  averageWordsPerTake: number;
  sentenceCountDistribution: Record<string, number>;
  commonRhythms: Array<{ signature: string; count: number; examples: string[] }>;
}

interface CorpusAuditReport {
  generatedAt: string;
  totalApprovedTakes: number;
  aiGeneratedTakes: number;
  userGeneratedTakes: number;
  duplicateThreshold: number;
  nearDuplicateClusters: DuplicateCluster[];
  repeatedPhrases: Record<'threeWord' | 'fourWord' | 'fiveWord', PhraseFrequency[]>;
  semicolon: {
    count: number;
    percentage: number;
    examples: Array<Pick<CorpusTake, 'id' | 'text' | 'category'>>;
  };
  categoryDriftFlags: DriftFlag[];
  classifiedCandidates: {
    tier1: ClassifiedAuditCandidate[];
    tier2: ClassifiedAuditCandidate[];
  };
  structure: StructuralSummary;
  volumeByCategory: Array<{ category: string; count: number }>;
}

const DEFAULT_DUPLICATE_THRESHOLD = 0.7;
const TOP_PHRASE_LIMIT = 25;
const TOP_DRIFT_LIMIT = 50;
const TOP_CLUSTER_LIMIT = 30;
const TOP_RHYTHM_LIMIT = 15;
const TOP_CLASSIFIED_CANDIDATE_LIMIT = 80;
const EXACT_DUPLICATE_THRESHOLD = 0.95;
const GRAVITY_WELL_MIN_SIMILARITY = 0.7;
const GRAVITY_WELL_MAX_SIMILARITY = 0.95;
const GRAVITY_WELL_TOPIC_MIN_COUNT = 3;

const categoryTerms: Record<string, string[]> = {
  food: [
    'pizza', 'restaurant', 'restaurants', 'cook', 'cooking', 'meal', 'meals', 'snack',
    'coffee', 'breakfast', 'lunch', 'dinner', 'delivery', 'food', 'eat', 'eating',
  ],
  work: [
    'work', 'office', 'meeting', 'meetings', 'boss', 'career', 'careers', 'remote',
    'salary', 'productivity', 'coworker', 'coworkers', 'job', 'jobs',
  ],
  pets: [
    'pet', 'pets', 'dog', 'dogs', 'cat', 'cats', 'animal', 'animals', 'vet',
    'leash', 'adopt', 'adoption',
  ],
  technology: [
    'ai', 'phone', 'phones', 'app', 'apps', 'social media', 'algorithm', 'privacy',
    'internet', 'streaming', 'tech', 'technology', 'gadget', 'gadgets',
  ],
  life: [
    'money', 'chores', 'routine', 'routines', 'friend', 'friends', 'habit', 'habits',
    'time', 'adults', 'adult', 'life',
  ],
  entertainment: [
    'movie', 'movies', 'tv', 'show', 'shows', 'music', 'celebrity', 'celebrities',
    'book', 'books', 'game', 'games', 'concert', 'fandom',
  ],
  environment: [
    'climate', 'recycle', 'recycling', 'sustainable', 'sustainability', 'plastic',
    'energy', 'carbon', 'environment', 'green', 'solar', 'transit',
  ],
  wellness: [
    'fitness', 'sleep', 'therapy', 'mental health', 'nutrition', 'gym', 'workout',
    'meditation', 'supplements', 'diet', 'wellness', 'self care',
  ],
  society: [
    'school', 'schools', 'education', 'culture', 'manners', 'public', 'family',
    'parents', 'kids', 'community', 'society', 'generation', 'generations',
  ],
  politics: [
    'president', 'congress', 'election', 'elections', 'vote', 'voting', 'policy',
    'government', 'politician', 'politicians', 'democrat', 'republican', 'campaign',
  ],
  sports: [
    'nba', 'nfl', 'mlb', 'soccer', 'basketball', 'football', 'baseball', 'team',
    'teams', 'coach', 'coaches', 'athlete', 'athletes', 'fans', 'playoffs',
  ],
  travel: [
    'airport', 'airports', 'flight', 'flights', 'hotel', 'hotels', 'vacation',
    'tourist', 'tourists', 'road trip', 'travel', 'traveling', 'packing',
  ],
  relationships: [
    'date', 'dating', 'marriage', 'partner', 'partners', 'breakup', 'breakups',
    'relationship', 'relationships', 'texting', 'commitment', 'boundaries',
  ],
};

const validCategories = new Set(Object.keys(categoryTerms));

const topicStopWords = new Set([
  'about',
  'after',
  'against',
  'almost',
  'because',
  'before',
  'being',
  'better',
  'could',
  'deserve',
  'deserves',
  'every',
  'from',
  'have',
  'into',
  'just',
  'less',
  'make',
  'makes',
  'more',
  'most',
  'need',
  'needs',
  'never',
  'only',
  'over',
  'people',
  'really',
  'should',
  'than',
  'that',
  'their',
  'them',
  'they',
  'thing',
  'this',
  'those',
  'through',
  'under',
  'when',
  'with',
  'without',
  'would',
]);

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_value, index) => index);
  }

  find(index: number): number {
    if (this.parent[index] !== index) {
      this.parent[index] = this.find(this.parent[index]);
    }

    return this.parent[index];
  }

  union(first: number, second: number): void {
    const firstRoot = this.find(first);
    const secondRoot = this.find(second);

    if (firstRoot !== secondRoot) {
      this.parent[secondRoot] = firstRoot;
    }
  }
}

const parseArgs = () => {
  const args = process.argv.slice(2);
  let threshold = DEFAULT_DUPLICATE_THRESHOLD;
  let jsonPath: string | null = null;
  let projectId: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--threshold' && args[index + 1]) {
      threshold = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--json' && args[index + 1]) {
      jsonPath = args[index + 1];
      index += 1;
    } else if (arg === '--project' && args[index + 1]) {
      projectId = args[index + 1];
      index += 1;
    }
  }

  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error('--threshold must be a number between 0 and 1.');
  }

  return { threshold, jsonPath, projectId };
};

const readProjectIdFromEnvFile = (): string | null => {
  for (const filePath of ['.env.local', '.env']) {
    if (!existsSync(filePath)) {
      continue;
    }

    const match = readFileSync(filePath, 'utf8').match(/^EXPO_PUBLIC_FIREBASE_PROJECT_ID=(.+)$/m);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
};

const resolveProjectId = (argProjectId: string | null): string | undefined =>
  argProjectId ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  process.env.FIREBASE_PROJECT_ID ??
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ??
  readProjectIdFromEnvFile() ??
  undefined;

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (text: string): string[] => normalizeText(text).split(' ').filter(Boolean);

const getNgrams = (tokens: string[], size: number): string[] => {
  const ngrams: string[] = [];

  for (let index = 0; index <= tokens.length - size; index += 1) {
    ngrams.push(tokens.slice(index, index + size).join(' '));
  }

  return ngrams;
};

const getCharTrigrams = (normalizedText: string): Set<string> => {
  const compact = normalizedText.replace(/\s+/g, ' ');
  if (compact.length <= 3) {
    return new Set([compact]);
  }

  const trigrams = new Set<string>();
  for (let index = 0; index <= compact.length - 3; index += 1) {
    trigrams.add(compact.slice(index, index + 3));
  }

  return trigrams;
};

const jaccard = <T>(first: Set<T>, second: Set<T>): number => {
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

const similarityScore = (firstText: string, secondText: string): number => {
  const firstNormalized = normalizeText(firstText);
  const secondNormalized = normalizeText(secondText);

  if (!firstNormalized || !secondNormalized) {
    return 0;
  }

  if (firstNormalized === secondNormalized) {
    return 1;
  }

  const trigramScore = jaccard(
    getCharTrigrams(firstNormalized),
    getCharTrigrams(secondNormalized)
  );
  const tokenScore = jaccard(new Set(firstNormalized.split(' ')), new Set(secondNormalized.split(' ')));

  return Math.max(trigramScore, tokenScore);
};

const trigramSimilarityScore = (firstText: string, secondText: string): number => {
  const firstNormalized = normalizeText(firstText);
  const secondNormalized = normalizeText(secondText);

  if (!firstNormalized || !secondNormalized) {
    return 0;
  }

  if (firstNormalized === secondNormalized) {
    return 1;
  }

  return jaccard(
    getCharTrigrams(firstNormalized),
    getCharTrigrams(secondNormalized)
  );
};

const percentage = (part: number, total: number): number =>
  total === 0 ? 0 : Math.round((part / total) * 1000) / 10;

const readFirestoreDate = (value: unknown): string | undefined => {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate().toISOString();
  }

  return undefined;
};

const fetchApprovedTakes = async (projectId?: string): Promise<CorpusTake[]> => {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  }

  const db = getFirestore();
  const snapshot = await db
    .collection('takes')
    .where('isApproved', '==', true)
    .select('text', 'category', 'totalVotes', 'isAIGenerated', 'createdAt', 'approvedAt')
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: typeof data.text === 'string' ? data.text : '',
        category: typeof data.category === 'string' ? data.category : 'unknown',
        totalVotes: typeof data.totalVotes === 'number' ? data.totalVotes : 0,
        isAIGenerated: data.isAIGenerated === true,
        createdAt: readFirestoreDate(data.createdAt),
        approvedAt: readFirestoreDate(data.approvedAt),
      };
    })
    .filter((take) => take.text.length > 0);
};

const findDuplicateClusters = (takes: CorpusTake[], threshold: number): DuplicateCluster[] => {
  const clusters: DuplicateCluster[] = [];
  const byCategory = new Map<string, CorpusTake[]>();

  takes.forEach((take) => {
    byCategory.set(take.category, [...(byCategory.get(take.category) ?? []), take]);
  });

  byCategory.forEach((categoryTakes, category) => {
    const unionFind = new UnionFind(categoryTakes.length);
    const maxScores = new Map<number, number>();

    for (let first = 0; first < categoryTakes.length; first += 1) {
      for (let second = first + 1; second < categoryTakes.length; second += 1) {
        const score = similarityScore(categoryTakes[first].text, categoryTakes[second].text);
        if (score >= threshold) {
          unionFind.union(first, second);
          maxScores.set(first, Math.max(maxScores.get(first) ?? 0, score));
          maxScores.set(second, Math.max(maxScores.get(second) ?? 0, score));
        }
      }
    }

    const grouped = new Map<number, CorpusTake[]>();
    categoryTakes.forEach((take, index) => {
      const root = unionFind.find(index);
      grouped.set(root, [...(grouped.get(root) ?? []), take]);
    });

    grouped.forEach((group, root) => {
      if (group.length < 2) {
        return;
      }

      clusters.push({
        category,
        count: group.length,
        maxSimilarity: Math.round((maxScores.get(root) ?? threshold) * 1000) / 1000,
        examples: group
          .sort((first, second) => second.totalVotes - first.totalVotes)
          .slice(0, 5)
          .map(({ id, text, category: takeCategory, totalVotes }) => ({
            id,
            text,
            category: takeCategory,
            totalVotes,
          })),
      });
    });
  });

  return clusters
    .sort((first, second) => second.count - first.count || second.maxSimilarity - first.maxSimilarity)
    .slice(0, TOP_CLUSTER_LIMIT);
};

const findSimilarityCandidatesInRange = (
  takes: CorpusTake[],
  minSimilarity: number,
  maxSimilarity: number,
  scorer: (firstText: string, secondText: string) => number = similarityScore,
  candidateFilter: (take: CorpusTake) => boolean = () => true
): ClassifiedAuditCandidate[] => {
  const candidates = new Map<string, ClassifiedAuditCandidate>();
  const byCategory = new Map<string, CorpusTake[]>();

  takes.forEach((take) => {
    byCategory.set(take.category, [...(byCategory.get(take.category) ?? []), take]);
  });

  byCategory.forEach((categoryTakes) => {
    for (let first = 0; first < categoryTakes.length; first += 1) {
      for (let second = first + 1; second < categoryTakes.length; second += 1) {
        const firstTake = categoryTakes[first];
        const secondTake = categoryTakes[second];
        const score = scorer(firstTake.text, secondTake.text);

        if (score < minSimilarity || score >= maxSimilarity) {
          continue;
        }

        [firstTake, secondTake].forEach((candidate, candidateIndex) => {
          if (!candidateFilter(candidate)) {
            return;
          }

          const matched = candidateIndex === 0 ? secondTake : firstTake;
          const existing = candidates.get(candidate.id);
          if (existing && (existing.similarity ?? 0) >= score) {
            return;
          }

          candidates.set(candidate.id, {
            tier: 'tier_2',
            id: candidate.id,
            text: candidate.text,
            category: candidate.category,
            reason: `Near-duplicate cluster candidate; similar to ${matched.id}`,
            similarity: Math.round(score * 1000) / 1000,
            matchedId: matched.id,
          });
        });
      }
    }
  });

  return Array.from(candidates.values())
    .sort(
      (first, second) =>
        (second.similarity ?? 0) - (first.similarity ?? 0) ||
        first.category.localeCompare(second.category)
    )
    .slice(0, TOP_CLASSIFIED_CANDIDATE_LIMIT);
};

const getTopicTokens = (text: string): string[] =>
  tokenize(text).filter(token => token.length >= 4 && !topicStopWords.has(token));

const getTopicPhrases = (take: CorpusTake): string[] => {
  const tokens = getTopicTokens(take.text);
  return [
    ...getNgrams(tokens, 2),
    ...getNgrams(tokens, 3),
  ];
};

const findTopicGravityWellCandidates = (takes: CorpusTake[]): ClassifiedAuditCandidate[] => {
  const candidates = new Map<string, ClassifiedAuditCandidate>();
  const phraseCountsByCategory = new Map<string, Map<string, Set<string>>>();
  const takesById = new Map(takes.map(take => [take.id, take]));

  takes.forEach((take) => {
    const categoryPhrases =
      phraseCountsByCategory.get(take.category) ?? new Map<string, Set<string>>();
    phraseCountsByCategory.set(take.category, categoryPhrases);

    new Set(getTopicPhrases(take)).forEach((phrase) => {
      const takeIds = categoryPhrases.get(phrase) ?? new Set<string>();
      takeIds.add(take.id);
      categoryPhrases.set(phrase, takeIds);
    });
  });

  phraseCountsByCategory.forEach((phraseCounts, category) => {
    Array.from(phraseCounts.entries())
      .filter(([_phrase, takeIds]) => takeIds.size >= GRAVITY_WELL_TOPIC_MIN_COUNT)
      .sort(
        ([firstPhrase, firstTakeIds], [secondPhrase, secondTakeIds]) =>
          secondTakeIds.size - firstTakeIds.size || firstPhrase.localeCompare(secondPhrase)
      )
      .slice(0, 5)
      .forEach(([phrase, takeIds]) => {
        Array.from(takeIds)
          .slice(0, 5)
          .forEach((takeId) => {
            const take = takesById.get(takeId);
            if (!take || candidates.has(take.id)) {
              return;
            }

            candidates.set(take.id, {
              tier: 'tier_2',
              id: take.id,
              text: take.text,
              category,
              reason: `Topic phrase "${phrase}" appears ${takeIds.size} times in ${category}`,
            });
          });
      });
  });

  return Array.from(candidates.values())
    .sort((first, second) => first.category.localeCompare(second.category) || first.id.localeCompare(second.id))
    .slice(0, TOP_CLASSIFIED_CANDIDATE_LIMIT);
};

const findClassifiedAuditCandidates = (
  takes: CorpusTake[]
): CorpusAuditReport['classifiedCandidates'] => {
  const tier1 = new Map<string, ClassifiedAuditCandidate>();
  const tier2 = new Map<string, ClassifiedAuditCandidate>();
  const aiGeneratedTakes = takes.filter((take) => take.isAIGenerated);
  const aiOnly = (take: CorpusTake) => take.isAIGenerated;

  findSimilarityCandidatesInRange(
    takes,
    EXACT_DUPLICATE_THRESHOLD,
    1.01,
    trigramSimilarityScore,
    aiOnly
  ).forEach((candidate) => {
    tier1.set(candidate.id, {
      ...candidate,
      tier: 'tier_1',
      reason: `AI-generated exact/high-similarity duplicate candidate; similar to ${candidate.matchedId}`,
    });
  });

  aiGeneratedTakes
    .filter((take) => take.text.includes(';'))
    .forEach((take) => {
      tier1.set(take.id, {
        tier: 'tier_1',
        id: take.id,
        text: take.text,
        category: take.category,
        reason: 'AI-generated take contains a semicolon',
      });
    });

  aiGeneratedTakes
    .filter((take) => !validCategories.has(take.category))
    .forEach((take) => {
      tier1.set(take.id, {
        tier: 'tier_1',
        id: take.id,
        text: take.text,
        category: take.category,
        reason: `Invalid category "${take.category}"`,
      });
    });

  findSimilarityCandidatesInRange(
    takes,
    GRAVITY_WELL_MIN_SIMILARITY,
    GRAVITY_WELL_MAX_SIMILARITY,
    trigramSimilarityScore,
    aiOnly
  ).forEach((candidate) => {
    if (!tier1.has(candidate.id)) {
      tier2.set(candidate.id, candidate);
    }
  });

  findTopicGravityWellCandidates(aiGeneratedTakes).forEach((candidate) => {
    if (!tier1.has(candidate.id) && !tier2.has(candidate.id)) {
      tier2.set(candidate.id, candidate);
    }
  });

  const sortCandidates = (candidates: ClassifiedAuditCandidate[]) =>
    candidates.sort(
      (first, second) =>
        first.category.localeCompare(second.category) ||
        first.reason.localeCompare(second.reason) ||
        first.id.localeCompare(second.id)
    );

  return {
    tier1: sortCandidates(Array.from(tier1.values())).slice(0, TOP_CLASSIFIED_CANDIDATE_LIMIT),
    tier2: sortCandidates(Array.from(tier2.values())).slice(0, TOP_CLASSIFIED_CANDIDATE_LIMIT),
  };
};

const findRepeatedPhrases = (takes: CorpusTake[], size: number): PhraseFrequency[] => {
  const counts = new Map<string, number>();

  takes.forEach((take) => {
    const uniqueForTake = new Set(getNgrams(tokenize(take.text), size));
    uniqueForTake.forEach((phrase) => {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .filter(([_phrase, count]) => count >= 2)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((first, second) => second.count - first.count || first.phrase.localeCompare(second.phrase))
    .slice(0, TOP_PHRASE_LIMIT);
};

const findCategoryDrift = (takes: CorpusTake[]): DriftFlag[] => {
  const flags: DriftFlag[] = [];

  takes.forEach((take) => {
    const normalized = ` ${normalizeText(take.text)} `;
    const ownTerms = categoryTerms[take.category] ?? [];
    const ownMatches = ownTerms.filter((term) => normalized.includes(` ${normalizeText(term)} `));

    const otherMatches = Object.entries(categoryTerms)
      .filter(([category]) => category !== take.category)
      .map(([category, terms]) => ({
        category,
        matchedTerms: terms.filter((term) => normalized.includes(` ${normalizeText(term)} `)),
      }))
      .filter((match) => match.matchedTerms.length > 0)
      .sort((first, second) => second.matchedTerms.length - first.matchedTerms.length);

    const strongestOther = otherMatches[0];
    if (!strongestOther) {
      return;
    }

    if (ownMatches.length === 0 || strongestOther.matchedTerms.length >= ownMatches.length + 2) {
      flags.push({
        id: take.id,
        text: take.text,
        category: take.category,
        suspectedCategory: strongestOther.category,
        matchedTerms: strongestOther.matchedTerms.slice(0, 6),
      });
    }
  });

  return flags.slice(0, TOP_DRIFT_LIMIT);
};

const getSentenceParts = (text: string): string[] =>
  text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const getRhythmSignature = (text: string): string => {
  const sentenceLengths = getSentenceParts(text).map((sentence) => tokenize(sentence).length);
  if (sentenceLengths.length === 0) {
    return 'empty';
  }

  return sentenceLengths
    .map((length) => {
      if (length <= 6) return 'S';
      if (length <= 14) return 'M';
      return 'L';
    })
    .join('-');
};

const summarizeStructure = (takes: CorpusTake[]): StructuralSummary => {
  const sentenceCountDistribution: Record<string, number> = {};
  const rhythmMap = new Map<string, { count: number; examples: string[] }>();
  let totalWords = 0;

  takes.forEach((take) => {
    const words = tokenize(take.text);
    totalWords += words.length;

    const sentenceCount = Math.max(1, getSentenceParts(take.text).length);
    const sentenceKey = String(sentenceCount);
    sentenceCountDistribution[sentenceKey] = (sentenceCountDistribution[sentenceKey] ?? 0) + 1;

    const signature = getRhythmSignature(take.text);
    const existing = rhythmMap.get(signature) ?? { count: 0, examples: [] };
    rhythmMap.set(signature, {
      count: existing.count + 1,
      examples: existing.examples.length < 3 ? [...existing.examples, take.text] : existing.examples,
    });
  });

  return {
    averageWordsPerTake: takes.length === 0 ? 0 : Math.round((totalWords / takes.length) * 10) / 10,
    sentenceCountDistribution,
    commonRhythms: Array.from(rhythmMap.entries())
      .map(([signature, value]) => ({ signature, ...value }))
      .sort((first, second) => second.count - first.count)
      .slice(0, TOP_RHYTHM_LIMIT),
  };
};

const buildReport = (takes: CorpusTake[], threshold: number): CorpusAuditReport => {
  const semicolonTakes = takes.filter((take) => take.text.includes(';'));
  const volumeCounts = new Map<string, number>();

  takes.forEach((take) => {
    volumeCounts.set(take.category, (volumeCounts.get(take.category) ?? 0) + 1);
  });

  return {
    generatedAt: new Date().toISOString(),
    totalApprovedTakes: takes.length,
    aiGeneratedTakes: takes.filter((take) => take.isAIGenerated).length,
    userGeneratedTakes: takes.filter((take) => !take.isAIGenerated).length,
    duplicateThreshold: threshold,
    nearDuplicateClusters: findDuplicateClusters(takes, threshold),
    repeatedPhrases: {
      threeWord: findRepeatedPhrases(takes, 3),
      fourWord: findRepeatedPhrases(takes, 4),
      fiveWord: findRepeatedPhrases(takes, 5),
    },
    semicolon: {
      count: semicolonTakes.length,
      percentage: percentage(semicolonTakes.length, takes.length),
      examples: semicolonTakes.slice(0, 10).map(({ id, text, category }) => ({ id, text, category })),
    },
    categoryDriftFlags: findCategoryDrift(takes),
    classifiedCandidates: findClassifiedAuditCandidates(takes),
    structure: summarizeStructure(takes),
    volumeByCategory: Array.from(volumeCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((first, second) => second.count - first.count || first.category.localeCompare(second.category)),
  };
};

const printSection = (title: string) => {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
};

const printReport = (report: CorpusAuditReport) => {
  console.log('Hot or Not Takes corpus audit');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Approved takes: ${report.totalApprovedTakes}`);
  console.log(`AI generated: ${report.aiGeneratedTakes}`);
  console.log(`User generated: ${report.userGeneratedTakes}`);

  printSection('Volume by category');
  report.volumeByCategory.forEach(({ category, count }) => {
    console.log(`${category.padEnd(16)} ${count}`);
  });

  printSection('Semicolon frequency');
  console.log(`${report.semicolon.count}/${report.totalApprovedTakes} takes (${report.semicolon.percentage}%)`);
  report.semicolon.examples.forEach((take) => {
    console.log(`- [${take.category}] ${take.id}: ${take.text}`);
  });

  printSection('Near-duplicate clusters');
  if (report.nearDuplicateClusters.length === 0) {
    console.log('No near-duplicate clusters found at this threshold.');
  } else {
    report.nearDuplicateClusters.forEach((cluster, index) => {
      console.log(`\n${index + 1}. [${cluster.category}] ${cluster.count} takes, max similarity ${cluster.maxSimilarity}`);
      cluster.examples.forEach((take) => {
        console.log(`   - ${take.id} (${take.totalVotes} votes): ${take.text}`);
      });
    });
  }

  printSection('Repeated phrases');
  (['threeWord', 'fourWord', 'fiveWord'] as const).forEach((key) => {
    console.log(`\n${key}:`);
    report.repeatedPhrases[key].forEach(({ phrase, count }) => {
      console.log(`- ${count.toString().padStart(3)} "${phrase}"`);
    });
  });

  printSection('Category drift flags');
  if (report.categoryDriftFlags.length === 0) {
    console.log('No heuristic drift flags found.');
  } else {
    report.categoryDriftFlags.forEach((flag) => {
      console.log(
        `- ${flag.id}: [${flag.category}] maybe [${flag.suspectedCategory}] ` +
        `(${flag.matchedTerms.join(', ')}) :: ${flag.text}`
      );
    });
  }

  printSection('Tier 1 AI candidates (safe to soft-delete)');
  if (report.classifiedCandidates.tier1.length === 0) {
    console.log('No Tier 1 AI candidates found.');
  } else {
    report.classifiedCandidates.tier1.forEach((candidate) => {
      const similarity = candidate.similarity === undefined
        ? ''
        : ` similarity=${candidate.similarity}`;
      console.log(
        `- [${candidate.tier}] ${candidate.id} [${candidate.category}]${similarity}: ` +
        `${candidate.reason} :: ${candidate.text}`
      );
    });
  }

  printSection('Tier 2 AI candidates (gravity well — deprioritize, do not delete)');
  if (report.classifiedCandidates.tier2.length === 0) {
    console.log('No Tier 2 AI candidates found.');
  } else {
    report.classifiedCandidates.tier2.forEach((candidate) => {
      const similarity = candidate.similarity === undefined
        ? ''
        : ` similarity=${candidate.similarity}`;
      console.log(
        `- [${candidate.tier}] ${candidate.id} [${candidate.category}]${similarity}: ` +
        `${candidate.reason} :: ${candidate.text}`
      );
    });
  }

  printSection('Structural repetition');
  console.log(`Average words per take: ${report.structure.averageWordsPerTake}`);
  console.log(`Sentence count distribution: ${JSON.stringify(report.structure.sentenceCountDistribution)}`);
  report.structure.commonRhythms.forEach((rhythm) => {
    console.log(`- ${rhythm.signature}: ${rhythm.count}`);
    rhythm.examples.forEach((example) => console.log(`   "${example}"`));
  });
};

const main = async () => {
  const { threshold, jsonPath, projectId: argProjectId } = parseArgs();
  const takes = await fetchApprovedTakes(resolveProjectId(argProjectId));
  const report = buildReport(takes, threshold);

  printReport(report);

  if (jsonPath) {
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nJSON report written to ${jsonPath}`);
  }
};

main().catch((error) => {
  console.error('Corpus audit failed:', error);
  process.exitCode = 1;
});
