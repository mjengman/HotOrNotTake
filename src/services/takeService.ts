import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { Take, TakeFirestore, TakeSubmission } from '../types/Take';

// Collection references
const TAKES_COLLECTION = 'takes';

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
  isAIGenerated: boolean = false,
  embedding?: number[]
): Promise<string> => {
  try {
    const now = new Date();
    const takeFirestore: TakeFirestore = {
      text: takeData.text.trim(),
      category: takeData.category.toLowerCase(),
      hotVotes: 0,
      notVotes: 0,
      totalVotes: 0,
      createdAt: now,
      submittedAt: now,
      userId,
      isApproved: true, // Auto-approve for development
      status: 'approved', // Auto-approve for development
      approvedAt: now, // Set approval timestamp
      reportCount: 0,
      isAIGenerated, // Flag for AI content
      embedding, // OpenAI embedding for semantic similarity (optional)
    };

    const docRef = await addDoc(collection(db, TAKES_COLLECTION), {
      ...takeFirestore,
      createdAt: Timestamp.fromDate(takeFirestore.createdAt),
      submittedAt: Timestamp.fromDate(takeFirestore.submittedAt),
      approvedAt: Timestamp.fromDate(takeFirestore.approvedAt!),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error submitting take:', error);
    throw new Error('Failed to submit take');
  }
};

// Update vote counts for a take
export const updateTakeVotes = async (
  takeId: string,
  voteType: 'hot' | 'not'
): Promise<void> => {
  try {
    const takeRef = doc(db, TAKES_COLLECTION, takeId);
    
    const updateData = {
      totalVotes: increment(1),
      ...(voteType === 'hot' 
        ? { hotVotes: increment(1) } 
        : { notVotes: increment(1) }
      ),
    };

    await updateDoc(takeRef, updateData);
  } catch (error) {
    console.error('Error updating take votes:', error);
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

// Skip a take (record the skip for analytics)
export const skipTake = async (takeId: string, userId: string): Promise<void> => {
  try {
    const now = new Date();
    await addDoc(collection(db, 'skips'), {
      takeId,
      userId,
      skippedAt: Timestamp.fromDate(now),
    });
  } catch (error) {
    console.error('Error recording skip:', error);
    throw new Error('Failed to record skip');
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

// Leaderboard: Get most skipped takes by category
export const getMostSkippedTakesByCategory = async (): Promise<Record<string, { take: Take; skipCount: number }[]>> => {
  try {
    // Get all skips (this should work now with updated permissions)
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
    
    // Get approved takes in batches (Firestore 'in' queries limited to 10)
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < sortedTakeIds.length; i += batchSize) {
      const batch = sortedTakeIds.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    const allTakesWithSkips: { take: Take; skipCount: number }[] = [];
    
    for (const batch of batches) {
      try {
        const takesQuery = query(
          collection(db, TAKES_COLLECTION),
          where('__name__', 'in', batch),
          where('isApproved', '==', true)
        );
        
        const snapshot = await getDocs(takesQuery);
        const batchTakes = snapshot.docs.map(doc => ({
          take: convertFirestoreTake(doc.id, doc.data()),
          skipCount: skipCounts[doc.id]
        }));
        
        allTakesWithSkips.push(...batchTakes);
      } catch (error) {
        console.error('Error fetching batch of takes:', error);
        // Continue with other batches
      }
    }
    
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
    console.error('Error fetching most skipped takes:', error);
    throw new Error('Failed to load most skipped takes');
  }
};