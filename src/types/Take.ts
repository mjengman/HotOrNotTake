// Firestore document interfaces
export interface Take {
  id: string;
  text: string;
  category: string;
  hotVotes: number;
  notVotes: number;
  totalVotes: number;
  createdAt: Date;
  userId: string;
  isApproved: boolean;
  reportCount: number;
  isUserSubmitted?: boolean; // For UI display purposes
}

export interface TakeVote {
  id: string;
  takeId: string;
  userId: string;
  vote: 'hot' | 'not';
  votedAt: Date;
  userAgent?: string;
}

// Firestore data transfer objects (what gets saved to database)
export interface TakeFirestore {
  text: string;
  category: string;
  hotVotes: number;
  notVotes: number;
  totalVotes: number;
  createdAt: Date;
  userId: string;
  isApproved: boolean;
  reportCount: number;
}

export interface TakeVoteFirestore {
  takeId: string;
  userId: string;
  vote: 'hot' | 'not';
  votedAt: Date;
  userAgent?: string;
}

// Form interfaces for take submission
export interface TakeSubmission {
  text: string;
  category: string;
}