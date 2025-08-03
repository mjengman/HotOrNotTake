import { useState, useCallback } from 'react';
import { Take, TakeVote } from '../types';
import { sampleTakes } from '../constants';

export const useTakes = () => {
  const [takes, setTakes] = useState<Take[]>(sampleTakes || []);
  const [votes, setVotes] = useState<TakeVote[]>([]);

  const submitVote = useCallback((takeId: string, vote: 'hot' | 'not') => {
    const newVote: TakeVote = {
      takeId,
      userId: 'anonymous-user', // Will be replaced with actual user ID in Phase 2
      vote,
      votedAt: new Date(),
    };

    setVotes(prev => [...prev, newVote]);

    // Update the take's vote counts locally
    setTakes(prev => prev.map(take => {
      if (take.id === takeId) {
        return {
          ...take,
          hotVotes: vote === 'hot' ? take.hotVotes + 1 : take.hotVotes,
          notVotes: vote === 'not' ? take.notVotes + 1 : take.notVotes,
        };
      }
      return take;
    }));
  }, []);

  const getUserVoteForTake = useCallback((takeId: string): TakeVote | undefined => {
    return votes.find(vote => vote.takeId === takeId && vote.userId === 'anonymous-user');
  }, [votes]);

  const getUserStats = useCallback(() => {
    const hotVotes = votes.filter(vote => vote.vote === 'hot').length;
    const notVotes = votes.filter(vote => vote.vote === 'not').length;
    
    return {
      totalVotes: votes.length,
      hotVotes,
      notVotes,
      votingStreak: votes.length, // Simple implementation for now
    };
  }, [votes]);

  return {
    takes,
    votes,
    submitVote,
    getUserVoteForTake,
    getUserStats,
  };
};