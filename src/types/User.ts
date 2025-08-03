// Firestore user document interface
export interface User {
  id: string;
  isAnonymous: boolean;
  totalVotes: number;
  totalSubmissions: number;
  joinedAt: Date;
  submittedTakes: string[]; // Array of take IDs
  votingStreak: number;
  lastActiveAt: Date;
}

export interface UserStats {
  totalVotes: number;
  hotVotesGiven: number;
  notVotesGiven: number;
  takesSubmitted: number;
  votingStreak: number;
  favoriteCategories: string[];
  joinedAt: Date;
}

// Firestore data transfer object for user
export interface UserFirestore {
  isAnonymous: boolean;
  totalVotes: number;
  totalSubmissions: number;
  joinedAt: Date;
  submittedTakes: string[];
  votingStreak: number;
  lastActiveAt: Date;
}