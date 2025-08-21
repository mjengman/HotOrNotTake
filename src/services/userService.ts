import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  Timestamp,
  collection,
  getCountFromServer,
} from 'firebase/firestore';
import { 
  signInAnonymously,
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { auth, db } from './firebase';
import { User, UserFirestore, UserStats } from '../types/User';
import { getUserVotingStats } from './voteService';

// Collection references
const USERS_COLLECTION = 'users';

// Convert Firestore user to app format
const convertFirestoreUser = (id: string, data: any): User => ({
  id,
  isAnonymous: data.isAnonymous || true,
  totalVotes: data.totalVotes || 0,
  totalSubmissions: data.totalSubmissions || 0,
  joinedAt: data.joinedAt?.toDate() || new Date(data.joinedAt),
  submittedTakes: data.submittedTakes || [],
  votingStreak: data.votingStreak || 0,
  lastActiveAt: data.lastActiveAt?.toDate() || new Date(data.lastActiveAt),
});

// Sign in anonymously
export const signInAnonymous = async (): Promise<FirebaseUser> => {
  try {
    const result = await signInAnonymously(auth);
    
    // Create user document if it doesn't exist
    await createUserIfNotExists(result.user.uid);
    
    return result.user;
  } catch (error) {
    console.error('Error signing in anonymously:', error);
    throw new Error('Failed to sign in');
  }
};

// Create user document if it doesn't exist
export const createUserIfNotExists = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      const now = new Date();
      const userData: UserFirestore = {
        isAnonymous: true,
        totalVotes: 0,
        totalSubmissions: 0,
        joinedAt: now,
        submittedTakes: [],
        votingStreak: 0,
        lastActiveAt: now,
      };
      
      await setDoc(userRef, {
        ...userData,
        joinedAt: Timestamp.fromDate(userData.joinedAt),
        lastActiveAt: Timestamp.fromDate(userData.lastActiveAt),
      });
    }
  } catch (error) {
    console.error('Error creating user:', error);
  }
};

// Get user data
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }
    
    return convertFirestoreUser(userId, userSnap.data());
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// Update user's last active time
export const updateUserActivity = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      lastActiveAt: Timestamp.fromDate(new Date()),
    });
  } catch (error) {
    console.error('Error updating user activity:', error);
  }
};

// Increment user's vote count
export const incrementUserVoteCount = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      totalVotes: increment(1),
      lastActiveAt: Timestamp.fromDate(new Date()),
    });
  } catch (error) {
    console.error('Error incrementing vote count:', error);
  }
};

// Increment user's submission count and add take ID
export const incrementUserSubmissionCount = async (
  userId: string,
  takeId: string
): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      totalSubmissions: increment(1),
      submittedTakes: arrayUnion(takeId),
      lastActiveAt: Timestamp.fromDate(new Date()),
    });
  } catch (error) {
    console.error('Error incrementing submission count:', error);
  }
};

// Get comprehensive user statistics
export const getUserStats = async (userId: string): Promise<UserStats> => {
  try {
    const [user, votingStats] = await Promise.all([
      getUser(userId),
      getUserVotingStats(userId),
    ]);

    if (!user) {
      return {
        totalVotes: 0,
        hotVotesGiven: 0,
        notVotesGiven: 0,
        takesSubmitted: 0,
        votingStreak: 0,
        favoriteCategories: [],
        joinedAt: new Date(),
      };
    }

    return {
      totalVotes: user.totalVotes,
      hotVotesGiven: votingStats.hotVotes,
      notVotesGiven: votingStats.notVotes,
      takesSubmitted: user.totalSubmissions,
      votingStreak: votingStats.votingStreak,
      favoriteCategories: [], // TODO: Calculate from vote history
      joinedAt: user.joinedAt,
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      totalVotes: 0,
      hotVotesGiven: 0,
      notVotesGiven: 0,
      takesSubmitted: 0,
      votingStreak: 0,
      favoriteCategories: [],
      joinedAt: new Date(),
    };
  }
};

// Auth state change listener
export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

// Sign out
export const signOut = async (): Promise<void> => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw new Error('Failed to sign out');
  }
};

// Get global community stats (total votes from all users)
export const getCommunityStats = async (): Promise<{ totalVotes: number }> => {
  try {
    // Alternative approach: sum up totalVotes from all approved takes
    // This matches what users can actually see and vote on
    const { getDocs, collection: firestoreCollection, query, where } = await import('firebase/firestore');
    
    // Only query approved takes (which all users can read)
    const takesQuery = query(
      firestoreCollection(db, 'takes'),
      where('isApproved', '==', true)
    );
    
    const takesSnapshot = await getDocs(takesQuery);
    let totalVotes = 0;
    
    takesSnapshot.forEach((doc) => {
      const take = doc.data();
      // Each take has totalVotes which is the sum of hotVotes + notVotes
      totalVotes += (take.totalVotes || 0);
    });
    
    return {
      totalVotes,
    };
  } catch (error) {
    console.error('Error fetching community stats:', error);
    // Return a fallback value rather than throwing
    return {
      totalVotes: 0,
    };
  }
};