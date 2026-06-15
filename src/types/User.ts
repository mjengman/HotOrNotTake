export interface DailyChallenge {
  date: string;
  goal: number;
  progress: number;
  completed: boolean;
  completedAt?: Date;
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
