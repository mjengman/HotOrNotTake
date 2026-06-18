import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, deleteDoc, collection, getDocs, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Take } from '../types/Take';
import { getTakesByIds } from './takeService';

export interface FavoriteItem {
  takeId: string;
  favoritedAt: Date;
}

export type FavoriteWithTake = FavoriteItem & { take?: Take };

type FavoritesCache = {
  savedAt: number;
  favorites: FavoriteWithTake[];
};

const FAVORITES_CACHE_VERSION = 'v1';
const FAVORITES_CACHE_KEY_PREFIX = `favorites-cache:${FAVORITES_CACHE_VERSION}`;
const memoryCache = new Map<string, FavoritesCache>();
const prefetchPromises = new Map<string, Promise<void>>();

const getFavoritesCacheKey = (userId: string) => `${FAVORITES_CACHE_KEY_PREFIX}:${userId}`;

const reviveDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const reviveTake = (take?: Take): Take | undefined => {
  if (!take) return undefined;

  return {
    ...take,
    createdAt: reviveDate(take.createdAt),
    submittedAt: reviveDate(take.submittedAt),
    approvedAt: take.approvedAt ? reviveDate(take.approvedAt) : undefined,
    rejectedAt: take.rejectedAt ? reviveDate(take.rejectedAt) : undefined,
  };
};

const reviveFavorite = (favorite: FavoriteWithTake): FavoriteWithTake => ({
  ...favorite,
  favoritedAt: reviveDate(favorite.favoritedAt),
  take: reviveTake(favorite.take),
});

const reviveCache = (cache: Partial<FavoritesCache>): FavoritesCache => ({
  savedAt: typeof cache.savedAt === 'number' ? cache.savedAt : 0,
  favorites: Array.isArray(cache.favorites) ? cache.favorites.map(reviveFavorite) : [],
});

export const getUserFavoritesCacheSnapshot = (userId: string): FavoritesCache | null =>
  memoryCache.get(userId) || null;

export const readUserFavoritesCache = async (userId: string): Promise<FavoritesCache | null> => {
  const cached = memoryCache.get(userId);
  if (cached) {
    return cached;
  }

  try {
    const raw = await AsyncStorage.getItem(getFavoritesCacheKey(userId));
    if (!raw) return null;

    const revived = reviveCache(JSON.parse(raw));
    memoryCache.set(userId, revived);
    return revived;
  } catch (error) {
    console.warn('Unable to read favorites cache:', error);
    return null;
  }
};

const writeUserFavoritesCache = async (userId: string, cache: FavoritesCache) => {
  const revived = reviveCache(cache);
  memoryCache.set(userId, revived);
  await AsyncStorage.setItem(getFavoritesCacheKey(userId), JSON.stringify(revived));
};

export const clearUserFavoritesCache = async (userId: string) => {
  memoryCache.delete(userId);
  try {
    await AsyncStorage.removeItem(getFavoritesCacheKey(userId));
  } catch (error) {
    console.warn('Unable to clear favorites cache:', error);
  }
};

export const addToFavorites = async (userId: string, takeId: string): Promise<void> => {
  try {
    const favoriteRef = doc(db, `users/${userId}/favorites`, takeId);
    await setDoc(favoriteRef, {
      favoritedAt: new Date(),
    });
    await clearUserFavoritesCache(userId);
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
};

export const removeFromFavorites = async (userId: string, takeId: string): Promise<void> => {
  try {
    const favoriteRef = doc(db, `users/${userId}/favorites`, takeId);
    await deleteDoc(favoriteRef);
    await clearUserFavoritesCache(userId);
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

export const getUserFavoritesWithTakes = async (userId: string): Promise<FavoriteWithTake[]> => {
  const favoriteItems = await getUserFavorites(userId);
  const takesById = await getTakesByIds(favoriteItems.map(favorite => favorite.takeId));

  const favorites = favoriteItems.map(favorite => ({
    ...favorite,
    take: takesById[favorite.takeId],
  }));

  await writeUserFavoritesCache(userId, {
    savedAt: Date.now(),
    favorites,
  });

  return favorites;
};

export const prefetchUserFavoritesCache = async (userId: string) => {
  const existing = prefetchPromises.get(userId);
  if (existing) {
    return existing;
  }

  const promise = getUserFavoritesWithTakes(userId).then(() => undefined);
  prefetchPromises.set(userId, promise);

  try {
    await promise;
  } finally {
    prefetchPromises.delete(userId);
  }
};
