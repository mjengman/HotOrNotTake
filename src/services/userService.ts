import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { 
  signInAnonymously,
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { auth, db } from './firebase';
import {
  AchievementToast,
  DailyChallenge,
  DailyChallengeType,
  StreakUpdateResult,
  User,
  UserFirestore,
  UserStats,
  VoteEngagementContext,
} from '../types/User';

// Collection references
const USERS_COLLECTION = 'users';
const STREAK_MILESTONES = new Set([3, 7, 14, 30, 50, 100, 365]);
const DAILY_CHALLENGE_GOAL = 20;
const DAILY_QUEST_CATEGORIES = [
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'environment', label: 'Environment' },
  { value: 'food', label: 'Food' },
  { value: 'life', label: 'Life' },
  { value: 'pets', label: 'Pets' },
  { value: 'politics', label: 'Politics' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'society', label: 'Society' },
  { value: 'sports', label: 'Sports' },
  { value: 'technology', label: 'Technology' },
  { value: 'travel', label: 'Travel' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'work', label: 'Work' },
] as const;
const DAILY_QUEST_TYPES: DailyChallengeType[] = [
  'vote_count',
  'category_votes',
  'fresh_votes',
  'divisive_votes',
  'multi_category_votes',
];
const VOTE_ACHIEVEMENTS = [
  {
    id: 'votes_10',
    threshold: 10,
    toast: {
      title: '🗳️ 10 votes cast',
      subtitle: "You're getting warmed up.",
    },
  },
  {
    id: 'votes_100',
    threshold: 100,
    toast: {
      title: '💯 100 votes',
      subtitle: "You're a regular.",
    },
  },
  {
    id: 'votes_1000',
    threshold: 1000,
    toast: {
      title: '🔥 1,000 votes',
      subtitle: 'Certified Hot or Not veteran.',
    },
  },
] as const;
const STREAK_ACHIEVEMENTS = [
  {
    id: 'streak_7',
    threshold: 7,
    toast: {
      title: '🔥 7-day streak',
      subtitle: 'The habit is real.',
    },
  },
  {
    id: 'streak_30',
    threshold: 30,
    toast: {
      title: '🏆 30 days',
      subtitle: 'Legendary.',
    },
  },
] as const;
const ALL_CATEGORY_ACHIEVEMENT_ID = 'all_categories_voted';
const VALID_VOTE_CATEGORIES = [
  'entertainment',
  'environment',
  'food',
  'life',
  'pets',
  'politics',
  'relationships',
  'society',
  'sports',
  'technology',
  'travel',
  'wellness',
  'work',
] as const;

export const getLocalDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey?: string): Date | null => {
  if (!dateKey) {
    return null;
  }

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

const getStableQuestIndex = (seed: string, modulo: number): number => {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return modulo > 0 ? hash % modulo : 0;
};

const getQuestCategory = (dateKey: string, userId = 'global') =>
  DAILY_QUEST_CATEGORIES[
    getStableQuestIndex(`${userId}:${dateKey}:category`, DAILY_QUEST_CATEGORIES.length)
  ];

const getDailyQuestTemplate = (dateKey: string, userId?: string) => {
  const questType =
    DAILY_QUEST_TYPES[getStableQuestIndex(`${userId || 'global'}:${dateKey}:type`, DAILY_QUEST_TYPES.length)];
  const category = getQuestCategory(dateKey, userId);

  switch (questType) {
    case 'category_votes':
      return {
        type: questType,
        title: `${category.label} tour`,
        description: `Vote on 10 ${category.label.toLowerCase()} takes today.`,
        category: category.value,
        categoryLabel: category.label,
        goal: 10,
      };
    case 'fresh_votes':
      return {
        type: questType,
        title: 'Fresh eyes',
        description: 'Vote on 5 takes with fewer than 10 votes.',
        goal: 5,
      };
    case 'divisive_votes':
      return {
        type: questType,
        title: 'Find the fault lines',
        description: 'Vote on 3 takes that split the room 40/60 or closer.',
        goal: 3,
      };
    case 'multi_category_votes':
      return {
        type: questType,
        title: 'Sampler platter',
        description: 'Vote in 3 different categories today.',
        goal: 3,
      };
    case 'vote_count':
    default:
      return {
        type: 'vote_count' as const,
        title: 'Daily heat check',
        description: 'Vote on 20 takes today.',
        goal: DAILY_CHALLENGE_GOAL,
      };
  }
};

const convertDailyChallenge = (data: any, userId?: string): DailyChallenge | undefined => {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const date = typeof data.date === 'string' ? data.date : getLocalDateKey();
  const template = getDailyQuestTemplate(date, userId);
  const hasKnownType =
    typeof data.type === 'string' && DAILY_QUEST_TYPES.includes(data.type as DailyChallengeType);
  const type = hasKnownType ? data.type as DailyChallengeType : template.type;
  const goal = hasKnownType && typeof data.goal === 'number' ? data.goal : template.goal;

  return {
    date,
    type,
    title: hasKnownType && typeof data.title === 'string' ? data.title : template.title,
    description: hasKnownType && typeof data.description === 'string' ? data.description : template.description,
    category: hasKnownType && typeof data.category === 'string' ? data.category : template.category,
    categoryLabel: hasKnownType && typeof data.categoryLabel === 'string' ? data.categoryLabel : template.categoryLabel,
    goal,
    progress: typeof data.progress === 'number' ? data.progress : 0,
    completed: Boolean(data.completed),
    completedAt: data.completedAt?.toDate
      ? data.completedAt.toDate()
      : data.completedAt
        ? new Date(data.completedAt)
        : undefined,
    trackedCategories: Array.isArray(data.trackedCategories)
      ? data.trackedCategories.filter((category: unknown): category is string => typeof category === 'string')
      : undefined,
  };
};

const getFreshDailyChallenge = (
  dateKey = getLocalDateKey(),
  userId?: string
): DailyChallenge => {
  const template = getDailyQuestTemplate(dateKey, userId);

  return {
    date: dateKey,
    ...template,
    progress: 0,
    completed: false,
    ...(template.type === 'multi_category_votes' ? { trackedCategories: [] } : {}),
  };
};

const normalizeDailyChallenge = (
  challenge: DailyChallenge | undefined,
  dateKey = getLocalDateKey(),
  userId?: string
): DailyChallenge => {
  if (!challenge || challenge.date !== dateKey) {
    return getFreshDailyChallenge(dateKey, userId);
  }

  const template = getDailyQuestTemplate(dateKey, userId);
  const goal = challenge.goal || template.goal;

  return {
    ...challenge,
    type: challenge.type || template.type,
    title: challenge.title || template.title,
    description: challenge.description || template.description,
    category: challenge.category || template.category,
    categoryLabel: challenge.categoryLabel || template.categoryLabel,
    goal,
    progress: Math.max(0, Math.min(challenge.progress || 0, goal)),
    completed: Boolean(challenge.completed),
    trackedCategories: challenge.trackedCategories || (template.type === 'multi_category_votes' ? [] : undefined),
  };
};

const serializeDailyChallenge = (challenge: DailyChallenge) => ({
  date: challenge.date,
  ...(challenge.type ? { type: challenge.type } : {}),
  ...(challenge.title ? { title: challenge.title } : {}),
  ...(challenge.description ? { description: challenge.description } : {}),
  ...(challenge.category ? { category: challenge.category } : {}),
  ...(challenge.categoryLabel ? { categoryLabel: challenge.categoryLabel } : {}),
  goal: challenge.goal,
  progress: challenge.progress,
  completed: challenge.completed,
  ...(challenge.completedAt ? { completedAt: Timestamp.fromDate(challenge.completedAt) } : {}),
  ...(challenge.trackedCategories ? { trackedCategories: challenge.trackedCategories } : {}),
});

const isDivisiveVote = (context: VoteEngagementContext): boolean => {
  const totalVotesAfter = context.totalVotesAfter || 0;

  if (totalVotesAfter <= 0 || context.hotVotesAfter === undefined || context.notVotesAfter === undefined) {
    return false;
  }

  const hotPercentage = Math.round((context.hotVotesAfter / totalVotesAfter) * 100);
  return hotPercentage >= 40 && hotPercentage <= 60;
};

const updateDailyChallengeProgress = (
  challenge: DailyChallenge,
  context: VoteEngagementContext
): DailyChallenge => {
  if (challenge.completed) {
    return challenge;
  }

  const nextChallenge = { ...challenge };
  let nextProgress = challenge.progress || 0;

  switch (challenge.type) {
    case 'category_votes':
      if (context.category && context.category === challenge.category) {
        nextProgress += 1;
      }
      break;
    case 'fresh_votes':
      if ((context.totalVotesBefore ?? Number.MAX_SAFE_INTEGER) < 10) {
        nextProgress += 1;
      }
      break;
    case 'divisive_votes':
      if (isDivisiveVote(context)) {
        nextProgress += 1;
      }
      break;
    case 'multi_category_votes': {
      if (context.category && VALID_VOTE_CATEGORIES.includes(context.category as typeof VALID_VOTE_CATEGORIES[number])) {
        const trackedCategories = Array.from(new Set([
          ...(challenge.trackedCategories || []),
          context.category,
        ]));
        nextChallenge.trackedCategories = trackedCategories;
        nextProgress = trackedCategories.length;
      }
      break;
    }
    case 'vote_count':
    default:
      nextProgress += 1;
  }

  return {
    ...nextChallenge,
    progress: Math.min(nextChallenge.goal, nextProgress),
  };
};

const getBackfilledAchievements = ({
  totalVotes,
  longestVotingStreak,
  categoriesVoted,
}: {
  totalVotes: number;
  longestVotingStreak: number;
  categoriesVoted: string[];
}): string[] => {
  const achievements = new Set<string>();

  VOTE_ACHIEVEMENTS.forEach(({ id, threshold }) => {
    if (totalVotes >= threshold) {
      achievements.add(id);
    }
  });

  STREAK_ACHIEVEMENTS.forEach(({ id, threshold }) => {
    if (longestVotingStreak >= threshold) {
      achievements.add(id);
    }
  });

  if (VALID_VOTE_CATEGORIES.every(category => categoriesVoted.includes(category))) {
    achievements.add(ALL_CATEGORY_ACHIEVEMENT_ID);
  }

  return Array.from(achievements);
};

// Convert Firestore user to app format
const convertFirestoreUser = (id: string, data: any): User => ({
  id,
  isAnonymous: data.isAnonymous || true,
  totalVotes: data.totalVotes || 0,
  totalSubmissions: data.totalSubmissions || 0,
  joinedAt: data.joinedAt?.toDate() || new Date(data.joinedAt),
  submittedTakes: data.submittedTakes || [],
  votingStreak: data.votingStreak || 0,
  longestVotingStreak: data.longestVotingStreak || data.votingStreak || 0,
  totalStreakDays: data.totalStreakDays || 0,
  lastStreakDate: data.lastStreakDate,
  lastActiveAt: data.lastActiveAt?.toDate() || new Date(data.lastActiveAt),
  dailyChallenge: convertDailyChallenge(data.dailyChallenge, id),
  achievements: Array.isArray(data.achievements) ? data.achievements : undefined,
  categoriesVoted: Array.isArray(data.categoriesVoted) ? data.categoriesVoted : [],
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
      const dailyChallenge = getFreshDailyChallenge(undefined, userId);
      const userData: UserFirestore = {
        isAnonymous: true,
        totalVotes: 0,
        totalSubmissions: 0,
        joinedAt: now,
        submittedTakes: [],
        votingStreak: 0,
        longestVotingStreak: 0,
        totalStreakDays: 0,
        lastActiveAt: now,
        dailyChallenge,
        achievements: [],
        categoriesVoted: [],
      };
      
      await setDoc(userRef, {
        ...userData,
        joinedAt: Timestamp.fromDate(userData.joinedAt),
        lastActiveAt: Timestamp.fromDate(userData.lastActiveAt),
        dailyChallenge: serializeDailyChallenge(dailyChallenge),
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

export const updateUserVotingStreak = async (userId: string): Promise<StreakUpdateResult> => {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const now = new Date();
  const todayKey = getLocalDateKey(now);

  return runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const data = userSnap.exists() ? userSnap.data() : {};

    const previousStreak = typeof data.votingStreak === 'number' ? data.votingStreak : 0;
    const previousLongest =
      typeof data.longestVotingStreak === 'number'
        ? data.longestVotingStreak
        : previousStreak;
    const previousTotalStreakDays =
      typeof data.totalStreakDays === 'number' ? data.totalStreakDays : 0;
    const previousDateKey =
      typeof data.lastStreakDate === 'string' ? data.lastStreakDate : undefined;

    if (previousDateKey === todayKey) {
      const currentStreak = Math.max(previousStreak, 1);
      const longestVotingStreak = Math.max(previousLongest, currentStreak);

      transaction.set(
        userRef,
        {
          votingStreak: currentStreak,
          longestVotingStreak,
          lastActiveAt: Timestamp.fromDate(now),
        },
        { merge: true }
      );

      return {
        currentStreak,
        longestVotingStreak,
        totalStreakDays: previousTotalStreakDays,
        lastStreakDate: todayKey,
        didUpdateToday: false,
      };
    }

    const distanceFromLastVote =
      previousDateKey ? getDateKeyDistance(previousDateKey, todayKey) : null;
    const currentStreak =
      distanceFromLastVote === 1 ? Math.max(previousStreak, 0) + 1 : 1;
    const longestVotingStreak = Math.max(previousLongest, currentStreak);
    const totalStreakDays = previousTotalStreakDays + 1;
    const milestoneReached =
      STREAK_MILESTONES.has(currentStreak) ? currentStreak : undefined;

    transaction.set(
      userRef,
      {
        ...(userSnap.exists()
          ? {}
          : {
              isAnonymous: true,
              totalVotes: 0,
              totalSubmissions: 0,
              joinedAt: Timestamp.fromDate(now),
              submittedTakes: [],
            }),
        votingStreak: currentStreak,
        longestVotingStreak,
        totalStreakDays,
        lastStreakDate: todayKey,
        streakUpdatedAt: Timestamp.fromDate(now),
        lastActiveAt: Timestamp.fromDate(now),
      },
      { merge: true }
    );

    return {
      currentStreak,
      longestVotingStreak,
      totalStreakDays,
      lastStreakDate: todayKey,
      didUpdateToday: true,
      milestoneReached,
    };
  });
};

export const updateUserEngagementAfterVote = async (
  userId: string,
  options: {
    category?: string;
    countDailyEngagement?: boolean;
    voteContext?: VoteEngagementContext;
  } = {}
): Promise<StreakUpdateResult> => {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const countDailyEngagement = options.countDailyEngagement !== false;

  return runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const data = userSnap.exists() ? userSnap.data() : {};

    const previousTotalVotes = typeof data.totalVotes === 'number' ? data.totalVotes : 0;
    const totalVotes = previousTotalVotes + 1;
    const previousStreak = typeof data.votingStreak === 'number' ? data.votingStreak : 0;
    const previousLongest =
      typeof data.longestVotingStreak === 'number'
        ? data.longestVotingStreak
        : previousStreak;
    const previousTotalStreakDays =
      typeof data.totalStreakDays === 'number' ? data.totalStreakDays : 0;
    const previousDateKey =
      typeof data.lastStreakDate === 'string' ? data.lastStreakDate : undefined;
    const existingCategories = Array.isArray(data.categoriesVoted)
      ? data.categoriesVoted.filter((category): category is string => typeof category === 'string')
      : [];
    const nextCategories = [...new Set([
      ...existingCategories,
      ...(options.category && VALID_VOTE_CATEGORIES.includes(options.category as typeof VALID_VOTE_CATEGORIES[number])
        ? [options.category]
        : []),
    ])];
    const hadAchievementsArray = Array.isArray(data.achievements);
    const achievements = new Set<string>(
      hadAchievementsArray
        ? data.achievements.filter((achievement: unknown): achievement is string => typeof achievement === 'string')
        : getBackfilledAchievements({
            totalVotes: previousTotalVotes,
            longestVotingStreak: previousLongest,
            categoriesVoted: existingCategories,
          })
    );
    const achievementToasts: AchievementToast[] = [];
    const existingChallenge = normalizeDailyChallenge(
      convertDailyChallenge(data.dailyChallenge, userId),
      todayKey,
      userId
    );
    let dailyChallenge = existingChallenge;
    let challengeCompleted = false;
    let currentStreak = Math.max(previousStreak, previousDateKey === todayKey ? 1 : 0);
    let longestVotingStreak = Math.max(previousLongest, currentStreak);
    let totalStreakDays = previousTotalStreakDays;
    let didUpdateToday = false;
    let milestoneReached: number | undefined;
    let lastStreakDate = previousDateKey || todayKey;

    if (countDailyEngagement) {
      const nextChallengeProgress = updateDailyChallengeProgress(existingChallenge, {
        ...options.voteContext,
        category: options.category || options.voteContext?.category,
      });
      challengeCompleted =
        !existingChallenge.completed && nextChallengeProgress.progress >= nextChallengeProgress.goal;
      dailyChallenge = {
        ...nextChallengeProgress,
        completed: existingChallenge.completed || challengeCompleted,
        completedAt: challengeCompleted ? now : existingChallenge.completedAt,
      };

      if (previousDateKey === todayKey) {
        currentStreak = Math.max(previousStreak, 1);
        longestVotingStreak = Math.max(previousLongest, currentStreak);
        lastStreakDate = todayKey;
      } else {
        const distanceFromLastVote =
          previousDateKey ? getDateKeyDistance(previousDateKey, todayKey) : null;
        currentStreak =
          distanceFromLastVote === 1 ? Math.max(previousStreak, 0) + 1 : 1;
        longestVotingStreak = Math.max(previousLongest, currentStreak);
        totalStreakDays = previousTotalStreakDays + 1;
        milestoneReached =
          STREAK_MILESTONES.has(currentStreak) ? currentStreak : undefined;
        didUpdateToday = true;
        lastStreakDate = todayKey;
      }

      VOTE_ACHIEVEMENTS.forEach(({ id, threshold, toast }) => {
        if (previousTotalVotes < threshold && totalVotes >= threshold && !achievements.has(id)) {
          achievements.add(id);
          achievementToasts.push(toast);
        }
      });

      STREAK_ACHIEVEMENTS.forEach(({ id, threshold, toast }) => {
        if (previousLongest < threshold && longestVotingStreak >= threshold && !achievements.has(id)) {
          achievements.add(id);
          achievementToasts.push(toast);
        }
      });

      if (
        VALID_VOTE_CATEGORIES.every(category => nextCategories.includes(category)) &&
        !achievements.has(ALL_CATEGORY_ACHIEVEMENT_ID)
      ) {
        achievements.add(ALL_CATEGORY_ACHIEVEMENT_ID);
        achievementToasts.push({
          title: "🌐 You've voted in every category",
          subtitle: 'Full-spectrum takes unlocked.',
        });
      }
    }

    transaction.set(
      userRef,
      {
        ...(userSnap.exists()
          ? {}
          : {
              isAnonymous: true,
              totalSubmissions: 0,
              joinedAt: Timestamp.fromDate(now),
              submittedTakes: [],
            }),
        totalVotes,
        votingStreak: currentStreak,
        longestVotingStreak,
        totalStreakDays,
        ...(countDailyEngagement || previousDateKey ? { lastStreakDate } : {}),
        dailyChallenge: serializeDailyChallenge(dailyChallenge),
        achievements: Array.from(achievements),
        categoriesVoted: nextCategories,
        lastActiveAt: Timestamp.fromDate(now),
        ...(didUpdateToday ? { streakUpdatedAt: Timestamp.fromDate(now) } : {}),
      },
      { merge: true }
    );

    return {
      currentStreak,
      longestVotingStreak,
      totalStreakDays,
      lastStreakDate,
      didUpdateToday,
      milestoneReached,
      dailyChallenge,
      challengeCompleted,
      achievementToasts,
    };
  });
};

// Decrement user's vote count (for vote changes/deletions)
export const decrementUserVoteCount = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      totalVotes: increment(-1),
      lastActiveAt: Timestamp.fromDate(new Date()),
    });
  } catch (error) {
    console.error('Error decrementing vote count:', error);
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
    const user = await getUser(userId);

    if (!user) {
      return {
        totalVotes: 0,
        hotVotesGiven: 0,
        notVotesGiven: 0,
        takesSubmitted: 0,
        votingStreak: 0,
        longestVotingStreak: 0,
        totalStreakDays: 0,
        streakUpdatedToday: false,
        dailyChallenge: getFreshDailyChallenge(undefined, userId),
        favoriteCategories: [],
        joinedAt: new Date(),
      };
    }

    const lastStreakDate = user.lastStreakDate;
    const todayKey = getLocalDateKey();
    const storedStreakDistance =
      lastStreakDate ? getDateKeyDistance(lastStreakDate, todayKey) : null;
    const storedStreakIsActive =
      storedStreakDistance !== null && storedStreakDistance >= 0 && storedStreakDistance <= 1;
    const votingStreak = storedStreakIsActive ? user.votingStreak : 0;
    const dailyChallenge = normalizeDailyChallenge(user.dailyChallenge, todayKey, userId);

    if (user.achievements === undefined) {
      const backfilledAchievements = getBackfilledAchievements({
        totalVotes: user.totalVotes,
        longestVotingStreak: Math.max(user.longestVotingStreak, votingStreak),
        categoriesVoted: user.categoriesVoted || [],
      });

      updateDoc(doc(db, USERS_COLLECTION, userId), {
        achievements: backfilledAchievements,
        categoriesVoted: user.categoriesVoted || [],
        dailyChallenge: serializeDailyChallenge(dailyChallenge),
      }).catch(error => {
        console.warn('Unable to backfill achievements:', error);
      });
    } else if (user.dailyChallenge?.date !== todayKey) {
      updateDoc(doc(db, USERS_COLLECTION, userId), {
        dailyChallenge: serializeDailyChallenge(dailyChallenge),
      }).catch(error => {
        console.warn('Unable to reset daily challenge:', error);
      });
    }

    return {
      totalVotes: user.totalVotes,
      hotVotesGiven: 0,
      notVotesGiven: 0,
      takesSubmitted: user.totalSubmissions,
      votingStreak,
      longestVotingStreak: Math.max(user.longestVotingStreak, votingStreak),
      totalStreakDays: user.totalStreakDays,
      lastStreakDate,
      streakUpdatedToday: lastStreakDate === todayKey,
      dailyChallenge,
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
      longestVotingStreak: 0,
      totalStreakDays: 0,
      streakUpdatedToday: false,
      dailyChallenge: getFreshDailyChallenge(undefined, userId),
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
