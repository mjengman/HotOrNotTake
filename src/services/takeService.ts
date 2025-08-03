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
  isApproved: data.isApproved || false,
  reportCount: data.reportCount || 0,
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
  userId: string
): Promise<string> => {
  try {
    const takeFirestore: TakeFirestore = {
      text: takeData.text.trim(),
      category: takeData.category.toLowerCase(),
      hotVotes: 0,
      notVotes: 0,
      totalVotes: 0,
      createdAt: new Date(),
      userId,
      isApproved: false, // Requires approval
      reportCount: 0,
    };

    const docRef = await addDoc(collection(db, TAKES_COLLECTION), {
      ...takeFirestore,
      createdAt: Timestamp.fromDate(takeFirestore.createdAt),
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