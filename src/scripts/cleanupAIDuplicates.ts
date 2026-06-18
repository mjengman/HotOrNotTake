/**
 * AI-generated duplicate cleanup for Hot or Not Takes.
 *
 * Setup:
 * 1. Create/download a Firebase Admin service account key locally.
 * 2. Do not commit the key.
 * 3. Dry-run:
 *    GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json npm run cleanup:ai-duplicates
 *
 * Apply, after reviewing dry-run output:
 *    GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json npm run cleanup:ai-duplicates -- --apply
 *
 * This script only targets approved AI-generated takes. It never hard-deletes.
 */

import { existsSync, readFileSync } from 'fs';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

interface AITake {
  id: string;
  text: string;
  category: string;
  totalVotes: number;
  createdAtMs: number;
  createdAtLabel: string;
}

interface RemovalCandidate {
  take: AITake;
  similarityToKeeper: number;
}

interface DuplicateCluster {
  category: string;
  keeper: AITake;
  removals: RemovalCandidate[];
  keeperReason: string;
}

const DEFAULT_CLEANUP_THRESHOLD = 0.82;
const REJECTION_REASON = 'Removed as duplicate AI-generated content';
const APPLY_BATCH_SIZE = 400;

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
  let apply = false;
  let threshold = DEFAULT_CLEANUP_THRESHOLD;
  let projectId: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--threshold' && args[index + 1]) {
      threshold = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--project' && args[index + 1]) {
      projectId = args[index + 1];
      index += 1;
    }
  }

  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error('--threshold must be a number between 0 and 1.');
  }

  return { apply, threshold, projectId };
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
  const first = normalizeText(firstText);
  const second = normalizeText(secondText);

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

const dateFromFirestoreValue = (value: unknown): { ms: number; label: string } => {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    const date = value.toDate() as Date;
    return {
      ms: date.getTime(),
      label: date.toISOString(),
    };
  }

  return {
    ms: Number.MAX_SAFE_INTEGER,
    label: 'unknown',
  };
};

const initializeAdmin = (projectId?: string) => {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  }
};

const fetchApprovedAITakes = async (projectId?: string): Promise<AITake[]> => {
  initializeAdmin(projectId);

  const db = getFirestore();
  const snapshot = await db
    .collection('takes')
    .where('isApproved', '==', true)
    .select('text', 'category', 'totalVotes', 'isAIGenerated', 'createdAt', 'approvedAt')
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const created = dateFromFirestoreValue(data.createdAt ?? data.approvedAt);

      return {
        id: doc.id,
        text: typeof data.text === 'string' ? data.text : '',
        category: typeof data.category === 'string' ? data.category : 'unknown',
        totalVotes: typeof data.totalVotes === 'number' ? data.totalVotes : 0,
        createdAtMs: created.ms,
        createdAtLabel: created.label,
        isAIGenerated: data.isAIGenerated === true,
      };
    })
    .filter((take) => take.isAIGenerated && take.text.trim().length > 0)
    .map(({ isAIGenerated: _isAIGenerated, ...take }) => take);
};

const chooseKeeper = (clusterTakes: AITake[]): { keeper: AITake; reason: string } => {
  const sorted = [...clusterTakes].sort((first, second) => {
    if (second.totalVotes !== first.totalVotes) {
      return second.totalVotes - first.totalVotes;
    }

    return first.createdAtMs - second.createdAtMs;
  });

  const keeper = sorted[0];
  const sameVoteCount = clusterTakes.filter((take) => take.totalVotes === keeper.totalVotes).length;
  const reason = sameVoteCount > 1
    ? `highest vote tie (${keeper.totalVotes}), older take wins`
    : `highest vote count (${keeper.totalVotes})`;

  return { keeper, reason };
};

const buildDuplicateClusters = (takes: AITake[], threshold: number): DuplicateCluster[] => {
  const clusters: DuplicateCluster[] = [];
  const takesByCategory = new Map<string, AITake[]>();

  takes.forEach((take) => {
    takesByCategory.set(take.category, [...(takesByCategory.get(take.category) ?? []), take]);
  });

  takesByCategory.forEach((categoryTakes, category) => {
    const unionFind = new UnionFind(categoryTakes.length);

    for (let first = 0; first < categoryTakes.length; first += 1) {
      for (let second = first + 1; second < categoryTakes.length; second += 1) {
        const score = getTakeSimilarity(categoryTakes[first].text, categoryTakes[second].text);
        if (score >= threshold) {
          unionFind.union(first, second);
        }
      }
    }

    const grouped = new Map<number, AITake[]>();
    categoryTakes.forEach((take, index) => {
      const root = unionFind.find(index);
      grouped.set(root, [...(grouped.get(root) ?? []), take]);
    });

    grouped.forEach((group) => {
      if (group.length < 2) {
        return;
      }

      const { keeper, reason } = chooseKeeper(group);
      const removals = group
        .filter((take) => take.id !== keeper.id)
        .map((take) => ({
          take,
          similarityToKeeper: getTakeSimilarity(keeper.text, take.text),
        }))
        .sort((first, second) => second.similarityToKeeper - first.similarityToKeeper);

      clusters.push({
        category,
        keeper,
        removals,
        keeperReason: reason,
      });
    });
  });

  return clusters.sort((first, second) => {
    const categoryCompare = first.category.localeCompare(second.category);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return second.removals.length - first.removals.length;
  });
};

const formatScore = (score: number): string => score.toFixed(3);

const printClusters = (clusters: DuplicateCluster[], threshold: number, apply: boolean) => {
  const removalCount = clusters.reduce((sum, cluster) => sum + cluster.removals.length, 0);
  console.log(`AI duplicate cleanup ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Threshold: ${threshold}`);
  console.log(`Clusters: ${clusters.length}`);
  console.log(`Proposed removals: ${removalCount}`);

  if (clusters.length === 0) {
    console.log('\nNo AI-generated duplicate clusters found.');
    return;
  }

  let currentCategory = '';
  clusters.forEach((cluster, index) => {
    if (cluster.category !== currentCategory) {
      currentCategory = cluster.category;
      console.log(`\n## ${currentCategory}`);
    }

    console.log(`\nCluster ${index + 1} (${cluster.removals.length} removal${cluster.removals.length === 1 ? '' : 's'})`);
    console.log(`KEEP   ${cluster.keeper.id} | ${cluster.keeper.totalVotes} votes | ${cluster.keeper.createdAtLabel}`);
    console.log(`       "${cluster.keeper.text}"`);
    console.log(`       Reason: ${cluster.keeperReason}`);

    cluster.removals.forEach(({ take, similarityToKeeper }) => {
      console.log(`REMOVE ${take.id} | ${take.totalVotes} votes | score ${formatScore(similarityToKeeper)} | ${take.createdAtLabel}`);
      console.log(`       "${take.text}"`);
    });
  });
};

const applySoftDeletes = async (clusters: DuplicateCluster[]) => {
  const db = getFirestore();
  const removals = clusters.flatMap((cluster) => cluster.removals.map((removal) => removal.take));

  for (let index = 0; index < removals.length; index += APPLY_BATCH_SIZE) {
    const batch = db.batch();
    const batchRemovals = removals.slice(index, index + APPLY_BATCH_SIZE);

    batchRemovals.forEach((take) => {
      batch.update(db.collection('takes').doc(take.id), {
        isApproved: false,
        status: 'rejected',
        rejectedAt: FieldValue.serverTimestamp(),
        rejectionReason: REJECTION_REASON,
      });
    });

    await batch.commit();
    console.log(`Soft-deleted ${Math.min(index + batchRemovals.length, removals.length)}/${removals.length}`);
  }
};

const main = async () => {
  const { apply, threshold, projectId: argProjectId } = parseArgs();
  const projectId = resolveProjectId(argProjectId);
  const takes = await fetchApprovedAITakes(projectId);
  const clusters = buildDuplicateClusters(takes, threshold);

  printClusters(clusters, threshold, apply);

  if (!apply) {
    console.log('\nDry-run only. Review this output before running with --apply.');
    return;
  }

  await applySoftDeletes(clusters);
};

main().catch((error) => {
  console.error('AI duplicate cleanup failed:', error);
  process.exitCode = 1;
});
