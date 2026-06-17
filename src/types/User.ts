export type DailyChallengeType =
  | 'vote_count'
  | 'category_votes'
  | 'fresh_votes'
  | 'divisive_votes'
  | 'multi_category_votes';

export interface DailyChallenge {
  date: string;
  type?: DailyChallengeType;
  title?: string;
  description?: string;
  category?: string;
  categoryLabel?: string;
  goal: number;
  progress: number;
  completed: boolean;
  completedAt?: Date;
  trackedCategories?: string[];
}

export interface AchievementToast {
  title: string;
  subtitle: string;
}

// Firestore user document interface
export interface User {
  id: string;
  isAnonymous: boolean;
  totalVotes: number;
  totalSubmissions: number;
  joinedAt: Date;
  submittedTakes: string[]; // Array of take IDs
  votingStreak: number;
  longestVotingStreak: number;
  totalStreakDays: number;
  lastStreakDate?: string;
  lastActiveAt: Date;
  dailyChallenge?: DailyChallenge;
  achievements?: string[];
  categoriesVoted?: string[];
}

export interface UserStats {
  totalVotes: number;
  hotVotesGiven: number;
  notVotesGiven: number;
  takesSubmitted: number;
  votingStreak: number;
  longestVotingStreak: number;
  totalStreakDays: number;
  lastStreakDate?: string;
  streakUpdatedToday: boolean;
  dailyChallenge: DailyChallenge;
  favoriteCategories: string[];
  joinedAt: Date;
}

export interface StreakUpdateResult {
  totalVotes?: number;
  currentStreak: number;
  longestVotingStreak: number;
  totalStreakDays: number;
  lastStreakDate: string;
  didUpdateToday: boolean;
  milestoneReached?: number;
  dailyChallenge?: DailyChallenge;
  challengeCompleted?: boolean;
  achievementToasts?: AchievementToast[];
}

export interface VoteEngagementContext {
  category?: string;
  totalVotesBefore?: number;
  hotVotesAfter?: number;
  notVotesAfter?: number;
  totalVotesAfter?: number;
}

// Firestore data transfer object for user
export interface UserFirestore {
  isAnonymous: boolean;
  totalVotes: number;
  totalSubmissions: number;
  joinedAt: Date;
  submittedTakes: string[];
  votingStreak: number;
  longestVotingStreak: number;
  totalStreakDays: number;
  lastStreakDate?: string;
  lastActiveAt: Date;
  dailyChallenge?: DailyChallenge;
  achievements?: string[];
  categoriesVoted?: string[];
}
