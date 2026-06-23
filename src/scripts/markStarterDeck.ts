/**
 * Mark hand-curated takes as starter deck entries.
 *
 * Dry run:
 *   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json npm run mark:starter -- --ids id1,id2,id3
 *
 * Apply:
 *   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json npm run mark:starter -- --ids id1,id2,id3 --apply
 */

import { existsSync, readFileSync } from 'fs';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

interface ParsedArgs {
  ids: string[];
  apply: boolean;
  projectId: string | null;
}

const parseIds = (rawIds?: string): string[] =>
  (rawIds ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);
  let ids: string[] = [];
  let apply = false;
  let projectId: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--ids' && args[index + 1]) {
      ids = parseIds(args[index + 1]);
      index += 1;
    } else if (arg === '--apply') {
      apply = true;
    } else if (arg === '--project' && args[index + 1]) {
      projectId = args[index + 1];
      index += 1;
    }
  }

  if (ids.length === 0) {
    throw new Error('--ids is required. Example: --ids id1,id2,id3');
  }

  return {
    ids: Array.from(new Set(ids)),
    apply,
    projectId,
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

const main = async () => {
  const { ids, apply, projectId: argProjectId } = parseArgs();
  const projectId = resolveProjectId(argProjectId);
  initializeAdmin(projectId);

  const db = getFirestore();
  const now = Timestamp.now();

  console.log('Starter deck marker');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Project: ${projectId ?? 'default credentials project'}`);
  console.log(`IDs: ${ids.length}`);

  const batch = db.batch();

  for (let index = 0; index < ids.length; index += 1) {
    const takeId = ids[index];
    const starterDeckRank = index + 1;
    const takeRef = db.collection('takes').doc(takeId);
    const snapshot = await takeRef.get();

    if (!snapshot.exists) {
      console.warn(`Missing take ID: ${takeId}`);
      continue;
    }

    const data = snapshot.data() ?? {};
    console.log(
      `${apply ? 'Marking' : 'Would mark'} ${takeId}: rank=${starterDeckRank}, ` +
        `category=${data.category ?? 'unknown'}, text="${data.text ?? ''}"`
    );

    if (apply) {
      batch.update(takeRef, {
        editorialTier: 'starter',
        featured: true,
        starterDeckRank,
        curatedAt: now,
      });
    }
  }

  if (apply) {
    await batch.commit();
    console.log('Starter deck updates applied.');
  } else {
    console.log('Dry run only. Re-run with --apply to write these starter deck fields.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
