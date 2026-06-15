export type VoteChoice = 'hot' | 'not';

export type ResultReactionTone =
  | 'hot'
  | 'not'
  | 'split'
  | 'contrarian'
  | 'consensus'
  | 'low-signal';

export interface ResultReactionInput {
  userVote?: VoteChoice | null;
  hotPercentage: number;
  notPercentage: number;
  totalVotes: number;
}

export interface ResultReaction {
  headline: string;
  subtext: string;
  tone: ResultReactionTone;
}

const getVoteLabel = (vote: VoteChoice) => vote.toUpperCase();

export const getResultReaction = ({
  userVote,
  hotPercentage,
  notPercentage,
  totalVotes,
}: ResultReactionInput): ResultReaction => {
  const hotWins = hotPercentage >= notPercentage;
  const winningVote: VoteChoice = hotWins ? 'hot' : 'not';
  const winningPercentage = hotWins ? hotPercentage : notPercentage;
  const losingPercentage = hotWins ? notPercentage : hotPercentage;
  const margin = Math.abs(hotPercentage - notPercentage);

  if (totalVotes < 10) {
    return {
      headline: '👀 Early read',
      subtext: totalVotes === 1 ? 'Only 1 vote so far' : `${totalVotes} votes so far`,
      tone: 'low-signal',
    };
  }

  if (margin <= 8) {
    return {
      headline: '⚔️ The room is divided',
      subtext: `${hotPercentage}% HOT / ${notPercentage}% NOT`,
      tone: 'split',
    };
  }

  if (winningPercentage >= 95) {
    if (userVote && userVote !== winningVote) {
      return {
        headline: '😈 Tiny minority energy',
        subtext: `Only ${losingPercentage}% voted ${getVoteLabel(userVote)}`,
        tone: 'contrarian',
      };
    }

    return {
      headline: '🤝 Rare consensus',
      subtext: `Almost everyone voted ${getVoteLabel(winningVote)}`,
      tone: 'consensus',
    };
  }

  if (!userVote) {
    if (winningPercentage >= 85) {
      return {
        headline: winningVote === 'hot' ? '🔥 Certified heater' : '❄️ Ice cold verdict',
        subtext: `${winningPercentage}% voted ${getVoteLabel(winningVote)}`,
        tone: winningVote,
      };
    }

    return {
      headline: `${winningVote === 'hot' ? '🔥' : '❄️'} Community leans ${getVoteLabel(winningVote)}`,
      subtext: `${winningPercentage}% voted ${getVoteLabel(winningVote)}`,
      tone: winningVote,
    };
  }

  const userAgreedWithCrowd = userVote === winningVote;
  const userAgreementPercentage = userAgreedWithCrowd ? winningPercentage : losingPercentage;

  if (!userAgreedWithCrowd) {
    return {
      headline: userAgreementPercentage <= 15
        ? '😈 Contrarian moment'
        : '😬 You went against the crowd',
      subtext: `Only ${userAgreementPercentage}% agreed with you`,
      tone: 'contrarian',
    };
  }

  if (winningPercentage >= 85) {
    return {
      headline: winningVote === 'hot' ? '🔥 Certified heater' : '❄️ Ice cold agreement',
      subtext: `${winningPercentage}% voted ${getVoteLabel(winningVote)}`,
      tone: winningVote,
    };
  }

  return {
    headline: `${winningVote === 'hot' ? '🔥' : '❄️'} The crowd is with you`,
    subtext: `${winningPercentage}% voted ${getVoteLabel(winningVote)}`,
    tone: winningVote,
  };
};
