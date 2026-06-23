import type { Take } from '../types/Take';

type CommunityWeightProfile = 'strong' | 'soft';

const getCommunityWeight = (
  take: Pick<Take, 'totalVotes'>,
  profile: CommunityWeightProfile
): number => {
  const totalVotes = Math.max(0, take.totalVotes || 0);

  if (totalVotes >= 50) {
    return profile === 'strong' ? 3 : 2;
  }

  if (totalVotes >= 10) {
    return profile === 'strong' ? 2 : 1.5;
  }

  return 1;
};

export const orderTakesByCommunityWeight = <T extends Pick<Take, 'totalVotes'>>(
  takes: T[],
  profile: CommunityWeightProfile = 'strong'
): T[] =>
  takes
    .map((take, index) => ({
      take,
      index,
      weightedScore: Math.random() * getCommunityWeight(take, profile),
    }))
    .sort((first, second) => second.weightedScore - first.weightedScore || first.index - second.index)
    .map(({ take }) => take);
