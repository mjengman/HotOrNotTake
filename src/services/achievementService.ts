import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORY_OPTIONS, MY_SKIPS_CATEGORY } from '../constants/categories';
import { AchievementToast, UserStats } from '../types/User';

export type AchievementId =
  | 'votes_10'
  | 'votes_100'
  | 'votes_500'
  | 'votes_1000'
  | 'shares_5'
  | 'saves_10'
  | 'contrarian_10'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'streak_60'
  | 'all_categories';

export type AchievementDefinition = {
  id: AchievementId;
  emoji: string;
  title: string;
  flavor: string;
  kind: 'votes' | 'streak' | 'categories' | 'shares' | 'saves' | 'contrarian';
  threshold?: number;
};

export type UnlockedAchievement = {
  id: AchievementId;
  title: string;
  emoji: string;
  flavor: string;
  unlockedAt: string;
};

const ACHIEVEMENTS_STORAGE_KEY = 'achievements:unlocked';
export const SHARE_COUNT_STORAGE_KEY = 'share-count:v1';
export const SAVE_COUNT_STORAGE_KEY = 'save-count:v1';
const CONTRARIAN_VOTE_IDS_STORAGE_KEY = 'contrarian-vote-ids:v1';

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'votes_10',
    emoji: '🗳️',
    title: '10 votes',
    flavor: "You're warming up.",
    kind: 'votes',
    threshold: 10,
  },
  {
    id: 'votes_100',
    emoji: '💯',
    title: '100 votes',
    flavor: "You're officially a regular.",
    kind: 'votes',
    threshold: 100,
  },
  {
    id: 'votes_500',
    emoji: '🗳️',
    title: '500 votes',
    flavor: 'Deep in the takes.',
    kind: 'votes',
    threshold: 500,
  },
  {
    id: 'votes_1000',
    emoji: '🔥',
    title: '1,000 votes',
    flavor: "You're basically the app now.",
    kind: 'votes',
    threshold: 1000,
  },
  {
    id: 'shares_5',
    emoji: '📣',
    title: '5 takes shared',
    flavor: "You're spreading the heat.",
    kind: 'shares',
    threshold: 5,
  },
  {
    id: 'saves_10',
    emoji: '⭐',
    title: '10 takes saved',
    flavor: "You've got a greatest-hits list.",
    kind: 'saves',
    threshold: 10,
  },
  {
    id: 'contrarian_10',
    emoji: '⚡',
    title: '10 unpopular votes',
    flavor: "You're not here to blend in.",
    kind: 'contrarian',
    threshold: 10,
  },
  {
    id: 'streak_7',
    emoji: '🔥',
    title: '7-day streak',
    flavor: "That's commitment.",
    kind: 'streak',
    threshold: 7,
  },
  {
    id: 'streak_14',
    emoji: '🔥',
    title: '14-day streak',
    flavor: 'Two weeks hot.',
    kind: 'streak',
    threshold: 14,
  },
  {
    id: 'streak_30',
    emoji: '🏆',
    title: '30-day streak',
    flavor: 'Legendary behavior.',
    kind: 'streak',
    threshold: 30,
  },
  {
    id: 'streak_60',
    emoji: '🏆',
    title: '60-day streak',
    flavor: 'Ridiculous in the best way.',
    kind: 'streak',
    threshold: 60,
  },
  {
    id: 'all_categories',
    emoji: '🌐',
    title: 'All categories',
    flavor: "You've got range.",
    kind: 'categories',
  },
];

const ACHIEVEMENT_BY_ID = ACHIEVEMENTS.reduce<Record<string, AchievementDefinition>>((acc, achievement) => {
  acc[achievement.id] = achievement;
  return acc;
}, {});

const VALID_ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map(achievement => achievement.id));
const VOTABLE_CATEGORY_VALUES = CATEGORY_OPTIONS
  .map(category => category.value)
  .filter(category => category !== 'all' && category !== MY_SKIPS_CATEGORY);

const normalizeStoredAchievement = (value: unknown): UnlockedAchievement | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<UnlockedAchievement>;
  if (
    typeof candidate.id !== 'string' ||
    !VALID_ACHIEVEMENT_IDS.has(candidate.id as AchievementId) ||
    typeof candidate.unlockedAt !== 'string'
  ) {
    return null;
  }

  const definition = ACHIEVEMENT_BY_ID[candidate.id];
  return {
    id: candidate.id as AchievementId,
    title: typeof candidate.title === 'string' ? candidate.title : definition.title,
    emoji: typeof candidate.emoji === 'string' ? candidate.emoji : definition.emoji,
    flavor: typeof candidate.flavor === 'string' ? candidate.flavor : definition.flavor,
    unlockedAt: candidate.unlockedAt,
  };
};

export const getUnlockedAchievements = async (): Promise<UnlockedAchievement[]> => {
  try {
    const raw = await AsyncStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeStoredAchievement)
      .filter((achievement): achievement is UnlockedAchievement => Boolean(achievement));
  } catch (error) {
    console.warn('Unable to read achievements:', error);
    return [];
  }
};

const writeUnlockedAchievements = async (achievements: UnlockedAchievement[]) => {
  await AsyncStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(achievements));
};

const readNumberFromStorage = async (key: string) => {
  const raw = await AsyncStorage.getItem(key);
  const value = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const writeNumberToStorage = async (key: string, value: number) => {
  await AsyncStorage.setItem(key, String(Math.max(0, value)));
};

const incrementStoredCount = async (key: string) => {
  const nextValue = (await readNumberFromStorage(key)) + 1;
  await writeNumberToStorage(key, nextValue);
  return nextValue;
};

const readStringArrayFromStorage = async (key: string) => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

const unlockActionAchievement = async (
  achievementId: AchievementId,
  currentCount: number
): Promise<UnlockedAchievement | null> => {
  const definition = ACHIEVEMENT_BY_ID[achievementId];
  if (!definition?.threshold || currentCount < definition.threshold) {
    return null;
  }

  const wasAlreadyUnlocked = (await getUnlockedAchievements()).some(
    achievement => achievement.id === achievementId
  );
  if (wasAlreadyUnlocked) {
    return null;
  }

  const unlocked = await unlockAchievements([achievementId]);
  return unlocked.find(achievement => achievement.id === achievementId) ?? null;
};

export const unlockAchievements = async (
  achievementIds: AchievementId[],
  unlockedAt = new Date().toISOString()
): Promise<UnlockedAchievement[]> => {
  if (achievementIds.length === 0) {
    return getUnlockedAchievements();
  }

  const unlocked = await getUnlockedAchievements();
  const unlockedIds = new Set(unlocked.map(achievement => achievement.id));
  let didChange = false;

  achievementIds.forEach(id => {
    if (unlockedIds.has(id)) {
      return;
    }

    const definition = ACHIEVEMENT_BY_ID[id];
    if (!definition) {
      return;
    }

    unlocked.push({
      id,
      title: definition.title,
      emoji: definition.emoji,
      flavor: definition.flavor,
      unlockedAt,
    });
    unlockedIds.add(id);
    didChange = true;
  });

  if (didChange) {
    await writeUnlockedAchievements(unlocked);
  }

  return unlocked;
};

export const unlockAchievementFromToast = async (toast: AchievementToast) => {
  if (!VALID_ACHIEVEMENT_IDS.has(toast.id as AchievementId)) {
    return;
  }

  await unlockAchievements([toast.id as AchievementId]);
};

export const recordShareAction = async () => {
  const shareCount = await incrementStoredCount(SHARE_COUNT_STORAGE_KEY);
  return unlockActionAchievement('shares_5', shareCount);
};

export const recordSaveAction = async () => {
  const saveCount = await incrementStoredCount(SAVE_COUNT_STORAGE_KEY);
  return unlockActionAchievement('saves_10', saveCount);
};

export const recordContrarianVote = async (takeId: string) => {
  const votedTakeIds = await readStringArrayFromStorage(CONTRARIAN_VOTE_IDS_STORAGE_KEY);
  if (votedTakeIds.includes(takeId)) {
    return null;
  }

  const nextTakeIds = [...votedTakeIds, takeId];
  await AsyncStorage.setItem(CONTRARIAN_VOTE_IDS_STORAGE_KEY, JSON.stringify(nextTakeIds));
  return unlockActionAchievement('contrarian_10', nextTakeIds.length);
};

export const getBackfillableAchievementIds = (stats: UserStats): AchievementId[] => {
  const unlockedIds: AchievementId[] = [];
  const totalVotes = stats.totalVotes || 0;
  const currentStreak = Math.max(stats.votingStreak || 0, stats.longestVotingStreak || 0);

  ACHIEVEMENTS.forEach(achievement => {
    if (achievement.kind === 'votes' && achievement.threshold && totalVotes >= achievement.threshold) {
      unlockedIds.push(achievement.id);
    }

    if (achievement.kind === 'streak' && achievement.threshold && currentStreak >= achievement.threshold) {
      unlockedIds.push(achievement.id);
    }
  });

  const categoriesVoted = new Set(stats.categoriesVoted || []);
  if (
    VOTABLE_CATEGORY_VALUES.length > 0 &&
    VOTABLE_CATEGORY_VALUES.every(category => categoriesVoted.has(category))
  ) {
    unlockedIds.push('all_categories');
  }

  return unlockedIds;
};

export const backfillUnlockedAchievements = async (stats: UserStats) => {
  const earnedIds = getBackfillableAchievementIds(stats);

  if ((await readNumberFromStorage(SHARE_COUNT_STORAGE_KEY)) >= 5) {
    earnedIds.push('shares_5');
  }

  if ((await readNumberFromStorage(SAVE_COUNT_STORAGE_KEY)) >= 10) {
    earnedIds.push('saves_10');
  }

  if ((await readStringArrayFromStorage(CONTRARIAN_VOTE_IDS_STORAGE_KEY)).length >= 10) {
    earnedIds.push('contrarian_10');
  }

  return unlockAchievements(earnedIds);
};
