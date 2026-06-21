/**
 * Corpus hygiene tools for Hot or Not Takes.
 *
 * Setup:
 * 1. Create/download a Firebase Admin service account key locally.
 * 2. Do not commit the key.
 *
 * Dry-run Tier 1 AI cleanup:
 *    GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json npm run hygiene:corpus
 *
 * Apply Tier 1 AI cleanup, after review:
 *    GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json npm run hygiene:corpus -- --apply-tier1
 *
 * Dry-run reviewed Tier 2 deprioritization:
 *    GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json npm run hygiene:corpus -- --deprioritize --ids id1,id2 --days 30
 *
 * Apply reviewed Tier 2 deprioritization:
 *    GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json npm run hygiene:corpus -- --deprioritize --ids id1,id2 --days 30 --apply-deprioritize
 *
 * This script never hard-deletes and never mutates human-generated takes.
 */

import { existsSync, readFileSync } from 'fs';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

type DeprioritizedReason = 'gravity_well' | 'stale_lane' | 'manual';

interface CorpusTake {
  id: string;
  text: string;
  category: string;
  totalVotes: number;
  isAIGenerated: boolean;
  createdAtMs: number;
  createdAtLabel: string;
  isApproved: boolean;
  status?: string;
}

interface Tier1Candidate {
  id: string;
  text: string;
  category: string;
  reason: string;
  matchedId?: string;
  similarity?: number;
}

interface DeprioritizationCandidate {
  id: string;
  text: string;
  category: string;
  reason: DeprioritizedReason;
  until: Date;
}

interface ParsedArgs {
  projectId: string | null;
  applyTier1: boolean;
  deprioritize: boolean;
  applyDeprioritize: boolean;
  ids: string[];
  days: number;
  reason: DeprioritizedReason;
  auditId?: string;
}

const EXACT_DUPLICATE_THRESHOLD = 0.95;
const APPLY_BATCH_SIZE = 400;

const validCategories = new Set([
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

const parseIds = (rawIds?: string): string[] =>
  (rawIds ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

const parseReason = (rawReason?: string): DeprioritizedReason => {
  if (rawReason === 'gravity_well' || rawReason === 'stale_lane' || rawReason === 'manual') {
    return rawReason;
  }

  return 'gravity_well';
};

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);
  let projectId: string | null = null;
  let applyTier1 = false;
  let deprioritize = false;
  let applyDeprioritize = false;
  let ids: string[] = [];
  let days = 30;
  let reason: DeprioritizedReason = 'gravity_well';
  let auditId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--project' && args[index + 1]) {
      projectId = args[index + 1];
      index += 1;
    } else if (arg === '--apply-tier1') {
      applyTier1 = true;
    } else if (arg === '--deprioritize') {
      deprioritize = true;
    } else if (arg === '--apply-deprioritize') {
      applyDeprioritize = true;
    } else if (arg === '--ids' && args[index + 1]) {
      ids = parseIds(args[index + 1]);
      index += 1;
    } else if (arg === '--days' && args[index + 1]) {
      days = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--reason' && args[index + 1]) {
      reason = parseReason(args[index + 1]);
      index += 1;
    } else if (arg === '--audit-id' && args[index + 1]) {
      auditId = args[index + 1];
      index += 1;
    }
  }

  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    throw new Error('--days must be a number between 1 and 365.');
  }

  if (applyDeprioritize && !deprioritize) {
    throw new Error('--apply-deprioritize requires --deprioritize.');
  }

  if (deprioritize && ids.length === 0) {
    throw new Error('--deprioritize requires --ids id1,id2.');
  }

  return {
    projectId,
    applyTier1,
    deprioritize,
    applyDeprioritize,
    ids,
    days,
    reason,
    auditId,
  };
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

const initializeAdmin = (projectId?: string) => {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  }
};

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getCharTrigrams = (normalizedText: string): Set<string> => {
  const compact = normalizedText.replace(/\s+/g, ' ');
  if (compact.length <= 3) {
    return compact ? new Set([compact]) : new Set();
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

const trigramSimilarityScore = (firstText: string, secondText: string): number => {
  const firstNormalized = normalizeText(firstText);
  const secondNormalized = normalizeText(secondText);

  if (!firstNormalized || !secondNormalized) {
    return 0;
  }

  if (firstNormalized === secondNormalized) {
    return 1;
  }

  return jaccard(getCharTrigrams(firstNormalized), getCharTrigrams(secondNormalized));
};

const readFirestoreDate = (value: unknown): { ms: number; label: string } => {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    const date = value.toDate() as Date;
    return { ms: date.getTime(), label: date.toISOString() };
  }

  return { ms: Number.MAX_SAFE_INTEGER, label: 'unknown' };
};

const fetchApprovedTakes = async (projectId?: string): Promise<CorpusTake[]> => {
  initializeAdmin(projectId);

  const snapshot = await getFirestore()
    .collection('takes')
    .where('isApproved', '==', true)
    .select('text', 'category', 'totalVotes', 'isAIGenerated', 'createdAt', 'approvedAt', 'status')
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const created = readFirestoreDate(data.createdAt ?? data.approvedAt);

      return {
        id: doc.id,
        text: typeof data.text === 'string' ? data.text : '',
        category: typeof data.category === 'string' ? data.category : 'unknown',
        totalVotes: typeof data.totalVotes === 'number' ? data.totalVotes : 0,
        isAIGenerated: data.isAIGenerated === true,
        createdAtMs: created.ms,
        createdAtLabel: created.label,
        isApproved: data.isApproved === true,
        status: typeof data.status === 'string' ? data.status : undefined,
      };
    })
    .filter((take) => take.text.trim().length > 0);
};

const fetchTakesByIds = async (projectId: string | undefined, ids: string[]): Promise<CorpusTake[]> => {
  initializeAdmin(projectId);

  const db = getFirestore();
  const uniqueIds = Array.from(new Set(ids));
  const takes: CorpusTake[] = [];

  for (const takeId of uniqueIds) {
    const snapshot = await db.collection('takes').doc(takeId).get();
    if (!snapshot.exists) {
      console.warn(`Missing take ID: ${takeId}`);
      continue;
    }

    const data = snapshot.data() ?? {};
    const created = readFirestoreDate(data.createdAt ?? data.approvedAt);
    takes.push({
      id: snapshot.id,
      text: typeof data.text === 'string' ? data.text : '',
      category: typeof data.category === 'string' ? data.category : 'unknown',
      totalVotes: typeof data.totalVotes === 'number' ? data.totalVotes : 0,
      isAIGenerated: data.isAIGenerated === true,
      createdAtMs: created.ms,
      createdAtLabel: created.label,
      isApproved: data.isApproved === true,
      status: typeof data.status === 'string' ? data.status : undefined,
    });
  }

  return takes;
};

const chooseAIKeeper = (takes: CorpusTake[]): CorpusTake => {
  const sorted = [...takes].sort((first, second) => {
    if (second.totalVotes !== first.totalVotes) {
      return second.totalVotes - first.totalVotes;
    }

    return first.createdAtMs - second.createdAtMs;
  });

  return sorted[0];
};

const buildDuplicateCandidates = (takes: CorpusTake[]): Tier1Candidate[] => {
  const candidates = new Map<string, Tier1Candidate>();
  const byCategory = new Map<string, CorpusTake[]>();

  takes.forEach((take) => {
    byCategory.set(take.category, [...(byCategory.get(take.category) ?? []), take]);
  });

  byCategory.forEach((categoryTakes) => {
    const unionFind = new UnionFind(categoryTakes.length);
    const strongestMatch = new Map<string, { matchedId: string; similarity: number }>();

    for (let first = 0; first < categoryTakes.length; first += 1) {
      for (let second = first + 1; second < categoryTakes.length; second += 1) {
        const firstTake = categoryTakes[first];
        const secondTake = categoryTakes[second];
        const score = trigramSimilarityScore(firstTake.text, secondTake.text);

        if (score < EXACT_DUPLICATE_THRESHOLD) {
          continue;
        }

        unionFind.union(first, second);
        [
          { take: firstTake, matched: secondTake },
          { take: secondTake, matched: firstTake },
        ].forEach(({ take, matched }) => {
          const existing = strongestMatch.get(take.id);
          if (!existing || existing.similarity < score) {
            strongestMatch.set(take.id, {
              matchedId: matched.id,
              similarity: Math.round(score * 1000) / 1000,
            });
          }
        });
      }
    }

    const grouped = new Map<number, CorpusTake[]>();
    categoryTakes.forEach((take, index) => {
      const root = unionFind.find(index);
      grouped.set(root, [...(grouped.get(root) ?? []), take]);
    });

    grouped.forEach((group) => {
      if (group.length < 2) {
        return;
      }

      const aiTakes = group.filter((take) => take.isAIGenerated);
      if (aiTakes.length === 0) {
        return;
      }

      const hasHumanTake = group.some((take) => !take.isAIGenerated);
      const removals = hasHumanTake
        ? aiTakes
        : aiTakes.filter((take) => take.id !== chooseAIKeeper(aiTakes).id);

      removals.forEach((take) => {
        const match = strongestMatch.get(take.id);
        candidates.set(take.id, {
          id: take.id,
          text: take.text,
          category: take.category,
          reason: hasHumanTake
            ? 'AI-generated duplicate of human-generated content'
            : 'AI-generated exact/high-similarity duplicate',
          matchedId: match?.matchedId,
          similarity: match?.similarity,
        });
      });
    });
  });

  return Array.from(candidates.values()).sort(
    (first, second) => first.category.localeCompare(second.category) || first.id.localeCompare(second.id)
  );
};

const buildTier1Candidates = (takes: CorpusTake[]): Tier1Candidate[] => {
  const candidates = new Map<string, Tier1Candidate>();

  buildDuplicateCandidates(takes).forEach((candidate) => {
    candidates.set(candidate.id, candidate);
  });

  takes
    .filter((take) => take.isAIGenerated && take.text.includes(';'))
    .forEach((take) => {
      candidates.set(take.id, {
        id: take.id,
        text: take.text,
        category: take.category,
        reason: 'AI-generated take contains a semicolon',
      });
    });

  takes
    .filter((take) => take.isAIGenerated && !validCategories.has(take.category))
    .forEach((take) => {
      candidates.set(take.id, {
        id: take.id,
        text: take.text,
        category: take.category,
        reason: `AI-generated take has invalid category "${take.category}"`,
      });
    });

  return Array.from(candidates.values()).sort(
    (first, second) => first.category.localeCompare(second.category) || first.id.localeCompare(second.id)
  );
};

const buildDeprioritizationCandidates = async (
  projectId: string | undefined,
  ids: string[],
  days: number,
  reason: DeprioritizedReason
): Promise<DeprioritizationCandidate[]> => {
  const takes = await fetchTakesByIds(projectId, ids);
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return takes
    .filter((take) => {
      if (!take.isAIGenerated) {
        console.warn(`Skipping human-generated take: ${take.id}`);
        return false;
      }

      if (!take.isApproved || take.status === 'rejected') {
        console.warn(`Skipping non-approved take: ${take.id}`);
        return false;
      }

      return true;
    })
    .map((take) => ({
      id: take.id,
      text: take.text,
      category: take.category,
      reason,
      until,
    }));
};

const printTier1Candidates = (candidates: Tier1Candidate[], apply: boolean) => {
  console.log(`\nTier 1 AI cleanup ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No Tier 1 AI cleanup candidates found.');
    return;
  }

  let currentCategory = '';
  candidates.forEach((candidate) => {
    if (candidate.category !== currentCategory) {
      currentCategory = candidate.category;
      console.log(`\n## ${currentCategory}`);
    }

    const similarity = candidate.similarity === undefined ? '' : ` | similarity ${candidate.similarity}`;
    const matched = candidate.matchedId ? ` | matched ${candidate.matchedId}` : '';
    console.log(`SOFT-DELETE ${candidate.id}${similarity}${matched}`);
    console.log(`  Reason: Removed by corpus audit: ${candidate.reason}`);
    console.log(`  "${candidate.text}"`);
  });
};

const printDeprioritizationCandidates = (
  candidates: DeprioritizationCandidate[],
  days: number,
  apply: boolean
) => {
  console.log(`\nTier 2 AI deprioritization ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Candidates: ${candidates.length}`);
  console.log(`Duration: ${days} day${days === 1 ? '' : 's'}`);

  if (candidates.length === 0) {
    console.log('No reviewed AI takes eligible for deprioritization.');
    return;
  }

  candidates.forEach((candidate) => {
    console.log(`DEPRIORITIZE ${candidate.id} [${candidate.category}] until ${candidate.until.toISOString()}`);
    console.log(`  Reason: ${candidate.reason}`);
    console.log(`  "${candidate.text}"`);
  });
};

const applyTier1SoftDeletes = async (candidates: Tier1Candidate[]) => {
  const db = getFirestore();

  for (let index = 0; index < candidates.length; index += APPLY_BATCH_SIZE) {
    const batch = db.batch();
    const batchCandidates = candidates.slice(index, index + APPLY_BATCH_SIZE);

    batchCandidates.forEach((candidate) => {
      batch.update(db.collection('takes').doc(candidate.id), {
        isApproved: false,
        status: 'rejected',
        rejectedAt: FieldValue.serverTimestamp(),
        rejectionReason: `Removed by corpus audit: ${candidate.reason}`,
      });
    });

    await batch.commit();
    console.log(`Soft-deleted ${Math.min(index + batchCandidates.length, candidates.length)}/${candidates.length}`);
  }
};

const applyDeprioritization = async (
  candidates: DeprioritizationCandidate[],
  auditId?: string
) => {
  const db = getFirestore();

  for (let index = 0; index < candidates.length; index += APPLY_BATCH_SIZE) {
    const batch = db.batch();
    const batchCandidates = candidates.slice(index, index + APPLY_BATCH_SIZE);

    batchCandidates.forEach((candidate) => {
      batch.update(db.collection('takes').doc(candidate.id), {
        deprioritized: true,
        deprioritizedReason: candidate.reason,
        deprioritizedAt: FieldValue.serverTimestamp(),
        deprioritizedUntil: Timestamp.fromDate(candidate.until),
        ...(auditId ? { deprioritizedAuditId: auditId } : {}),
      });
    });

    await batch.commit();
    console.log(`Deprioritized ${Math.min(index + batchCandidates.length, candidates.length)}/${candidates.length}`);
  }
};

const main = async () => {
  const args = parseArgs();
  const projectId = resolveProjectId(args.projectId);

  if (args.deprioritize) {
    const candidates = await buildDeprioritizationCandidates(
      projectId,
      args.ids,
      args.days,
      args.reason
    );

    printDeprioritizationCandidates(candidates, args.days, args.applyDeprioritize);

    if (!args.applyDeprioritize) {
      console.log('\nDry-run only. Review this output before rerunning with --apply-deprioritize.');
      return;
    }

    await applyDeprioritization(candidates, args.auditId);
    return;
  }

  const takes = await fetchApprovedTakes(projectId);
  const candidates = buildTier1Candidates(takes);
  printTier1Candidates(candidates, args.applyTier1);

  if (!args.applyTier1) {
    console.log('\nDry-run only. Review this output before rerunning with --apply-tier1.');
    return;
  }

  await applyTier1SoftDeletes(candidates);
};

main().catch((error) => {
  console.error('Corpus hygiene failed:', error);
  process.exitCode = 1;
});
