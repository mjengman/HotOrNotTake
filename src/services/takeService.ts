import {
  collection,
  documentId,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  increment,
  startAfter,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Take, TakeSubmission, TakeStatus } from '../types/Take';

// Collection references
const TAKES_COLLECTION = 'takes';
const SUBMIT_TAKE_URL = 'https://us-central1-hot-or-not-takes.cloudfunctions.net/submitTake';
const GENERATE_TAKES_URL = 'https://us-central1-hot-or-not-takes.cloudfunctions.net/generateTakes';

interface SubmitTakeResponse {
  takeId: string;
  status: TakeStatus;
  reason?: string;
}

interface GenerateTakesResponse {
  requestedCategory: string;
  category: string;
  generatedCount: number;
  addedCount: number;
  takeIds?: string[];
}

const callSubmitTakeFunction = async (data: {
  text: string;
  category: string;
}): Promise<SubmitTakeResponse> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('User must be signed in to submit takes');
  }

  const response = await fetch(SUBMIT_TAKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Auth': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    const error = new Error(
      body.error?.message || 'Failed to submit take'
    ) as Error & { status?: string };
    error.status = body.error?.status;
    throw error;
  }

  if (!body.result?.takeId || !body.result?.status) {
    throw new Error('Moderation service returned an invalid response');
  }

  return body.result as SubmitTakeResponse;
};

export const requestGeneratedTakes = async (category: string): Promise<GenerateTakesResponse> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('User must be signed in to generate takes');
  }

  const response = await fetch(GENERATE_TAKES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Auth': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      data: {
        category: category || 'all',
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || 'Failed to generate takes');
  }

  if (typeof body.result?.addedCount !== 'number') {
    throw new Error('Generation service returned an invalid response');
  }

  return body.result as GenerateTakesResponse;
};

// Convert Firestore timestamp to Date
const convertTimestampToDate = (timestamp: any): Date => {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return new Date(timestamp);
};

// Convert Take from Firestore format to app format
const convertFirestoreTake = (id: string, data: any): Take => ({
  id,
  text: data.text,
  category: data.category,
  hotVotes: data.hotVotes || 0,
  notVotes: data.notVotes || 0,
  totalVotes: data.totalVotes || 0,
  hotPercentage: typeof data.hotPercentage === 'number' ? data.hotPercentage : undefined,
  notPercentage: typeof data.notPercentage === 'number' ? data.notPercentage : undefined,
  createdAt: convertTimestampToDate(data.createdAt),
  userId: data.userId,
  isApproved: data.isApproved || false, // Backward compatibility
  status: data.status || (data.isApproved ? 'approved' : 'pending'), // Migrate old data
  submittedAt: convertTimestampToDate(data.submittedAt || data.createdAt),
  approvedAt: data.approvedAt ? convertTimestampToDate(data.approvedAt) : undefined,
  rejectedAt: data.rejectedAt ? convertTimestampToDate(data.rejectedAt) : undefined,
  rejectionReason: data.rejectionReason,
  reportCount: data.reportCount || 0,
  isAIGenerated: data.isAIGenerated || false, // AI flag
});

const isPermissionDeniedError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'permission-denied';

const calculateVotePercentages = (hotVotes: number, notVotes: number) => {
  const totalVotes = hotVotes + notVotes;

  if (totalVotes <= 0) {
    return {
      hotPercentage: 50,
      notPercentage: 50,
    };
  }

  const hotPercentage = Math.round((hotVotes / totalVotes) * 100);
  return {
    hotPercentage,
    notPercentage: 100 - hotPercentage,
  };
};

const updateTakeVotesLegacy = async (
  takeId: string,
  voteType: 'hot' | 'not'
): Promise<void> => {
  const takeRef = doc(db, TAKES_COLLECTION, takeId);
  await updateDoc(takeRef, {
    totalVotes: increment(1),
    ...(voteType === 'hot'
      ? { hotVotes: increment(1) }
      : { notVotes: increment(1) }),
  });
};

const decrementTakeVotesLegacy = async (
  takeId: string,
  voteType: 'hot' | 'not'
): Promise<void> => {
  const takeRef = doc(db, TAKES_COLLECTION, takeId);
  await updateDoc(takeRef, {
    totalVotes: increment(-1),
    ...(voteType === 'hot'
      ? { hotVotes: increment(-1) }
      : { notVotes: increment(-1) }),
  });
};

// Get database statistics (only approved takes due to security rules)
export const getDatabaseStats = async (): Promise<{
  total: number;
  approved: number;
  byCategory: { [category: string]: number };
  aiGenerated: number;
  userGenerated: number;
}> => {
  // Only query approved takes since security rules limit access
  const takesRef = collection(db, TAKES_COLLECTION);
  const approvedQuery = query(
    takesRef,
    where('isApproved', '==', true)
  );
  const snapshot = await getDocs(approvedQuery);
  
  let total = 0;
  let approved = 0;
  let aiGenerated = 0;
  let userGenerated = 0;
  
  // Initialize all categories to 0 to show complete picture
  const allCategories = [
    'food', 'work', 'pets', 'technology', 'life', 'entertainment', 
    'environment', 'wellness', 'society', 'politics', 'sports', 'travel', 'relationships'
  ];
  const byCategory: { [category: string]: number } = {};
  allCategories.forEach(cat => byCategory[cat] = 0);
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    total++;
    approved++; // All queried takes are approved
    
    // Track AI vs user generated content instead of embeddings
    if (data.isAIGenerated) {
      aiGenerated++;
    } else {
      userGenerated++;
    }
    
    const category = data.category || 'unknown';
    byCategory[category] = (byCategory[category] || 0) + 1;
  });
  
  return {
    total, // This is actually just approved count due to security rules
    approved,
    byCategory,
    aiGenerated,
    userGenerated
  };
};

// Get all approved takes
export const getApprovedTakes = async (): Promise<Take[]> => {
  try {
    const takesQuery = query(
      collection(db, TAKES_COLLECTION),
      where('isApproved', '==', true),
      orderBy('createdAt', 'desc'),
      limit(50) // Limit to 50 most recent takes
    );
    
    const snapshot = await getDocs(takesQuery);
    return snapshot.docs.map(doc => convertFirestoreTake(doc.id, doc.data()));
  } catch (error) {
    console.error('Error fetching takes:', error);
    throw new Error('Failed to load takes');
  }
};

export const getTakeById = async (takeId: string): Promise<Take | null> => {
  try {
    const takeSnapshot = await getDoc(doc(db, TAKES_COLLECTION, takeId));
    if (!takeSnapshot.exists()) {
      return null;
    }

    const data = takeSnapshot.data();
    if (data.isApproved !== true && data.status !== 'approved') {
      return null;
    }

    return convertFirestoreTake(takeSnapshot.id, data);
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.warn('Unable to fetch take by ID:', error);
    }
    return null;
  }
};

const chunkIds = (ids: string[], size: number) => {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
};

export const getTakesByIds = async (takeIds: string[]): Promise<Record<string, Take>> => {
  const uniqueIds = Array.from(new Set(takeIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return {};
  }

  try {
    const hydratedTakes: Record<string, Take> = {};
    const idChunks = chunkIds(uniqueIds, 10);

    for (const idChunk of idChunks) {
      const takesQuery = query(
        collection(db, TAKES_COLLECTION),
        where('isApproved', '==', true),
        where(documentId(), 'in', idChunk)
      );
      const snapshot = await getDocs(takesQuery);

      snapshot.docs.forEach((takeDoc) => {
        const data = takeDoc.data();
        if (data.isApproved !== true && data.status !== 'approved') {
          return;
        }

        hydratedTakes[takeDoc.id] = convertFirestoreTake(takeDoc.id, data);
      });
    }

    return hydratedTakes;
  } catch (error) {
    console.warn('Batch take hydration unavailable, falling back to single reads:', error);

    const fallbackResults = await Promise.all(
      uniqueIds.map(async (takeId) => {
        const take = await getTakeById(takeId);
        return take ? [takeId, take] as const : null;
      })
    );

    return fallbackResults.reduce<Record<string, Take>>((acc, item) => {
      if (item) {
        acc[item[0]] = item[1];
      }
      return acc;
    }, {});
  }
};

// Listen to real-time updates for approved takes
export const subscribeToApprovedTakes = (callback: (takes: Take[]) => void) => {
  const takesQuery = query(
    collection(db, TAKES_COLLECTION),
    where('isApproved', '==', true),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    takesQuery,
    (snapshot) => {
      const takes = snapshot.docs.map(doc => 
        convertFirestoreTake(doc.id, doc.data())
      );
      callback(takes);
    },
    (error) => {
      console.error('Error in takes subscription:', error);
    }
  );
};

// Submit a new take
export const submitTake = async (
  takeData: TakeSubmission,
  userId: string,
  isAIGenerated: boolean = false
): Promise<string> => {
  try {
    if (isAIGenerated) {
      throw new Error('AI content generation is disabled in client builds');
    }

    // userId is still accepted by this public API, but the Cloud Function trusts
    // only Firebase Auth context and ignores client-provided identity.
    void userId;

    const result = await callSubmitTakeFunction({
      text: takeData.text.trim(),
      category: takeData.category,
    });

    if (result.status === 'pending') {
      console.log(`🕒 Take submitted for moderation review: ${result.takeId}`);
    } else {
      console.log(`✅ Take approved by server moderation: ${result.takeId}`);
    }

    return result.takeId;
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? String((error as { status?: unknown }).status)
        : '';
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to submit take';

    console.error('Failed to submit take:', error);

    if (status === 'FAILED_PRECONDITION') {
      throw new Error(`Take rejected: ${message}`);
    }

    throw new Error(message);
  }
};

// Update vote counts for a take
export const updateTakeVotes = async (
  takeId: string,
  voteType: 'hot' | 'not'
): Promise<void> => {
  try {
    const takeRef = doc(db, TAKES_COLLECTION, takeId);

    await runTransaction(db, async (transaction) => {
      const takeSnap = await transaction.get(takeRef);
      if (!takeSnap.exists()) {
        throw new Error('Take not found');
      }

      const data = takeSnap.data();
      const hotVotes = (data.hotVotes || 0) + (voteType === 'hot' ? 1 : 0);
      const notVotes = (data.notVotes || 0) + (voteType === 'not' ? 1 : 0);
      const totalVotes = hotVotes + notVotes;
      const percentages = calculateVotePercentages(hotVotes, notVotes);

      transaction.update(takeRef, {
        hotVotes,
        notVotes,
        totalVotes,
        ...percentages,
      });
    });
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn('Vote percentage update blocked by current Firestore rules; using legacy vote count update.');
      await updateTakeVotesLegacy(takeId, voteType);
      return;
    }

    console.error('Error updating take votes:', error);
    throw new Error('Failed to update vote');
  }
};

export const decrementTakeVotes = async (
  takeId: string,
  voteType: 'hot' | 'not'
): Promise<void> => {
  try {
    const takeRef = doc(db, TAKES_COLLECTION, takeId);

    await runTransaction(db, async (transaction) => {
      const takeSnap = await transaction.get(takeRef);
      if (!takeSnap.exists()) {
        return;
      }

      const data = takeSnap.data();
      const hotVotes = Math.max(0, (data.hotVotes || 0) - (voteType === 'hot' ? 1 : 0));
      const notVotes = Math.max(0, (data.notVotes || 0) - (voteType === 'not' ? 1 : 0));
      const totalVotes = hotVotes + notVotes;
      const percentages = calculateVotePercentages(hotVotes, notVotes);

      transaction.update(takeRef, {
        hotVotes,
        notVotes,
        totalVotes,
        ...percentages,
      });
    });
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn('Vote percentage decrement blocked by current Firestore rules; using legacy vote count update.');
      await decrementTakeVotesLegacy(takeId, voteType);
      return;
    }

    console.error('Error decrementing take votes:', error);
    throw new Error('Failed to update vote');
  }
};

// Report a take (for moderation)
export const reportTake = async (takeId: string): Promise<void> => {
  try {
    const takeRef = doc(db, TAKES_COLLECTION, takeId);
    await updateDoc(takeRef, {
      reportCount: increment(1),
    });
  } catch (error) {
    console.error('Error reporting take:', error);
    throw new Error('Failed to report take');
  }
};

// Admin function to approve a take
export const approveTake = async (takeId: string): Promise<void> => {
  try {
    const takeRef = doc(db, TAKES_COLLECTION, takeId);
    await updateDoc(takeRef, {
      isApproved: true,
    });
  } catch (error) {
    console.error('Error approving take:', error);
    throw new Error('Failed to approve take');
  }
};

// Get takes by category
export const getTakesByCategory = async (category: string): Promise<Take[]> => {
  try {
    const takesQuery = query(
      collection(db, TAKES_COLLECTION),
      where('isApproved', '==', true),
      where('category', '==', category.toLowerCase()),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(takesQuery);
    return snapshot.docs.map(doc => convertFirestoreTake(doc.id, doc.data()));
  } catch (error) {
    console.error('Error fetching takes by category:', error);
    throw new Error('Failed to load takes by category');
  }
};

// Get user's submitted takes (excluding AI-generated content)
export const getUserSubmittedTakes = async (userId: string): Promise<Take[]> => {
  try {
    // Get all takes by the user
    const takesQuery = query(
      collection(db, TAKES_COLLECTION),
      where('userId', '==', userId),
      orderBy('submittedAt', 'desc'),
      limit(50) // Limit to 50 most recent submissions
    );
    
    const snapshot = await getDocs(takesQuery);
    const allUserTakes = snapshot.docs.map(doc => convertFirestoreTake(doc.id, doc.data()));
    
    // Filter out AI-generated takes in memory (to handle missing field)
    const userSubmittedTakes = allUserTakes.filter(take => !take.isAIGenerated);
    
    return userSubmittedTakes;
  } catch (error) {
    console.error('Error fetching user takes:', error);
    throw new Error('Failed to load your takes');
  }
};

// Delete a take (only by the original author)
export const deleteTake = async (takeId: string, userId: string): Promise<void> => {
  try {
    // Delete the take document - Firebase security rules will ensure
    // only the original author can delete their own takes
    const takeRef = doc(db, TAKES_COLLECTION, takeId);
    await deleteDoc(takeRef);
    
    // TODO: Consider cleaning up associated votes and skips
    // For now we'll leave them for analytics purposes
    
  } catch (error) {
    console.error('Error deleting take:', error);
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;

    if (errorCode === 'permission-denied') {
      throw new Error('You do not have permission to delete this take');
    }
    throw new Error('Failed to delete take');
  }
};

// Skip a take (record the skip for analytics)
export const skipTake = async (takeId: string, userId: string): Promise<void> => {
  try {
    const now = new Date();
    
    const skipData = {
      takeId,
      userId,
      skippedAt: Timestamp.fromDate(now),
    };
    
    await addDoc(collection(db, 'skips'), skipData);
  } catch (error) {
    console.error('Error recording skip:', error);
    // Don't throw for skips - they're analytics only
  }
};

// Get takes user has already interacted with (voted or skipped)
export const getUserInteractedTakeIds = async (userId: string): Promise<string[]> => {
  try {
    const [votesSnapshot, skipsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'votes'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'skips'), where('userId', '==', userId))),
    ]);

    const votedTakeIds = votesSnapshot.docs.map(doc => doc.data().takeId);
    const skippedTakeIds = skipsSnapshot.docs.map(doc => doc.data().takeId);

    // Return unique take IDs
    return [...new Set([...votedTakeIds, ...skippedTakeIds])];
  } catch (error) {
    console.error('Error fetching user interactions:', error);
    throw new Error('Failed to load user interactions');
  }
};

// Get takes user has voted on vs skipped (separate lists)
export const getUserVotedAndSkippedTakeIds = async (userId: string): Promise<{
  voted: string[];
  skipped: string[];
}> => {
  try {
    const [votesSnapshot, skipsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'votes'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'skips'), where('userId', '==', userId))),
    ]);

    const voted = votesSnapshot.docs.map(doc => doc.data().takeId);
    const skipped = skipsSnapshot.docs.map(doc => doc.data().takeId);

    return { voted, skipped };
  } catch (error) {
    console.error('Error fetching user interactions:', error);
    throw new Error('Failed to load user interactions');
  }
};

export const getUserSkippedTakes = async (
  userId: string,
  maxCount: number = 60
): Promise<Take[]> => {
  try {
    const [votesSnapshot, skipsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'votes'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'skips'), where('userId', '==', userId))),
    ]);

    const votedIds = new Set(votesSnapshot.docs.map(doc => doc.data().takeId));
    const skipRecords = skipsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          takeId: data.takeId as string | undefined,
          skippedAt: data.skippedAt?.toDate?.() instanceof Date
            ? data.skippedAt.toDate() as Date
            : new Date(data.skippedAt || 0),
        };
      })
      .filter((record): record is { takeId: string; skippedAt: Date } =>
        typeof record.takeId === 'string' &&
        record.takeId.length > 0 &&
        !votedIds.has(record.takeId)
      )
      .sort((a, b) => b.skippedAt.getTime() - a.skippedAt.getTime());

    const uniqueSkippedIds: string[] = [];
    const seenIds = new Set<string>();
    skipRecords.forEach((record) => {
      if (!seenIds.has(record.takeId)) {
        seenIds.add(record.takeId);
        uniqueSkippedIds.push(record.takeId);
      }
    });

    const skippedTakes = await Promise.all(
      uniqueSkippedIds.slice(0, maxCount).map(async (takeId) => {
        try {
          const takeSnapshot = await getDoc(doc(db, TAKES_COLLECTION, takeId));
          if (!takeSnapshot.exists()) {
            return null;
          }

          const data = takeSnapshot.data();
          if (data.isApproved !== true && data.status !== 'approved') {
            return null;
          }

          return convertFirestoreTake(takeSnapshot.id, data);
        } catch {
          return null;
        }
      })
    );

    return skippedTakes.filter((take): take is Take => take !== null);
  } catch (error) {
    console.error('Error fetching skipped takes:', error);
    return [];
  }
};

// Leaderboard: Get hottest takes (most HOT votes) by category
export const getHottestTakesByCategory = async (): Promise<Record<string, Take[]>> => {
  try {
    const takesQuery = query(
      collection(db, TAKES_COLLECTION),
      where('isApproved', '==', true),
      where('hotVotes', '>', 0),
      orderBy('hotVotes', 'desc'),
      limit(100) // Get top 100 to group by category
    );
    
    const snapshot = await getDocs(takesQuery);
    const takes = snapshot.docs.map(doc => convertFirestoreTake(doc.id, doc.data()));
    
    // Group by category and take top 3 from each
    const byCategory: Record<string, Take[]> = {};
    takes.forEach(take => {
      if (!byCategory[take.category]) {
        byCategory[take.category] = [];
      }
      if (byCategory[take.category].length < 3) {
        byCategory[take.category].push(take);
      }
    });
    
    return byCategory;
  } catch (error) {
    console.error('Error fetching hottest takes:', error);
    throw new Error('Failed to load hottest takes');
  }
};

// Leaderboard: Get "nottest" takes (most NOT votes) by category
export const getNottestTakesByCategory = async (): Promise<Record<string, Take[]>> => {
  try {
    const takesQuery = query(
      collection(db, TAKES_COLLECTION),
      where('isApproved', '==', true),
      where('notVotes', '>', 0),
      orderBy('notVotes', 'desc'),
      limit(100) // Get top 100 to group by category
    );
    
    const snapshot = await getDocs(takesQuery);
    const takes = snapshot.docs.map(doc => convertFirestoreTake(doc.id, doc.data()));
    
    // Group by category and take top 3 from each
    const byCategory: Record<string, Take[]> = {};
    takes.forEach(take => {
      if (!byCategory[take.category]) {
        byCategory[take.category] = [];
      }
      if (byCategory[take.category].length < 3) {
        byCategory[take.category].push(take);
      }
    });
    
    return byCategory;
  } catch (error) {
    console.error('Error fetching nottest takes:', error);
    throw new Error('Failed to load nottest takes');
  }
};

export const getMostDivisiveTakesByCategory = async (): Promise<Record<string, Take[]>> => {
  const isDivisiveTake = (take: Take) => {
    if (take.totalVotes <= 0) {
      return false;
    }

    const hotPercentage =
      typeof take.hotPercentage === 'number'
        ? take.hotPercentage
        : Math.round((take.hotVotes / take.totalVotes) * 100);

    return hotPercentage >= 40 && hotPercentage <= 60;
  };

  try {
    // Use a simple approved-takes query and compute divisiveness client-side.
    // This avoids missing-index failures while percentage fields populate over time.
    const divisiveQuery = query(
      collection(db, TAKES_COLLECTION),
      where('isApproved', '==', true),
      limit(250)
    );

    const snapshot = await getDocs(divisiveQuery);
    const divisiveTakes = snapshot.docs
      .map(doc => convertFirestoreTake(doc.id, doc.data()))
      .filter(isDivisiveTake)
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, 20);

    const byCategory: Record<string, Take[]> = {};
    divisiveTakes.forEach(take => {
      if (!byCategory[take.category]) {
        byCategory[take.category] = [];
      }
      byCategory[take.category].push(take);
    });

    return byCategory;
  } catch (error) {
    console.error('Error fetching divisive takes:', error);
    return {};
  }
};

// Leaderboard: Get most skipped takes by category
export const getMostSkippedTakesByCategory = async (): Promise<Record<string, { take: Take; skipCount: number }[]>> => {
  try {
    const skipsSnapshot = await getDocs(collection(db, 'skips'));
    
    if (skipsSnapshot.empty) {
      return {};
    }
    
    const skips = skipsSnapshot.docs.map(doc => doc.data());
    
    // Count skips per take
    const skipCounts: Record<string, number> = {};
    skips.forEach(skip => {
      skipCounts[skip.takeId] = (skipCounts[skip.takeId] || 0) + 1;
    });
    
    // Get the most skipped take IDs
    const sortedTakeIds = Object.entries(skipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30) // Reduced to 30 for efficiency
      .map(([takeId]) => takeId);
    
    if (sortedTakeIds.length === 0) {
      return {};
    }
    
    const skippedTakeResults = await Promise.all(
      sortedTakeIds.map(async (takeId) => {
        try {
          const takeSnapshot = await getDoc(doc(db, TAKES_COLLECTION, takeId));

          if (!takeSnapshot.exists()) {
            return null;
          }

          const data = takeSnapshot.data();
          if (data.isApproved !== true && data.status !== 'approved') {
            return null;
          }

          return {
            take: convertFirestoreTake(takeSnapshot.id, data),
            skipCount: skipCounts[takeSnapshot.id],
          };
        } catch {
          return null;
        }
      })
    );

    const allTakesWithSkips = skippedTakeResults.filter(
      (item): item is { take: Take; skipCount: number } => item !== null
    );
    
    // Sort by skip count again (since batches might be out of order)
    allTakesWithSkips.sort((a, b) => b.skipCount - a.skipCount);
    
    // Group by category and take top 3 from each
    const byCategory: Record<string, { take: Take; skipCount: number }[]> = {};
    allTakesWithSkips.forEach(item => {
      const category = item.take.category;
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      if (byCategory[category].length < 3) {
        byCategory[category].push(item);
      }
    });
    
    return byCategory;
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.warn('Skipped leaderboard unavailable:', error);
    }
    return {};
  }
};

// Cursor management for pagination
const feedCursors: Record<string, any | null> = {};

export const resetFeedCursor = (category?: string) => {
  const key = category ? `category:${category.toLowerCase()}` : 'all';
  feedCursors[key] = null;
};

const setCursor = (key: string, docSnap: any) => {
  feedCursors[key] = docSnap;
};

const getCursor = (key: string) => {
  return feedCursors[key] || null;
};

// Paginated fetch that fills the list with non-interacted takes
export const fetchMoreTakesFilled = async ({
  category,
  targetCount = 30,
  pageSize = 50,
  interactedIds,
}: {
  category?: string;
  targetCount?: number;
  pageSize?: number;
  interactedIds: Set<string>;
}): Promise<{ items: Take[]; gotAny: boolean }> => {
  try {
    const cursorKey = category ? `category:${category.toLowerCase()}` : 'all';
    const results: Take[] = [];
    let keepGoing = true;
    let guardPages = 0; // Prevent infinite loops

    while (keepGoing && results.length < targetCount && guardPages < 10) {
      guardPages++;

      // Build base query
      let baseQuery;
      if (category && category !== 'all') {
        baseQuery = query(
          collection(db, TAKES_COLLECTION),
          where('isApproved', '==', true),
          where('category', '==', category.toLowerCase()),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      } else {
        baseQuery = query(
          collection(db, TAKES_COLLECTION),
          where('isApproved', '==', true),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      }

      // Add cursor if we have one
      const cursor = getCursor(cursorKey);
      const finalQuery = cursor ? query(baseQuery, startAfter(cursor)) : baseQuery;

      const snapshot = await getDocs(finalQuery);
      if (snapshot.empty) {
        // No more docs in this feed
        keepGoing = false;
        break;
      }

      // Update cursor to last doc of this page
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setCursor(cursorKey, lastDoc);

      // Convert & filter out interacted takes
      const pageTakes = snapshot.docs
        .map(doc => convertFirestoreTake(doc.id, doc.data()))
        .filter(take => !interactedIds.has(take.id));

      results.push(...pageTakes);

      // If page didn't add anything (because filtering removed all), loop again
      console.log(`📄 Page ${guardPages}: fetched ${snapshot.docs.length}, after filtering: +${pageTakes.length} (total: ${results.length}/${targetCount})`);
    }

    console.log(`✅ Pagination complete: ${results.length} takes found, guardPages: ${guardPages}`);
    
    // Shuffle the results to randomize order for each user
    const shuffledResults = [...results].sort(() => Math.random() - 0.5);
    
    return { 
      items: shuffledResults.slice(0, targetCount), 
      gotAny: shuffledResults.length > 0 
    };
  } catch (error) {
    console.error('Error in fetchMoreTakesFilled:', error);
    throw new Error('Failed to fetch more takes');
  }
};
