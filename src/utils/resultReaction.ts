export type VoteChoice = 'hot' | 'not';

export type ResultReactionTone =
  | 'hot'
  | 'not'
  | 'split'
  | 'contrarian'
  | 'rare-contrarian'
  | 'consensus'
  | 'low-signal';

export interface ResultReactionInput {
  userVote?: VoteChoice | null;
  hotPercentage: number;
  notPercentage: number;
  totalVotes: number;
  seed?: string;
}

export interface ResultReaction {
  headline: string;
  subtext?: string;
  tone: ResultReactionTone;
}

const getVoteLabel = (vote: VoteChoice) => vote.toUpperCase();

const hashString = (value: string) => {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash, 31) + value.charCodeAt(i);
  }

  return Math.abs(hash);
};

const pickVariant = <T,>(variants: readonly T[], seed = 'result', salt = ''): T => {
  return variants[hashString(`${seed}:${salt}`) % variants.length];
};

const lowSignalHeadlines = [
  '👀 Early read',
  '🌱 Fresh take',
  '🧪 First signals',
  '👂 The room is warming up',
] as const;

const splitHeadlines = [
  '⚔️ The room is divided',
  '⚖️ Too close to call',
  '🤜🤛 Dead heat',
  '🔥❄️ Split room',
] as const;

const consensusHeadlines = [
  '🤝 Almost everyone agrees',
  '🧠 Rare consensus',
  '📣 Basically unanimous',
  '✅ The room aligned',
] as const;

const tinyMinorityHeadlines = [
  '😈 Tiny minority energy',
  '🧭 Lone-wolf read',
  '🫣 You found the tiny camp',
  '🎯 Against the avalanche',
] as const;

const unseenLandslideHeadlines: Record<VoteChoice, readonly string[]> = {
  hot: [
    '🔥 Certified heater',
    '🌶️ Spicy consensus',
    '📈 HOT is running away',
    '🔥 The room is heating up',
  ],
  not: [
    '❄️ Ice cold verdict',
    '🧊 Frozen out',
    '📉 NOT is running away',
    '❄️ The room cooled it off',
  ],
};

const unseenLeanHeadlines: Record<VoteChoice, readonly string[]> = {
  hot: [
    '🔥 Community leans HOT',
    '🔥 The room is warming up',
    '🌶️ HOT has the edge',
    '📈 HOT is pulling ahead',
  ],
  not: [
    '❄️ Community leans NOT',
    '❄️ The room is cooling off',
    '🧊 NOT has the edge',
    '📉 NOT is pulling ahead',
  ],
};

const strongContrarianHeadlines = [
  '😈 Contrarian moment',
  '🧭 Lone-wolf read',
  '🫣 Tiny camp energy',
  '🎯 You split from the room',
] as const;

const contrarianHeadlines = [
  '😬 You went against the crowd',
  '🧭 You took the other side',
  '🌶️ Spicy disagreement',
  '👀 Not the crowd pick',
] as const;

const agreementLandslideHeadlines: Record<VoteChoice, readonly string[]> = {
  hot: [
    '🔥 Certified heater',
    '🔥 The room backed you',
    '🌶️ Strong HOT energy',
    '📣 HOT by a mile',
  ],
  not: [
    '❄️ Ice cold agreement',
    '❄️ The room backed you',
    '🧊 Strong NOT energy',
    '📣 NOT by a mile',
  ],
};

const agreementHeadlines: Record<VoteChoice, readonly string[]> = {
  hot: [
    '🔥 The crowd is with you',
    '🤝 You read the room',
    '🔥 HOT side has backup',
    '✅ You called it',
  ],
  not: [
    '❄️ The crowd is with you',
    '🤝 You read the room',
    '❄️ NOT side has backup',
    '✅ You called it',
  ],
};

export const getResultReaction = ({
  userVote,
  hotPercentage,
  notPercentage,
  totalVotes,
  seed,
}: ResultReactionInput): ResultReaction => {
  const hotWins = hotPercentage >= notPercentage;
  const winningVote: VoteChoice = hotWins ? 'hot' : 'not';
  const winningPercentage = hotWins ? hotPercentage : notPercentage;
  const losingPercentage = hotWins ? notPercentage : hotPercentage;
  const margin = Math.abs(hotPercentage - notPercentage);

  if (totalVotes < 10) {
    return {
      headline: pickVariant(lowSignalHeadlines, seed, 'low-signal'),
      tone: 'low-signal',
    };
  }

  if (margin <= 8) {
    return {
      headline: pickVariant(splitHeadlines, seed, 'split'),
      tone: 'split',
    };
  }

  if (winningPercentage >= 95) {
    if (userVote && userVote !== winningVote) {
      return {
        headline: pickVariant(tinyMinorityHeadlines, seed, 'tiny-minority'),
        subtext: `Only ${losingPercentage}% agreed with you`,
        tone: 'rare-contrarian',
      };
    }

    return {
      headline: pickVariant(consensusHeadlines, seed, 'consensus'),
      tone: 'consensus',
    };
  }

  if (!userVote) {
    if (winningPercentage >= 85) {
      return {
        headline: pickVariant(unseenLandslideHeadlines[winningVote], seed, `unseen-${winningVote}-landslide`),
        tone: winningVote,
      };
    }

    return {
      headline: pickVariant(unseenLeanHeadlines[winningVote], seed, `unseen-${winningVote}-lean`),
      tone: winningVote,
    };
  }

  const userAgreedWithCrowd = userVote === winningVote;
  const userAgreementPercentage = userAgreedWithCrowd ? winningPercentage : losingPercentage;

  if (!userAgreedWithCrowd) {
    return {
      headline: pickVariant(
        userAgreementPercentage <= 15 ? strongContrarianHeadlines : contrarianHeadlines,
        seed,
        userAgreementPercentage <= 15 ? 'strong-contrarian' : 'contrarian',
      ),
      subtext: `Only ${userAgreementPercentage}% agreed with you`,
      tone: 'contrarian',
    };
  }

  if (winningPercentage >= 85) {
    return {
      headline: pickVariant(
        agreementLandslideHeadlines[winningVote],
        seed,
        `${winningVote}-agreement-landslide`,
      ),
      tone: winningVote,
    };
  }

  return {
    headline: pickVariant(agreementHeadlines[winningVote], seed, `${winningVote}-agreement`),
    tone: winningVote,
  };
};
