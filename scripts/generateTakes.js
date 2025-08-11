#!/usr/bin/env node

/**
 * 🔥 Premium Hot Takes Generator v2.0
 * 
 * Advanced content generation with D20 roll system
 * Includes personality archetypes, focused prompts, and NUCLEAR spicy mode
 * 
 * Usage: 
 *   node scripts/generateTakes.js [category|all] [count] [mode]
 *   
 * Mode options:
 *   - auto (default): D20 roll determines prompt type
 *   - focused: Use focused prompts
 *   - spicy: NUCLEAR level controversial
 *   - generic: Basic prompts
 * 
 * Examples:
 *   node scripts/generateTakes.js food 5            # 5 food takes with auto mode
 *   node scripts/generateTakes.js politics 3 spicy  # 3 NUCLEAR political takes
 *   node scripts/generateTakes.js all 10 auto       # 10 auto takes across all
 */

require('dotenv').config();
const fetch = require('node-fetch');

// Your OpenAI API key - set via environment variable
const API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const MODEL = 'gpt-4o-mini';
const MAX_LENGTH = 100;

// All categories from your app
const CATEGORIES = [
  'technology', 'food', 'work', 'life', 'entertainment', 
  'politics', 'relationships', 'pets', 'wellness', 'travel', 
  'society', 'environment', 'sports'
];

// Personality archetypes for diverse voices
const PERSONALITY_ARCHETYPES = [
  { name: 'Contrarian', style: 'Always take the opposite stance of popular opinion' },
  { name: 'Traditionalist', style: 'Everything was better in the past' },
  { name: 'Futurist', style: 'Only care about future possibilities' },
  { name: 'Cynic', style: 'Everything is secretly worse than it seems' },
  { name: 'Optimist', style: 'Find the controversial positive in everything' },
  { name: 'Elitist', style: 'Most people have terrible taste' },
  { name: 'Populist', style: 'Common people know better than experts' },
  { name: 'Absolutist', style: 'Everything is black or white, no middle ground' },
  { name: 'Chaos Agent', style: 'Propose the most disruptive take possible' },
  { name: 'Devil\'s Advocate', style: 'Defend the indefensible position' },
  { name: 'Purist', style: 'Only the original/authentic version is acceptable' },
  { name: 'Radical', style: 'Complete system change is the only solution' },
  { name: 'Nostalgist', style: 'Romanticize a specific era obsessively' },
  { name: 'Minimalist', style: 'Less is always more, everyone else is excessive' },
  { name: 'Maximalist', style: 'More is always better, go to extremes' },
  { name: 'Gatekeeper', style: 'Real fans/experts would agree with this take' },
  { name: 'Provocateur', style: 'Say what everyone thinks but won\'t admit' },
  { name: 'Rationalist', style: 'Cold logic over emotions, regardless of feelings' },
  { name: 'Romantic', style: 'Emotions and passion over logic and reason' },
  { name: 'Conspiracy Theorist', style: 'Everything has a hidden agenda' },
  { name: 'Pragmatist', style: 'The practical reality nobody wants to hear' }
];

// Enhanced prompts by category - Premium quality from enhancedPrompts.ts
const ENHANCED_PROMPTS = {
  politics: {
    generic: ['Generate a hot take about politics'],
    focused: [
      'Pick any specific politician and generate a controversial take about them',
      'Choose a current political issue and share a divisive opinion on it',
      'Select any political figure from history and create a hot take about their legacy',
      'Pick a political topic everyone argues about and share your bold take',
      'Choose any country\'s political system and generate a controversial opinion'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) democracy being a failed system that should be replaced',
      2: 'NUCLEAR: Defend (or condemn) January 6th as either patriotic resistance or domestic terrorism',
      3: 'NUCLEAR: Argue (for or against) politicians being chosen by lottery instead of elections',
      4: 'NUCLEAR: Defend (or attack) voting rights requiring IQ tests or education requirements',
      5: 'NUCLEAR: Argue (for or against) the Civil War being about states\' rights vs slavery',
      6: 'NUCLEAR: Defend (or condemn) political assassinations as sometimes justified or always wrong',
      7: 'NUCLEAR: Argue (for or against) America peaking in the 1950s vs being better now',
      8: 'NUCLEAR: Defend (or attack) only property owners being allowed to vote',
      9: 'NUCLEAR: Argue (for or against) political parties being banned entirely',
      10: 'NUCLEAR: Defend (or destroy) the most hated politician as either genius or idiot',
      11: 'NUCLEAR: Argue (for or against) social media making democracy impossible',
      12: 'NUCLEAR: Defend (or attack) term limits as either saving or destroying government',
      13: 'NUCLEAR: Argue (for or against) gerrymandering being good or evil for democracy',
      14: 'NUCLEAR: Defend (or condemn) the Electoral College as perfect or terrible',
      15: 'NUCLEAR: Argue (for or against) political correctness destroying or protecting free speech',
      16: 'NUCLEAR: Defend (or attack) corporate money making elections more or less fair',
      17: 'NUCLEAR: Argue (for or against) voter fraud being everywhere or nowhere',
      18: 'NUCLEAR: Defend (or condemn) young people voting or waiting until age 30',
      19: 'NUCLEAR: Argue (for or against) the Constitution being perfect or needing complete rewrite',
      20: 'NUCLEAR: Defend (or destroy) the most controversial political decision as brilliant or catastrophic'
    }
  },
  
  food: {
    generic: ['Generate a hot take about food'],
    focused: [
      'Pick any popular restaurant chain and generate a controversial take',
      'Choose a specific cuisine and share a hot take',
      'Select any famous chef and create a divisive opinion',
      'Pick a controversial food and generate a bold take',
      'Choose any food trend and share a divisive opinion'
    ],
    rngSpice: {
      1: 'NUCLEAR: Defend (or destroy) pineapple pizza as either perfect or an abomination',
      2: 'NUCLEAR: Argue (for or against) well-done steak with ketchup being superior or disgusting',
      3: 'NUCLEAR: Defend (or attack) cereal for every meal being genius or insanity',
      4: 'NUCLEAR: Argue (for or against) wine culture being sophisticated or pretentious fraud',
      5: 'NUCLEAR: Defend (or condemn) fast food being healthier or deadlier than home cooking',
      6: 'NUCLEAR: Argue (for or against) veganism being morally superior or overhyped',
      7: 'NUCLEAR: Defend (or attack) tipping culture as generous or exploitative',
      8: 'NUCLEAR: Argue (for or against) cooking at home being essential or overrated',
      9: 'NUCLEAR: Defend (or condemn) food expiration dates as safety or corporate scam',
      10: 'NUCLEAR: Argue (for or against) expensive restaurants being worth it or complete scams',
      11: 'NUCLEAR: Defend (or destroy) gas station sushi as acceptable or dangerous',
      12: 'NUCLEAR: Argue (for or against) coffee culture being sophisticated or addiction disguised',
      13: 'NUCLEAR: Defend (or attack) processed food as convenient or poisonous',
      14: 'NUCLEAR: Argue (for or against) food photography being art or narcissistic waste',
      15: 'NUCLEAR: Defend (or condemn) eating the same meal daily as optimal or insane',
      16: 'NUCLEAR: Argue (for or against) celebrity chefs being talented or overrated frauds',
      17: 'NUCLEAR: Defend (or destroy) microwave cooking as efficient or food murder',
      18: 'NUCLEAR: Argue (for or against) meal prep being smart or obsessive behavior',
      19: 'NUCLEAR: Defend (or condemn) eating with hands as natural or uncivilized',
      20: 'NUCLEAR: Argue (for or against) food allergies being real or mostly psychological'
    }
  },

  technology: {
    generic: ['Generate a hot take about technology'],
    focused: [
      'Pick any major tech company and generate a controversial take',
      'Choose any tech CEO and share a divisive opinion',
      'Select any trending technology and create a hot take',
      'Pick any social media platform and generate a bold opinion',
      'Choose any tech product and share a controversial take'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) smartphones making humans stupider or smarter',
      2: 'NUCLEAR: Defend (or debunk) 5G conspiracy theories as reasonable or ridiculous',
      3: 'NUCLEAR: Argue (for or against) tech companies controlling society or staying out',
      4: 'NUCLEAR: Defend (or condemn) privacy as overrated or essential for freedom',
      5: 'NUCLEAR: Argue (for or against) AI replacing humans being good or catastrophic',
      6: 'NUCLEAR: Defend (or destroy) tech bros as modern heroes or villains',
      7: 'NUCLEAR: Argue (for or against) the internet being humanity\'s best or worst invention',
      8: 'NUCLEAR: Defend (or attack) subscription services as convenient or exploitative',
      9: 'NUCLEAR: Argue (for or against) social media addiction being evolution or disease',
      10: 'NUCLEAR: Defend (or condemn) planned obsolescence as innovation or corporate greed',
      11: 'NUCLEAR: Argue (for or against) cryptocurrency being the future or biggest scam',
      12: 'NUCLEAR: Defend (or oppose) tech companies replacing governments as better or terrifying',
      13: 'NUCLEAR: Argue (for or against) coding skills making people superior or elitist',
      14: 'NUCLEAR: Defend (or condemn) facial recognition as safety tool or dystopian nightmare',
      15: 'NUCLEAR: Argue (for or against) the metaverse being humanity\'s future or escapism',
      16: 'NUCLEAR: Defend (or attack) Apple products as premium quality or overpriced status symbols',
      17: 'NUCLEAR: Argue (for or against) TikTok destroying or enhancing human attention spans',
      18: 'NUCLEAR: Defend (or condemn) Elon Musk as humanity\'s savior or greatest threat',
      19: 'NUCLEAR: Argue (for or against) Mark Zuckerberg helping or harming society more than anyone',
      20: 'NUCLEAR: Defend (or oppose) AI chatbots as better or worse conversationalists than humans'
    }
  },

  work: {
    generic: ['Generate a hot take about work'],
    focused: [
      'Share a controversial opinion about remote work',
      'Create a hot take about hustle culture',
      'Generate a bold opinion about work-life balance',
      'Make a divisive claim about corporate culture',
      'Write a hot take about job interviews'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) working from home making employees productive or lazy',
      2: 'NUCLEAR: Defend (or condemn) unpaid internships as valuable opportunities or exploitation',
      3: 'NUCLEAR: Argue (for or against) 24/7 availability being dedication or work-life balance myth',
      4: 'NUCLEAR: Defend (or attack) quiet quitting as boundaries or lazy entitlement',
      5: 'NUCLEAR: Argue (for or against) minimum wage being livable or entry-level stepping stone',
      6: 'NUCLEAR: Defend (or oppose) workplace surveillance as productivity tool or privacy invasion',
      7: 'NUCLEAR: Argue (for or against) labor unions protecting workers or destroying business',
      8: 'NUCLEAR: Defend (or condemn) massive CEO pay as justified or obscene inequality',
      9: 'NUCLEAR: Argue (for or against) using sick days being responsible or showing weakness',
      10: 'NUCLEAR: Defend (or oppose) at-will employment as business freedom or worker exploitation',
      11: 'NUCLEAR: Argue (for or against) diversity programs being progress or reverse discrimination',
      12: 'NUCLEAR: Defend (or condemn) hustle culture as success path or toxic burnout culture',
      13: 'NUCLEAR: Argue (for or against) long work hours showing dedication or poor management',
      14: 'NUCLEAR: Defend (or attack) corporate jargon as efficient communication or meaningless buzzwords',
      15: 'NUCLEAR: Argue (for or against) team building activities being valuable or waste of time',
      16: 'NUCLEAR: Defend (or condemn) open offices as collaborative spaces or productivity killers',
      17: 'NUCLEAR: Argue (for or against) LinkedIn being networking or performative theater',
      18: 'NUCLEAR: Defend (or attack) Amazon\'s workplace culture as efficient or inhumane',
      19: 'NUCLEAR: Argue (for or against) tech company perks creating innovation or spoiled employees',
      20: 'NUCLEAR: Defend (or condemn) Elon Musk\'s management as visionary or toxic leadership'
    }
  },

  life: {
    generic: ['Generate a hot take about life'],
    focused: [
      'Share controversial life advice nobody wants to hear',
      'Create a hot take about modern lifestyle choices',
      'Generate a bold opinion about success and happiness',
      'Make a divisive claim about social norms',
      'Write a hot take about generational differences'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) adulting being harder now or every generation\'s excuse',
      2: 'NUCLEAR: Defend (or attack) New Year resolutions as motivation or self-deception',
      3: 'NUCLEAR: Argue (for or against) gratitude journaling being transformative or privileged nonsense',
      4: 'NUCLEAR: Defend (or condemn) meditation apps as accessibility or commercialized spirituality',
      5: 'NUCLEAR: Argue (for or against) life milestone pressure being motivation or toxic comparison',
      6: 'NUCLEAR: Defend (or attack) self-care culture as mental health or selfish indulgence',
      7: 'NUCLEAR: Argue (for or against) productivity hacks being improvement or procrastination',
      8: 'NUCLEAR: Defend (or ridicule) manifestation as spiritual power or delusional thinking',
      9: 'NUCLEAR: Argue (for or against) personal branding being necessity or narcissistic performance',
      10: 'NUCLEAR: Defend (or condemn) imposter syndrome as humility or self-sabotage excuse',
      11: 'NUCLEAR: Argue (for or against) FOMO being social media disease or natural emotion',
      12: 'NUCLEAR: Defend (or attack) gap years as exploration or privileged procrastination',
      13: 'NUCLEAR: Argue (for or against) searching for life purpose being growth or obsession',
      14: 'NUCLEAR: Defend (or ridicule) vision boards as tool or arts-and-crafts delusion',
      15: 'NUCLEAR: Argue (for or against) influencer lifestyles being inspiring or toxic fantasy',
      16: 'NUCLEAR: Defend (or condemn) millennials vs Gen Z as most struggling or most privileged',
      17: 'NUCLEAR: Argue (for or against) Dave Ramsey advice being wisdom or oversimplified',
      18: 'NUCLEAR: Defend (or destroy) hustle culture as success mindset or mental health destroyer',
      19: 'NUCLEAR: Argue (for or against) LinkedIn motivational posts being inspiration or cringe',
      20: 'NUCLEAR: Defend (or oppose) "life begins at 40" as wisdom or consolation prize'
    }
  },

  entertainment: {
    generic: ['Generate a hot take about entertainment'],
    focused: [
      'Pick any celebrity and generate a controversial take',
      'Choose any movie/TV show and share a divisive opinion',
      'Select any streaming platform and create a hot take',
      'Pick any entertainment genre and generate a bold opinion',
      'Choose any viral personality and share a controversial take'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) superhero movies being inspiring or fascist propaganda',
      2: 'NUCLEAR: Defend (or attack) anime as superior art or overhyped cartoons',
      3: 'NUCLEAR: Argue (for or against) spoiling movies being harmless fun or criminal offense',
      4: 'NUCLEAR: Defend (or condemn) reality TV as highest art form or cultural poison',
      5: 'NUCLEAR: Argue (for or against) musical episodes being brilliant or terrible television',
      6: 'NUCLEAR: Defend (or oppose) franchise reboots with diverse casting as progress or pandering',
      7: 'NUCLEAR: Argue (for or against) true crime podcasts being educational or victim exploitation',
      8: 'NUCLEAR: Defend (or attack) expensive concert tickets as fair market or fan exploitation',
      9: 'NUCLEAR: Argue (for or against) autotune being musical innovation or talent destruction',
      10: 'NUCLEAR: Defend (or condemn) reaction videos as entertainment or lazy content theft',
      11: 'NUCLEAR: Argue (for or against) podcasts being democratic media or failed radio hosts rambling',
      12: 'NUCLEAR: Defend (or destroy) fanfiction as better storytelling or amateur garbage',
      13: 'NUCLEAR: Argue (for or against) CGI ruining movies or enhancing cinematic possibilities',
      14: 'NUCLEAR: Defend (or condemn) The Last Jedi as brilliant or worst Star Wars movie',
      15: 'NUCLEAR: Argue (for or against) TikTok dances being important culture or meaningless trends',
      16: 'NUCLEAR: Defend (or destroy) Marvel movies as great entertainment or formulaic garbage',
      17: 'NUCLEAR: Argue (for or against) Netflix canceling shows as strategy or audience betrayal',
      18: 'NUCLEAR: Defend (or condemn) Taylor Swift fans as passionate community or dangerous cult',
      19: 'NUCLEAR: Argue (for or against) The Rock being charismatic star or overrated actor',
      20: 'NUCLEAR: Defend (or attack) the Kardashians as cultural icons or society\'s downfall'
    }
  },

  relationships: {
    generic: ['Generate a hot take about relationships'],
    focused: [
      'Share a controversial dating opinion',
      'Create a hot take about modern relationships',
      'Generate a bold opinion about marriage',
      'Make a divisive claim about friendship',
      'Write a hot take about family dynamics'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) ghosting being cowardly or merciful way to end things',
      2: 'NUCLEAR: Defend (or attack) height preferences as natural attraction or shallow discrimination',
      3: 'NUCLEAR: Argue (for or against) splitting bills being equality or romance killer',
      4: 'NUCLEAR: Defend (or condemn) constant texting as connection or unhealthy obsession',
      5: 'NUCLEAR: Argue (for or against) public proposals being romantic or manipulative pressure',
      6: 'NUCLEAR: Defend (or oppose) bachelor/ette parties as celebration or cheating rehearsal',
      7: 'NUCLEAR: Argue (for or against) couples sharing passwords being trust or privacy violation',
      8: 'NUCLEAR: Defend (or condemn) age gap relationships as true love or power imbalance',
      9: 'NUCLEAR: Argue (for or against) relationship labels being clarity or relationship prison',
      10: 'NUCLEAR: Defend (or attack) Valentine\'s Day as romantic or corporate manipulation',
      11: 'NUCLEAR: Argue (for or against) couples\' social media as cute sharing or attention seeking',
      12: 'NUCLEAR: Defend (or oppose) prenups as smart planning or marriage poison',
      13: 'NUCLEAR: Argue (for or against) living together before marriage being wise or relationship killer',
      14: 'NUCLEAR: Defend (or condemn) break up etiquette rules as courtesy or unnecessary drama',
      15: 'NUCLEAR: Argue (for or against) dating multiple people being exploration or emotional cheating',
      16: 'NUCLEAR: Defend (or attack) Tinder culture as liberation or relationship destroyer',
      17: 'NUCLEAR: Argue (for or against) The Bachelor being entertainment or toxic relationship model',
      18: 'NUCLEAR: Defend (or ridicule) love at first sight as real phenomenon or Hollywood fantasy',
      19: 'NUCLEAR: Argue (for or against) relationship podcasts being helpful or amateur therapy',
      20: 'NUCLEAR: Defend (or condemn) couples therapy as relationship savior or admission of failure'
    }
  },

  pets: {
    generic: ['Generate a hot take about pets'],
    focused: [
      'Generate a controversial opinion about pet ownership',
      'Create a hot take about cats vs dogs',
      'Share a divisive opinion about exotic pets',
      'Make a bold claim about pet training',
      'Write a hot take about animal behavior'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) cat people being more independent or antisocial than dog people',
      2: 'NUCLEAR: Defend (or condemn) pitbulls as misunderstood breeds or dangerous weapons',
      3: 'NUCLEAR: Argue (for or against) declawing cats being practical or inhumane mutilation',
      4: 'NUCLEAR: Defend (or attack) dressing pets in costumes as cute fun or animal humiliation',
      5: 'NUCLEAR: Argue (for or against) pets sleeping in beds being bonding or boundary issues',
      6: 'NUCLEAR: Defend (or condemn) small dogs as real dogs or overgrown angry rats',
      7: 'NUCLEAR: Argue (for or against) exotic pet ownership being passion or wildlife destruction',
      8: 'NUCLEAR: Defend (or attack) pet daycare as necessary service or money grab scam',
      9: 'NUCLEAR: Argue (for or against) leash laws being safety measures or government overreach',
      10: 'NUCLEAR: Defend (or condemn) pet birthday parties as harmless fun or psychiatric concern',
      11: 'NUCLEAR: Argue (for or against) designer dog breeds being cute companions or animal abuse',
      12: 'NUCLEAR: Defend (or oppose) giving pets CBD as medical treatment or human projection',
      13: 'NUCLEAR: Argue (for or against) emotional support animals being legitimate therapy or fake service dogs',
      14: 'NUCLEAR: Defend (or condemn) pets on airplanes as accommodation rights or public health risk',
      15: 'NUCLEAR: Argue (for or against) pet influencers being wholesome content or civilization decline',
      16: 'NUCLEAR: Defend (or attack) Golden Retrievers as perfect family dogs or overrated basic pets',
      17: 'NUCLEAR: Argue (for or against) Chihuahuas being loyal companions or evil demon rats',
      18: 'NUCLEAR: Defend (or oppose) strict pet adoption requirements as animal protection or gatekeeping',
      19: 'NUCLEAR: Argue (for or against) dog training shows being educational or animal exploitation',
      20: 'NUCLEAR: Defend (or condemn) calling yourself "pet parent" as loving bond or delusional anthropomorphism'
    }
  },

  wellness: {
    generic: ['Generate a hot take about wellness'],
    focused: [
      'Generate a controversial health opinion',
      'Create a hot take about fitness culture',
      'Share a divisive opinion about mental health',
      'Make a bold claim about diet trends',
      'Write a hot take about wellness industry'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) gym memberships being health investment or corporate scam',
      2: 'NUCLEAR: Defend (or attack) yoga as spiritual practice or pretentious stretching',
      3: 'NUCLEAR: Argue (for or against) supplements industry being necessity or expensive urine',
      4: 'NUCLEAR: Defend (or condemn) intermittent fasting as optimization or eating disorder',
      5: 'NUCLEAR: Argue (for or against) essential oils being natural medicine or snake oil',
      6: 'NUCLEAR: Defend (or attack) chiropractic care as legitimate therapy or pseudoscience',
      7: 'NUCLEAR: Argue (for or against) wellness influencers being educators or misinformation',
      8: 'NUCLEAR: Defend (or ridicule) cold plunges as biohacking or masochistic trend',
      9: 'NUCLEAR: Argue (for or against) meditation benefits being proven or placebo effect',
      10: 'NUCLEAR: Defend (or condemn) therapy stigma as outdated or protecting mental toughness',
      11: 'NUCLEAR: Argue (for or against) crystals and healing being power or expensive rocks',
      12: 'NUCLEAR: Defend (or attack) keto culture as revolution or dangerous fad',
      13: 'NUCLEAR: Argue (for or against) Peloton culture being community or expensive cult',
      14: 'NUCLEAR: Defend (or condemn) sleep optimization as priority or anxiety obsession',
      15: 'NUCLEAR: Argue (for or against) wellness apps being tools or data harvesting schemes',
      16: 'NUCLEAR: Defend (or destroy) Goop as innovation or dangerous quackery',
      17: 'NUCLEAR: Argue (for or against) CrossFit being elite fitness or injury cult',
      18: 'NUCLEAR: Defend (or attack) therapy-speak as EQ or communication poison',
      19: 'NUCLEAR: Argue (for or against) toxic positivity being motivation or gaslighting',
      20: 'NUCLEAR: Defend (or condemn) Joe Rogan health advice as wisdom or bro science'
    }
  },

  travel: {
    generic: ['Generate a hot take about travel'],
    focused: [
      'Generate a controversial opinion about tourism',
      'Create a hot take about popular destinations',
      'Share a divisive opinion about travel culture',
      'Make a bold claim about vacation styles',
      'Write a hot take about travel influencers'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) TSA security being necessary protection or theater',
      2: 'NUCLEAR: Defend (or condemn) airplane etiquette rules as courtesy or authoritarianism',
      3: 'NUCLEAR: Argue (for or against) hotel star ratings being accurate or marketing scam',
      4: 'NUCLEAR: Defend (or attack) travel photography as memory keeping or experience blocking',
      5: 'NUCLEAR: Argue (for or against) hostels being authentic travel or dirty backpacker nonsense',
      6: 'NUCLEAR: Defend (or condemn) tourist traps as legitimate business or visitor exploitation',
      7: 'NUCLEAR: Argue (for or against) carry-on only travel being smart or underprepared',
      8: 'NUCLEAR: Defend (or destroy) timeshares as great investment or financial trap',
      9: 'NUCLEAR: Argue (for or against) staycations being practical or giving up on life',
      10: 'NUCLEAR: Defend (or oppose) holiday travel as tradition or masochistic torture',
      11: 'NUCLEAR: Argue (for or against) resort fees being transparent pricing or hidden scam',
      12: 'NUCLEAR: Defend (or attack) guided tours as educational or tourist factory processing',
      13: 'NUCLEAR: Argue (for or against) travel rewards programs being worth it or corporate manipulation',
      14: 'NUCLEAR: Defend (or condemn) destination weddings as dream celebration or guest burden',
      15: 'NUCLEAR: Argue (for or against) van life being freedom or glorified homelessness',
      16: 'NUCLEAR: Defend (or attack) Disney World for adults as magical or creepy arrested development',
      17: 'NUCLEAR: Argue (for or against) Paris being overrated tourist trap or eternal masterpiece',
      18: 'NUCLEAR: Defend (or condemn) Airbnb as travel innovation or housing market destroyer',
      19: 'NUCLEAR: Argue (for or against) Las Vegas being adult playground or moral wasteland',
      20: 'NUCLEAR: Defend (or oppose) Hawaii tourism as economic necessity or cultural destruction'
    }
  },

  society: {
    generic: ['Generate a hot take about society'],
    focused: [
      'Generate a controversial opinion about social issues',
      'Create a hot take about cultural trends',
      'Share a divisive opinion about generations',
      'Make a bold claim about social media',
      'Write a hot take about modern society'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) Karen stereotype being legitimate concern or misogynistic meme',
      2: 'NUCLEAR: Defend (or attack) HOA regulations as property protection or authoritarian overreach',
      3: 'NUCLEAR: Argue (for or against) expanding tipping culture as support or wage-theft excuse',
      4: 'NUCLEAR: Defend (or condemn) public behavior standards as civility or social control',
      5: 'NUCLEAR: Argue (for or against) neighborhood Facebook groups as community or drama breeding',
      6: 'NUCLEAR: Defend (or attack) virtue signaling as awareness or performative hypocrisy',
      7: 'NUCLEAR: Argue (for or against) small talk being necessity or meaningless torture',
      8: 'NUCLEAR: Defend (or condemn) personal space boundaries as respect or antisocial behavior',
      9: 'NUCLEAR: Argue (for or against) phone use in public being evolution or social decay',
      10: 'NUCLEAR: Defend (or attack) social media oversharing as connection or narcissism',
      11: 'NUCLEAR: Argue (for or against) gender reveal parties being celebration or spectacle',
      12: 'NUCLEAR: Defend (or condemn) participation culture as inclusivity or mediocrity worship',
      13: 'NUCLEAR: Argue (for or against) helicopter parenting being protection or childhood destruction',
      14: 'NUCLEAR: Defend (or oppose) social credit systems as improvement or dystopian control',
      15: 'NUCLEAR: Argue (for or against) pronoun usage being basic respect or forced speech',
      16: 'NUCLEAR: Defend (or attack) "OK Boomer" as justice or ageist dismissal',
      17: 'NUCLEAR: Argue (for or against) influencer culture being democratic fame or vapid narcissism',
      18: 'NUCLEAR: Defend (or condemn) woke culture as progress or authoritarian ideology',
      19: 'NUCLEAR: Argue (for or against) Gen Alpha iPad kids being adapted or developmentally damaged',
      20: 'NUCLEAR: Defend (or attack) main character syndrome as empowerment or toxic narcissism'
    }
  },

  environment: {
    generic: ['Generate a hot take about the environment'],
    focused: [
      'Generate a controversial opinion about climate change',
      'Create a hot take about environmental policies',
      'Share a divisive opinion about green energy',
      'Make a bold claim about conservation',
      'Write a hot take about environmental activism'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) paper vs plastic straws being meaningful or distraction',
      2: 'NUCLEAR: Defend (or attack) recycling as solution or feel-good theater',
      3: 'NUCLEAR: Argue (for or against) nuclear energy being green solution or dangerous gamble',
      4: 'NUCLEAR: Defend (or condemn) individual climate action as necessary or corporate distraction',
      5: 'NUCLEAR: Argue (for or against) reusable bags being helpful or bacteria breeding grounds',
      6: 'NUCLEAR: Defend (or attack) lawn care as maintenance or environmental destruction',
      7: 'NUCLEAR: Argue (for or against) fast fashion boycotts as activism or privileged signaling',
      8: 'NUCLEAR: Defend (or condemn) veganism as planetary necessity or personal choice obsession',
      9: 'NUCLEAR: Argue (for or against) carbon footprint shaming as accountability or classist judgment',
      10: 'NUCLEAR: Defend (or attack) expensive eco-products as investment or green capitalism scam',
      11: 'NUCLEAR: Argue (for or against) EV batteries being clean or mining disaster',
      12: 'NUCLEAR: Defend (or condemn) composting as easy responsibility or urban impossibility',
      13: 'NUCLEAR: Argue (for or against) greenwashing being deception or environmental progress',
      14: 'NUCLEAR: Defend (or attack) environmental documentaries as education or alarmist propaganda',
      15: 'NUCLEAR: Argue (for or against) climate protests being necessary or counterproductive disruption',
      16: 'NUCLEAR: Defend (or condemn) Greta Thunberg as climate hero or manipulated activist',
      17: 'NUCLEAR: Argue (for or against) Tesla being savior or overhyped status symbol',
      18: 'NUCLEAR: Defend (or attack) plastic surgery waste as serious issue or ridiculous nitpicking',
      19: 'NUCLEAR: Argue (for or against) billionaire space travel being innovation or environmental crime',
      20: 'NUCLEAR: Defend (or condemn) environmental virtue signaling as awareness or performative hypocrisy'
    }
  },

  sports: {
    generic: ['Generate a hot take about sports'],
    focused: [
      'Generate a controversial opinion about popular sports',
      'Create a hot take about famous athletes',
      'Share a divisive opinion about team loyalty',
      'Make a bold claim about sports culture',
      'Write a hot take about competitive gaming'
    ],
    rngSpice: {
      1: 'NUCLEAR: Argue (for or against) participation trophies building confidence or creating entitlement',
      2: 'NUCLEAR: Defend (or attack) golf as legitimate sport or overpriced walking',
      3: 'NUCLEAR: Argue (for or against) baseball being America\'s pastime or boring relic',
      4: 'NUCLEAR: Defend (or condemn) soccer vs football as superior sport',
      5: 'NUCLEAR: Argue (for or against) Olympics being inspiring competition or corrupt spectacle',
      6: 'NUCLEAR: Defend (or attack) sports parents as supportive or toxic to kids',
      7: 'NUCLEAR: Argue (for or against) gym culture being motivational or intimidating gatekeeping',
      8: 'NUCLEAR: Defend (or condemn) CrossFit as elite fitness or dangerous cult',
      9: 'NUCLEAR: Argue (for or against) fantasy sports being harmless fun or gambling addiction',
      10: 'NUCLEAR: Defend (or attack) sports commentators as insightful experts or biased blowhards',
      11: 'NUCLEAR: Argue (for or against) basketball flopping being strategic or cheating disgrace',
      12: 'NUCLEAR: Defend (or oppose) boxing vs MMA as superior combat sport',
      13: 'NUCLEAR: Argue (for or against) NASCAR being real sport or glorified car commercial',
      14: 'NUCLEAR: Defend (or ridicule) sports superstitions as advantage or silly nonsense',
      15: 'NUCLEAR: Argue (for or against) pickleball popularity being deserved or overhyped fad',
      16: 'NUCLEAR: Defend (or condemn) Tom Brady as GOAT or system quarterback',
      17: 'NUCLEAR: Argue (for or against) LeBron vs Jordan debate having clear winner',
      18: 'NUCLEAR: Defend (or attack) NFL as great entertainment or brain damage factory',
      19: 'NUCLEAR: Argue (for or against) Serena Williams being tennis GOAT or overrated',
      20: 'NUCLEAR: Defend (or condemn) Tiger Woods as golf legend or cautionary tale'
    }
  }
};

// Helper functions
function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function choose(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPrompt(category, mode = 'auto') {
  const cat = ENHANCED_PROMPTS[category];
  if (!cat) throw new Error(`Unknown category: ${category}`);

  if (mode === 'generic') return choose(cat.generic);
  if (mode === 'focused') return choose(cat.focused);
  if (mode === 'spicy') {
    const keys = Object.keys(cat.rngSpice).map(Number);
    return cat.rngSpice[choose(keys)];
  }

  // Auto mode with D20 roll
  const d20 = rollD20();
  console.log(`   🎲 D20 Roll: ${d20}`);
  
  if (d20 >= 19) {
    // Critical hit! Nuclear spicy take (10% chance)
    console.log(`   💥 CRITICAL! Nuclear prompt selected`);
    const keys = Object.keys(cat.rngSpice).map(Number);
    return cat.rngSpice[choose(keys)];
  } else if (d20 >= 11) {
    // Focused prompt (45% chance)
    console.log(`   🎯 Focused prompt selected`);
    return choose(cat.focused);
  } else {
    // Generic prompt (45% chance)
    console.log(`   📝 Generic prompt selected`);
    return choose(cat.generic);
  }
}

// Generate a single premium take
async function generateTake(category, mode = 'auto', personaIndex = null) {
  const prompt = getPrompt(category, mode);
  const persona = personaIndex !== null 
    ? PERSONALITY_ARCHETYPES[personaIndex]
    : choose(PERSONALITY_ARCHETYPES);

  const systemPrompt = `You generate short, controversial "hot takes" for a social voting app.

PERSONALITY: You are a ${persona.name} — ${persona.style}

REQUIREMENTS:
• Maximum ${MAX_LENGTH} characters
• Be EXTREMELY divisive; people should strongly agree OR disagree
• Take a firm, absolute stance (no hedging, no disclaimers)
• Be provocative but do NOT include hate speech, slurs, or target protected classes
• Do not include threats or explicit calls for violence
• No explanations, no hashtags, no quotes — output ONLY the take
• If the prompt includes "NUCLEAR", pick a clear side (FOR or AGAINST) and go all in
• Keep it punchy and memorable

CATEGORY: ${category}
TOPIC PROMPT: ${prompt}

Generate ONE hot take that will get people arguing:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        max_tokens: 120,
        temperature: mode === 'spicy' ? 0.95 : 0.9,
        presence_penalty: 0.2,
        frequency_penalty: 0.2
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${errorText}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || '';
    const text = raw.replace(/^["'""]+|["'""]+$/g, ''); // Remove quotes
    
    return {
      text,
      category,
      persona: persona.name,
      mode,
      promptUsed: prompt.length > 90 ? prompt.slice(0, 90) + '...' : prompt,
      length: text.length
    };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

// Main generation function with premium features
async function main() {
  const [categoryArg = 'all', countArg = '5', modeArg = 'auto'] = process.argv.slice(2);
  const count = Math.max(1, parseInt(countArg, 10) || 5);
  const mode = ['auto', 'generic', 'focused', 'spicy'].includes(modeArg) ? modeArg : 'auto';

  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('❌ ERROR: Set your OpenAI API key in the script or environment.');
    console.error('   export OPENAI_API_KEY="sk-..." or edit the script directly');
    process.exit(1);
  }

  const categories = categoryArg === 'all' ? CATEGORIES : [categoryArg];
  for (const cat of categories) {
    if (!ENHANCED_PROMPTS[cat]) {
      console.error(`❌ Unknown category: ${cat}`);
      console.error(`   Available: ${CATEGORIES.join(', ')}`);
      process.exit(1);
    }
  }

  console.log('\n🔥 PREMIUM HOT TAKES GENERATOR v2.0 🔥');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📊 Generating: ${count} take(s)`);
  console.log(`🎯 Category:   ${categoryArg}`);
  console.log(`🎲 Mode:       ${mode.toUpperCase()}${mode === 'spicy' ? ' (NUCLEAR)' : mode === 'auto' ? ' (D20 ROLL)' : ''}`);
  console.log(`🤖 Model:      ${MODEL}`);
  console.log(`🎭 Personas:   ${PERSONALITY_ARCHETYPES.length} archetypes`);
  console.log('═══════════════════════════════════════════════════════\n');

  const allTakes = [];
  let totalGenerated = 0;
  
  for (const category of categories) {
    const perCategory = categoryArg === 'all' 
      ? Math.ceil(count / categories.length)
      : count;

    console.log(`\n🏷️  CATEGORY: ${category.toUpperCase()}`);
    console.log('─'.repeat(60));

    for (let i = 0; i < perCategory; i++) {
      const take = await generateTake(category, mode);
      
      if (take) {
        totalGenerated++;
        allTakes.push(take);
        
        const icon = mode === 'spicy' ? '🌶️' : mode === 'auto' ? '🎲' : '📝';
        console.log(`\n${totalGenerated}. ${icon} "${take.text}"`);
        console.log(`   📂 Category: ${take.category}`);
        console.log(`   🎭 Persona: ${take.persona}`);
        console.log(`   📏 Length: ${take.length} chars`);
        console.log(`   💡 Prompt: ${take.promptUsed}`);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  // Summary and copy-paste section
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`✅ Generated ${totalGenerated} premium takes`);
  console.log('═══════════════════════════════════════════════════════');
  
  if (allTakes.length > 0) {
    console.log('\n📋 ALL TAKES (COPY-PASTE READY):');
    console.log('─'.repeat(60));
    allTakes.forEach((take, i) => {
      console.log(`${i + 1}. [${take.category}] "${take.text}"`);
    });
    
    console.log('\n💡 TIPS:');
    console.log('─'.repeat(60));
    console.log('• Use "spicy" mode for guaranteed NUCLEAR prompts');
    console.log('• Use "auto" mode for D20 variety (10% nuclear, 45% focused, 45% generic)');
    console.log('• Run multiple times to vary personas and prompts');
    console.log('• Cherry-pick the best ones for your app');
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}