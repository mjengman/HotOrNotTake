export interface User {
  id: string;
  isAnonymous: boolean;
  totalVotes: number;
  totalSubmissions: number;
  joinedAt: Date;
}

export interface UserStats {
  hotVotesGiven: number;
  notVotesGiven: number;
  takesSubmitted: number;
  favoriteCategories: string[];
}