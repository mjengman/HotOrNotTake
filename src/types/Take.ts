// Submission status type
export type TakeStatus = 'pending' | 'approved' | 'rejected';

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
  isApproved: boolean; // Keep for backward compatibility
  status: TakeStatus; // New approval workflow
  submittedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  reportCount: number;
  isUserSubmitted?: boolean; // For UI display purposes
  isAIGenerated?: boolean; // Flag for AI-generated content
  embedding?: number[]; // OpenAI embedding vector for semantic similarity
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
  isApproved: boolean; // Keep for backward compatibility
  status: TakeStatus; // New approval workflow
  submittedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  reportCount: number;
  isAIGenerated?: boolean; // Flag for AI-generated content
  embedding?: number[]; // OpenAI embedding vector for semantic similarity
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
  id?: string; // Firebase document ID for submitted content
}