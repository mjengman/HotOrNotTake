import { doc, setDoc, deleteDoc, collection, getDocs, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface FavoriteItem {
  takeId: string;
  favoritedAt: Date;
}

export const addToFavorites = async (userId: string, takeId: string): Promise<void> => {
  try {
    const favoriteRef = doc(db, `users/${userId}/favorites`, takeId);
    await setDoc(favoriteRef, {
      favoritedAt: new Date(),
    });
    console.log(`Added take ${takeId} to favorites for user ${userId}`);
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
};

export const removeFromFavorites = async (userId: string, takeId: string): Promise<void> => {
  try {
    const favoriteRef = doc(db, `users/${userId}/favorites`, takeId);
    await deleteDoc(favoriteRef);
    console.log(`Removed take ${takeId} from favorites for user ${userId}`);
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
};

export const getUserFavorites = async (userId: string): Promise<FavoriteItem[]> => {
  try {
    const favoritesRef = collection(db, `users/${userId}/favorites`);
    const q = query(favoritesRef, orderBy('favoritedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const favorites: FavoriteItem[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      favorites.push({
        takeId: doc.id,
        favoritedAt: data.favoritedAt.toDate(),
      });
    });
    
    console.log(`Retrieved ${favorites.length} favorites for user ${userId}`);
    return favorites;
  } catch (error) {
    console.error('Error getting user favorites:', error);
    throw error;
  }
};

export const isInFavorites = async (userId: string, takeId: string): Promise<boolean> => {
  try {
    const favoriteRef = doc(db, `users/${userId}/favorites`, takeId);
    const snapshot = await getDoc(favoriteRef);
    return snapshot.exists();
  } catch (error) {
    console.error('Error checking if in favorites:', error);
    return false;
  }
};