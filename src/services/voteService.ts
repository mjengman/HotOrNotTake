import {
  collection,
  doc,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { TakeVote, TakeVoteFirestore } from '../types/Take';
import { decrementTakeVotes, updateTakeVotes } from './takeService';

// Collection references
const VOTES_COLLECTION = 'votes';

export type VoteHistoryCursor = QueryDocumentSnapshot<DocumentData>;

export interface UserVotesPage {
  votes: TakeVote[];
  cursor: VoteHistoryCursor | null;
  hasMore: boolean;
}

const getLocalDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey: string): Date | null => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

const getDateKeyDistance = (olderDateKey: string, newerDateKey: string): number | null => {
  const olderDate = parseDateKey(olderDateKey);
  const newerDate = parseDateKey(newerDateKey);

  if (!olderDate || !newerDate) {
    return null;
  }

  return Math.round((newerDate.getTime() - olderDate.getTime()) / (1000 * 60 * 60 * 24));
};

// Convert Firestore vote to app format
const convertFirestoreVote = (id: string, data: any): TakeVote => ({
  id,
  takeId: data.takeId,
  userId: data.userId,
  vote: data.vote,
  votedAt: data.votedAt?.toDate() || new Date(data.votedAt),
  userAgent: data.userAgent,
});

// Submit a vote
export const submitVote = async (
  takeId: string,
  userId: string,
  vote: 'hot' | 'not'
): Promise<void> => {
  try {
    // Check if user has already voted on this take
    const existingVote = await getUserVoteForTake(takeId, userId);
    if (existingVote) {
      console.warn(`Duplicate vote attempt: User ${userId} already voted on take ${takeId}`);
      // Silently return success instead of throwing - prevents crash
      return;
    }

    // Create the vote document
    const voteData: TakeVoteFirestore = {
      takeId,
      userId,
      vote,
      votedAt: new Date(),
      userAgent: navigator?.userAgent || 'Unknown',
    };

    // Use batch write to ensure consistency
    const batch = writeBatch(db);

    // Add the vote document
    const voteRef = doc(collection(db, VOTES_COLLECTION));
    batch.set(voteRef, {
      ...voteData,
      votedAt: Timestamp.fromDate(voteData.votedAt),
    });

    // Commit the batch
    await batch.commit();

    // Update the take vote counts (separate operation for better reliability)
    await updateTakeVotes(takeId, vote);
  } catch (error) {
    console.error('Error submitting vote:', error);
    // Don't throw - just log the error to prevent crashes
    // The vote might have already been recorded
    console.warn('Vote may have been recorded despite error:', error);
  }
};

// Get user's vote for a specific take
export const getUserVoteForTake = async (
  takeId: string,
  userId: string
): Promise<TakeVote | null> => {
  try {
    const voteQuery = query(
      collection(db, VOTES_COLLECTION),
      where('takeId', '==', takeId),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(voteQuery);
    
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return convertFirestoreVote(doc.id, doc.data());
  } catch (error) {
    console.error('Error getting user vote:', error);
    return null;
  }
};

// Get all votes for a user
export const getUserVotes = async (userId: string): Promise<TakeVote[]> => {
  try {
    const voteQuery = query(
      collection(db, VOTES_COLLECTION),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(voteQuery);
    return snapshot.docs.map(doc => convertFirestoreVote(doc.id, doc.data()));
  } catch (error) {
    console.error('Error getting user votes:', error);
    return [];
  }
};

// Get a newest-first page of votes for history screens.
export const getUserVotesPage = async (
  userId: string,
  pageSize: number,
  cursor?: VoteHistoryCursor | null
): Promise<UserVotesPage> => {
  const pageQuery = query(
    collection(db, VOTES_COLLECTION),
    where('userId', '==', userId),
    orderBy('votedAt', 'desc'),
    firestoreLimit(pageSize + 1),
    ...(cursor ? [startAfter(cursor)] : [])
  );

  const snapshot = await getDocs(pageQuery);
  const docs = snapshot.docs;
  const pageDocs = docs.slice(0, pageSize);

  return {
    votes: pageDocs.map(doc => convertFirestoreVote(doc.id, doc.data())),
    cursor: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore: docs.length > pageSize,
  };
};

// Delete a user's vote for a specific take
export const deleteVote = async (
  takeId: string,
  userId: string
): Promise<void> => {
  try {
    // Find the user's vote for this take
    const voteQuery = query(
      collection(db, VOTES_COLLECTION),
      where('takeId', '==', takeId),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(voteQuery);
    
    if (snapshot.empty) {
      console.warn(`No vote found to delete for user ${userId} on take ${takeId}`);
      return;
    }

    const voteDoc = snapshot.docs[0];
    const voteData = voteDoc.data();
    const vote = voteData.vote as 'hot' | 'not';

    // Use batch write to ensure consistency
    const batch = writeBatch(db);

    // Delete the vote document
    batch.delete(voteDoc.ref);

    // Commit the batch
    await batch.commit();

    // Update the take vote counts (decrement the vote count)
    await decrementTakeVotes(takeId, vote);

    // Also decrement the user's vote count
    const { decrementUserVoteCount } = await import('./userService');
    await decrementUserVoteCount(userId);
  } catch (error) {
    console.error('Error deleting vote:', error);
    throw new Error('Failed to delete vote');
  }
};

// Get user's voting statistics
export const getUserVotingStats = async (userId: string) => {
  try {
    const votes = await getUserVotes(userId);
    
    const hotVotes = votes.filter(vote => vote.vote === 'hot').length;
    const notVotes = votes.filter(vote => vote.vote === 'not').length;
    
    const sortedVotes = [...votes].sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime());
    const uniqueVoteDates = Array.from(
      new Set(sortedVotes.map((vote) => getLocalDateKey(vote.votedAt)))
    ).sort((a, b) => {
      const aTime = parseDateKey(a)?.getTime() ?? 0;
      const bTime = parseDateKey(b)?.getTime() ?? 0;
      return bTime - aTime;
    });

    let streak = 0;
    if (uniqueVoteDates.length > 0) {
      const todayKey = getLocalDateKey();
      const latestVoteDate = uniqueVoteDates[0];
      const distanceFromToday = getDateKeyDistance(latestVoteDate, todayKey);

      if (distanceFromToday !== null && distanceFromToday <= 1) {
        streak = 1;
        let previousDateKey = latestVoteDate;

        for (const voteDateKey of uniqueVoteDates.slice(1)) {
          const distance = getDateKeyDistance(voteDateKey, previousDateKey);
          if (distance !== 1) {
            break;
          }

          streak += 1;
          previousDateKey = voteDateKey;
        }
      }
    }

    return {
      totalVotes: votes.length,
      hotVotes,
      notVotes,
      votingStreak: streak,
      firstVoteAt: votes.length > 0 ? votes[votes.length - 1].votedAt : null,
      lastVoteAt: votes.length > 0 ? votes[0].votedAt : null,
    };
  } catch (error) {
    console.error('Error getting voting stats:', error);
    return {
      totalVotes: 0,
      hotVotes: 0,
      notVotes: 0,
      votingStreak: 0,
      firstVoteAt: null,
      lastVoteAt: null,
    };
  }
};

// Check if user has voted on any of the provided takes
export const getUserVotesForTakes = async (
  takeIds: string[],
  userId: string
): Promise<{ [takeId: string]: TakeVote }> => {
  try {
    if (takeIds.length === 0) return {};

    const voteQuery = query(
      collection(db, VOTES_COLLECTION),
      where('takeId', 'in', takeIds.slice(0, 10)), // Firestore 'in' limit is 10
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(voteQuery);
    const votes: { [takeId: string]: TakeVote } = {};
    
    snapshot.docs.forEach(doc => {
      const vote = convertFirestoreVote(doc.id, doc.data());
      votes[vote.takeId] = vote;
    });

    return votes;
  } catch (error) {
    console.error('Error getting user votes for takes:', error);
    return {};
  }
};
