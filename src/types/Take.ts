export interface Take {
  id: string;
  text: string;
  category?: string;
  hotVotes: number;
  notVotes: number;
  createdAt: Date;
  isUserSubmitted?: boolean;
}

export interface TakeVote {
  takeId: string;
  userId: string;
  vote: 'hot' | 'not';
  votedAt: Date;
}