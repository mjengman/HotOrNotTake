import {
  collection,
  doc,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  writeBatch,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { TakeVote, TakeVoteFirestore } from '../types/Take';
import { updateTakeVotes } from './takeService';

// Collection references
const VOTES_COLLECTION = 'votes';

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
    const takeRef = doc(db, 'takes', takeId);
    const updateData = {
      totalVotes: increment(-1),
      ...(vote === 'hot' 
        ? { hotVotes: increment(-1) } 
        : { notVotes: increment(-1) }
      ),
    };

    await updateDoc(takeRef, updateData);

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
    
    // Calculate voting streak (consecutive days with votes)
    const sortedVotes = votes.sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime());
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const vote of sortedVotes) {
      const voteDate = new Date(vote.votedAt);
      voteDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((currentDate.getTime() - voteDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
        currentDate = voteDate;
      } else if (daysDiff > streak) {
        break;
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