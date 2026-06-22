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
  '👂 The room is listening',
  '🫧 Too early to tell',
  '🧭 First few votes are in',
  '🔎 Fresh read forming',
  '✨ New take energy',
  '📡 Signal just started',
] as const;

const splitHeadlines = [
  '⚔️ The room is divided',
  '⚖️ Too close to call',
  '🤜🤛 Dead heat',
  '🔥❄️ Split room',
  '🎭 Nobody agrees yet',
  '🪓 Right down the middle',
  '🧩 This one split people',
  '🥊 Neck and neck',
  '🫨 The room can’t decide',
] as const;

const consensusHeadlines = [
  '🤝 Almost everyone agrees',
  '🧠 Rare consensus',
  '📣 Basically unanimous',
  '✅ The room aligned',
  '🫡 The room has spoken',
  '🏛️ Consensus landed',
  '📌 No real debate here',
  '🧲 Everyone pulled the same way',
  '🎯 Clean consensus',
] as const;

const tinyMinorityHeadlines = [
  '😈 Tiny minority energy',
  '🧭 Lone-wolf read',
  '🫣 You found the tiny camp',
  '🎯 Against the avalanche',
  '⚡ Rare dissent detected',
  '🪐 Way outside orbit',
  '🕳️ Deep minority take',
  '🚩 You broke from the pack',
  '🧨 Bold little faction',
] as const;

const unseenLandslideHeadlines: Record<VoteChoice, readonly string[]> = {
  hot: [
    '🔥 Certified heater',
    '🌶️ Spicy consensus',
    '📈 HOT is running away',
    '🔥 The room is heating up',
    '🚒 This one is blazing',
    '🏁 HOT took off',
    '📣 Big HOT majority',
    '🔥 The crowd went HOT',
    '🌡️ Temperature is rising',
  ],
  not: [
    '❄️ Ice cold verdict',
    '🧊 Frozen out',
    '📉 NOT is running away',
    '❄️ The room cooled it off',
    '🥶 Cold front came in',
    '🏁 NOT took off',
    '📣 Big NOT majority',
    '🧊 The crowd went NOT',
    '🌬️ This one got chilly',
  ],
};

const unseenLeanHeadlines: Record<VoteChoice, readonly string[]> = {
  hot: [
    '🔥 Community leans HOT',
    '🔥 HOT is gaining ground',
    '🌶️ HOT has the edge',
    '📈 HOT is pulling ahead',
    '👀 HOT has momentum',
    '🧲 The room tilts HOT',
    '🔥 Slight HOT advantage',
    '📊 HOT is ahead for now',
  ],
  not: [
    '❄️ Community leans NOT',
    '❄️ The room is cooling off',
    '🧊 NOT has the edge',
    '📉 NOT is pulling ahead',
    '👀 NOT has momentum',
    '🧲 The room tilts NOT',
    '❄️ Slight NOT advantage',
    '📊 NOT is ahead for now',
  ],
};

const strongContrarianHeadlines = [
  '😈 Contrarian moment',
  '🧭 You charted your own course',
  '🫣 Tiny camp energy',
  '🎯 You split from the room',
  '⚡ Rare disagreement',
  '🧨 You went bold',
  '🚧 Crowd did not follow',
  '🕶️ Minority report',
  '🪩 Different frequency',
] as const;

const contrarianHeadlines = [
  '😬 You went against the crowd',
  '🧭 You took the other side',
  '🌶️ Spicy disagreement',
  '👀 Not the crowd pick',
  '⚡ You broke from the room',
  '🫡 Respectfully outnumbered',
  '🎲 You played the long shot',
  '🥊 You took the tougher side',
  '🚦 Different read from the room',
] as const;

const agreementLandslideHeadlines: Record<VoteChoice, readonly string[]> = {
  hot: [
    '🔥 Certified heater',
    '🔥 The room backed you',
    '🌶️ Strong HOT energy',
    '📣 HOT by a mile',
    '🏆 HOT won big',
    '🚒 You joined the blaze',
    '📈 Big HOT agreement',
    '🔥 Crowd went with you',
    '🌡️ You felt the heat',
  ],
  not: [
    '❄️ Ice cold agreement',
    '❄️ The room backed you',
    '🧊 Strong NOT energy',
    '📣 NOT by a mile',
    '🏆 NOT won big',
    '🥶 You joined the chill',
    '📉 Big NOT agreement',
    '❄️ Crowd went with you',
    '🌬️ You called the cold',
  ],
};

const agreementHeadlines: Record<VoteChoice, readonly string[]> = {
  hot: [
    '🔥 The crowd is with you',
    '🤝 You read the room',
    '🔥 HOT side has backup',
    '✅ You called it',
    '📣 You had company',
    '🧭 Your read matched the room',
    '🔥 Same heat as the crowd',
    '👀 The room saw it too',
    '🎯 You landed with the majority',
  ],
  not: [
    '❄️ The crowd is with you',
    '🤝 You read the room',
    '❄️ NOT side has backup',
    '✅ You called it',
    '📣 You had company',
    '🧭 Your read matched the room',
    '❄️ Same chill as the crowd',
    '👀 The room saw it too',
    '🎯 You landed with the majority',
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
