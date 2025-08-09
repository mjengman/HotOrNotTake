// Enhanced Three-Tier Prompt System for AI Content Generation
// Each category has: generic (fallback), focused (varied topics), and rngSpice (D20 specific/controversial)

// No more hardcoded arrays! Let the AI choose from its vast knowledge base.

export interface CategoryPrompts {
  generic: string[];
  focused: string[];
  rngSpice: { [key: number]: string };
}

export interface PromptCollection {
  [category: string]: CategoryPrompts;
}

export const ENHANCED_PROMPTS: PromptCollection = {
  politics: {
    generic: [
      'Generate a hot take about politics'
    ],
    focused: [
      // 'Share a bold opinion about the role of government in everyday life',
      // 'Generate a controversial take about the two-party system in America',
      // 'Create a divisive opinion about voting rights and access',
      // 'Write a hot take on political correctness or free speech in politics',
      // 'Make a bold claim about political polarization and echo chambers',
      // 'Share a controversial take about generational politics (Boomers vs Gen Z)',
      // 'Create a hot take about billionaires influencing elections',
      // 'Generate a divisive opinion on political debates and their usefulness',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any specific politician and generate a controversial take about them',
      'Choose a current political issue and share a divisive opinion on it',
      'Select any political figure from history and create a hot take about their legacy',
      'Pick a political topic everyone argues about and share your bold take',
      'Choose any country\'s political system and generate a controversial opinion about it'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) democracy being a failed system that should be replaced',
      2:  '☢️ NUCLEAR: Defend (or condemn) January 6th as either patriotic resistance or domestic terrorism',
      3:  '☢️ NUCLEAR: Argue (for or against) politicians being chosen by lottery instead of elections',
      4:  '☢️ NUCLEAR: Defend (or attack) voting rights requiring IQ tests or education requirements',
      5:  '☢️ NUCLEAR: Argue (for or against) the Civil War being about states\' rights vs slavery',
      6:  '☢️ NUCLEAR: Defend (or condemn) political assassinations as sometimes justified or always wrong',
      7:  '☢️ NUCLEAR: Argue (for or against) America peaking in the 1950s vs being better now',
      8:  '☢️ NUCLEAR: Defend (or attack) only property owners being allowed to vote',
      9:  '☢️ NUCLEAR: Argue (for or against) political parties being banned entirely',
      10: '☢️ NUCLEAR: Defend (or destroy) the most hated politician as either genius or idiot',
      11: '☢️ NUCLEAR: Argue (for or against) social media making democracy impossible',
      12: '☢️ NUCLEAR: Defend (or attack) term limits as either saving or destroying government',
      13: '☢️ NUCLEAR: Argue (for or against) gerrymandering being good or evil for democracy',
      14: '☢️ NUCLEAR: Defend (or condemn) the Electoral College as perfect or terrible',
      15: '☢️ NUCLEAR: Argue (for or against) political correctness destroying or protecting free speech',
      16: '☢️ NUCLEAR: Defend (or attack) corporate money making elections more or less fair',
      17: '☢️ NUCLEAR: Argue (for or against) voter fraud being everywhere or nowhere',
      18: '☢️ NUCLEAR: Defend (or condemn) young people voting or waiting until age 30',
      19: '☢️ NUCLEAR: Argue (for or against) the Constitution being perfect or needing complete rewrite',
      20: '☢️ NUCLEAR: Defend (or destroy) the most controversial political decision as brilliant or catastrophic'
    }
  },

  food: {
    generic: [
      'Generate a hot take about food'
    ],
    focused: [
      // 'Share a controversial opinion about plant-based meat alternatives',
      // 'Create a hot take about food delivery apps ruining restaurants',
      // 'Generate a bold opinion about cooking at home vs eating out',
      // 'Make a divisive claim about food allergies and dietary restrictions',
      // 'Write a hot take about portion sizes in American restaurants',
      // 'Share a controversial take on organic vs conventional produce',
      // 'Create a bold opinion about celebrity chef restaurants',
      // 'Generate a divisive take on food photography and Instagram culture',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any popular restaurant chain and generate a controversial take about it',
      'Choose a specific cuisine from anywhere in the world and share a hot take',
      'Select any famous chef or food personality and create a divisive opinion',
      'Pick a controversial food or drink and generate a bold take about it',
      'Choose any city known for its food scene and share a divisive opinion'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Defend (or destroy) pineapple pizza as either perfect or an abomination',
      2:  '☢️ NUCLEAR: Argue (for or against) well-done steak with ketchup being superior or disgusting',
      3:  '☢️ NUCLEAR: Defend (or attack) cereal for every meal being genius or insanity',
      4:  '☢️ NUCLEAR: Argue (for or against) wine culture being sophisticated or pretentious fraud',
      5:  '☢️ NUCLEAR: Defend (or condemn) fast food being healthier or deadlier than home cooking',
      6:  '☢️ NUCLEAR: Argue (for or against) veganism being morally superior or overhyped',
      7:  '☢️ NUCLEAR: Defend (or attack) tipping culture as generous or exploitative',
      8:  '☢️ NUCLEAR: Argue (for or against) cooking at home being essential or overrated',
      9:  '☢️ NUCLEAR: Defend (or condemn) food expiration dates as safety or corporate scam',
      10: '☢️ NUCLEAR: Argue (for or against) expensive restaurants being worth it or complete scams',
      11: '☢️ NUCLEAR: Defend (or destroy) gas station sushi as acceptable or dangerous',
      12: '☢️ NUCLEAR: Argue (for or against) coffee culture being sophisticated or addiction disguised',
      13: '☢️ NUCLEAR: Defend (or attack) processed food as convenient or poisonous',
      14: '☢️ NUCLEAR: Argue (for or against) food photography being art or narcissistic waste',
      15: '☢️ NUCLEAR: Defend (or condemn) eating the same meal daily as optimal or insane',
      16: '☢️ NUCLEAR: Argue (for or against) celebrity chefs being talented or overrated frauds',
      17: '☢️ NUCLEAR: Defend (or destroy) microwave cooking as efficient or food murder',
      18: '☢️ NUCLEAR: Argue (for or against) meal prep being smart or obsessive behavior',
      19: '☢️ NUCLEAR: Defend (or condemn) eating with hands as natural or uncivilized',
      20: '☢️ NUCLEAR: Argue (for or against) food allergies being real or mostly psychological'
    }
  },

  technology: {
    generic: [
      'Generate a hot take about technology'
    ],
    focused: [
      // 'Share a controversial opinion about screen time and digital wellness',
      // 'Create a hot take about the metaverse and virtual reality',
      // 'Generate a bold opinion about cryptocurrency and NFTs',
      // 'Make a divisive claim about tech company monopolies',
      // 'Write a hot take about online privacy and data collection',
      // 'Share a controversial take on remote work technology',
      // 'Create a bold opinion about AI replacing human jobs',
      // 'Generate a divisive take on social media\'s impact on society',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any major tech company and generate a controversial take about it',
      'Choose any tech CEO or founder and share a divisive opinion about them',
      'Select any trending technology topic and create a hot take about it',
      'Pick any social media platform and generate a bold opinion about its impact',
      'Choose any tech product everyone uses and share a controversial take'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) smartphones making humans stupider or smarter',
      2:  '☢️ NUCLEAR: Defend (or debunk) 5G conspiracy theories as reasonable or ridiculous',
      3:  '☢️ NUCLEAR: Argue (for or against) tech companies controlling society or staying out',
      4:  '☢️ NUCLEAR: Defend (or condemn) privacy as overrated or essential for freedom',
      5:  '☢️ NUCLEAR: Argue (for or against) AI replacing humans being good or catastrophic',
      6:  '☢️ NUCLEAR: Defend (or destroy) tech bros as modern heroes or villains',
      7:  '☢️ NUCLEAR: Argue (for or against) the internet being humanity\'s best or worst invention',
      8:  '☢️ NUCLEAR: Defend (or attack) subscription services as convenient or exploitative',
      9:  '☢️ NUCLEAR: Argue (for or against) social media addiction being evolution or disease',
      10: '☢️ NUCLEAR: Defend (or condemn) planned obsolescence as innovation or corporate greed',
      11: '☢️ NUCLEAR: Argue (for or against) cryptocurrency being the future or biggest scam',
      12: '☢️ NUCLEAR: Defend (or oppose) tech companies replacing governments as better or terrifying',
      13: '☢️ NUCLEAR: Argue (for or against) coding skills making people superior or elitist',
      14: '☢️ NUCLEAR: Defend (or condemn) facial recognition as safety tool or dystopian nightmare',
      15: '☢️ NUCLEAR: Argue (for or against) the metaverse being humanity\'s future or escapism',
      16: '☢️ NUCLEAR: Defend (or attack) Apple products as premium quality or overpriced status symbols',
      17: '☢️ NUCLEAR: Argue (for or against) TikTok destroying or enhancing human attention spans',
      18: '☢️ NUCLEAR: Defend (or condemn) Elon Musk as humanity\'s savior or greatest threat',
      19: '☢️ NUCLEAR: Argue (for or against) Mark Zuckerberg helping or harming society more than anyone',
      20: '☢️ NUCLEAR: Defend (or oppose) AI chatbots as better or worse conversationalists than humans'
    }
  },

  entertainment: {
    generic: [
      'Generate a hot take about entertainment'
    ],
    focused: [
      // 'Share a controversial opinion about remake culture in Hollywood',
      // 'Create a hot take about binge-watching vs weekly releases',
      // 'Generate a bold opinion about celebrity culture and parasocial relationships',
      // 'Make a divisive claim about award shows and their relevance',
      // 'Write a hot take about streaming service proliferation',
      // 'Share a controversial take on reality TV\'s impact on society',
      // 'Create a bold opinion about movie theater experiences',
      // 'Generate a divisive take on influencer entertainment',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any specific celebrity and generate a controversial take about them',
      'Choose any popular movie or TV show and share a divisive opinion',
      'Select any streaming platform and create a hot take about it',
      'Pick any entertainment genre and generate a bold opinion about it',
      'Choose any viral internet personality and share a controversial take'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) superhero movies being inspiring or fascist propaganda',
      2:  '☢️ NUCLEAR: Defend (or attack) anime as superior art or overhyped cartoons',
      3:  '☢️ NUCLEAR: Argue (for or against) spoiling movies being harmless fun or criminal offense',
      4:  '☢️ NUCLEAR: Defend (or condemn) reality TV as highest art form or cultural poison',
      5:  '☢️ NUCLEAR: Argue (for or against) musical episodes being brilliant or terrible television',
      6:  '☢️ NUCLEAR: Defend (or oppose) franchise reboots with diverse casting as progress or pandering',
      7:  '☢️ NUCLEAR: Argue (for or against) true crime podcasts being educational or victim exploitation',
      8:  '☢️ NUCLEAR: Defend (or attack) expensive concert tickets as fair market or fan exploitation',
      9:  '☢️ NUCLEAR: Argue (for or against) autotune being musical innovation or talent destruction',
      10: '☢️ NUCLEAR: Defend (or condemn) reaction videos as entertainment or lazy content theft',
      11: '☢️ NUCLEAR: Argue (for or against) podcasts being democratic media or failed radio hosts rambling',
      12: '☢️ NUCLEAR: Defend (or destroy) fanfiction as better storytelling or amateur garbage',
      13: '☢️ NUCLEAR: Argue (for or against) CGI ruining movies or enhancing cinematic possibilities',
      14: '☢️ NUCLEAR: Defend (or condemn) The Last Jedi as brilliant or worst Star Wars movie',
      15: '☢️ NUCLEAR: Argue (for or against) TikTok dances being important culture or meaningless trends',
      16: '☢️ NUCLEAR: Defend (or destroy) Marvel movies as great entertainment or formulaic garbage',
      17: '☢️ NUCLEAR: Argue (for or against) Netflix canceling shows as variety strategy or audience betrayal',
      18: '☢️ NUCLEAR: Defend (or condemn) Taylor Swift fans as passionate community or dangerous cult',
      19: '☢️ NUCLEAR: Argue (for or against) The Rock being charismatic star or overrated actor',
      20: '☢️ NUCLEAR: Defend (or attack) the Kardashians as cultural icons or society\'s downfall'
    }
  },

  work: {
    generic: [
      'Generate a hot take about work'
    ],
    focused: [
      // 'Share a controversial opinion about the 4-day work week',
      // 'Create a hot take about hustle culture and burnout',
      // 'Generate a bold opinion about workplace dress codes',
      // 'Make a divisive claim about open office layouts',
      // 'Write a hot take about unlimited PTO policies',
      // 'Share a controversial take on workplace small talk',
      // 'Create a bold opinion about company culture and perks',
      // 'Generate a divisive take on performance reviews',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any major company and generate a controversial take about working there',
      'Choose any business leader or CEO and share a divisive opinion about them',
      'Select any workplace trend and create a hot take about it',
      'Pick any industry and generate a bold opinion about its work culture',
      'Choose any job or profession and share a controversial take about it'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) working from home making employees productive or lazy',
      2:  '☢️ NUCLEAR: Defend (or condemn) unpaid internships as valuable opportunities or exploitation',
      3:  '☢️ NUCLEAR: Argue (for or against) 24/7 availability being dedication or work-life balance myth',
      4:  '☢️ NUCLEAR: Defend (or attack) quiet quitting as setting boundaries or lazy entitlement',
      5:  '☢️ NUCLEAR: Argue (for or against) minimum wage being livable or entry-level stepping stone',
      6:  '☢️ NUCLEAR: Defend (or oppose) workplace surveillance as productivity tool or privacy invasion',
      7:  '☢️ NUCLEAR: Argue (for or against) labor unions protecting workers or destroying business',
      8:  '☢️ NUCLEAR: Defend (or condemn) massive CEO pay as justified or obscene inequality',
      9:  '☢️ NUCLEAR: Argue (for or against) using sick days being responsible or showing weakness',
      10: '☢️ NUCLEAR: Defend (or oppose) at-will employment as business freedom or worker exploitation',
      11: '☢️ NUCLEAR: Argue (for or against) diversity programs being progress or reverse discrimination',
      12: '☢️ NUCLEAR: Defend (or condemn) hustle culture as success path or toxic burnout culture',
      13: '☢️ NUCLEAR: Argue (for or against) long work hours showing dedication or poor management',
      14: '☢️ NUCLEAR: Defend (or attack) corporate jargon as efficient communication or meaningless buzzwords',
      15: '☢️ NUCLEAR: Argue (for or against) team building activities being valuable or waste of time',
      16: '☢️ NUCLEAR: Defend (or condemn) open offices as collaborative spaces or productivity killers',
      17: '☢️ NUCLEAR: Argue (for or against) LinkedIn being professional networking or performative theater',
      18: '☢️ NUCLEAR: Defend (or attack) Amazon\'s workplace culture as efficient or inhumane',
      19: '☢️ NUCLEAR: Argue (for or against) tech company perks creating innovation or spoiled employees',
      20: '☢️ NUCLEAR: Defend (or condemn) Elon Musk\'s management as visionary or toxic leadership'
    }
  },

  pets: {
    generic: [
      'Generate a hot take about pets'
    ],
    focused: [
      // 'Share a controversial opinion about pet humanization',
      // 'Create a hot take about outdoor vs indoor cats',
      // 'Generate a bold opinion about breed-specific legislation',
      // 'Make a divisive claim about pet insurance necessity',
      // 'Write a hot take about raw food diets for pets',
      // 'Share a controversial take on emotional support animals',
      // 'Create a bold opinion about pet grooming frequency',
      // 'Generate a divisive take on pets in restaurants',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any specific dog or cat breed and generate a controversial take about it',
      'Choose any famous pet or animal celebrity and share a divisive opinion',
      'Select any pet-related trend and create a hot take about it',
      'Pick any pet product or brand and generate a bold opinion about it',
      'Choose any animal behavior topic and share a controversial take'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) cat people being more independent or antisocial than dog people',
      2:  '☢️ NUCLEAR: Defend (or condemn) pitbulls as misunderstood breeds or dangerous weapons',
      3:  '☢️ NUCLEAR: Argue (for or against) declawing cats being practical or inhumane mutilation',
      4:  '☢️ NUCLEAR: Defend (or attack) dressing pets in costumes as cute fun or animal humiliation',
      5:  '☢️ NUCLEAR: Argue (for or against) pets sleeping in beds being bonding or boundary issues',
      6:  '☢️ NUCLEAR: Defend (or condemn) small dogs as real dogs or overgrown angry rats',
      7:  '☢️ NUCLEAR: Argue (for or against) exotic pet ownership being passion or wildlife destruction',
      8:  '☢️ NUCLEAR: Defend (or attack) pet daycare as necessary service or money grab scam',
      9:  '☢️ NUCLEAR: Argue (for or against) leash laws being safety measures or government overreach',
      10: '☢️ NUCLEAR: Defend (or condemn) pet birthday parties as harmless fun or psychiatric concern',
      11: '☢️ NUCLEAR: Argue (for or against) designer dog breeds being cute companions or animal abuse',
      12: '☢️ NUCLEAR: Defend (or oppose) giving pets CBD as medical treatment or human projection',
      13: '☢️ NUCLEAR: Argue (for or against) emotional support animals being legitimate therapy or fake service dogs',
      14: '☢️ NUCLEAR: Defend (or condemn) pets on airplanes as accommodation rights or public health risk',
      15: '☢️ NUCLEAR: Argue (for or against) pet influencers being wholesome content or civilization decline',
      16: '☢️ NUCLEAR: Defend (or attack) Golden Retrievers as perfect family dogs or overrated basic pets',
      17: '☢️ NUCLEAR: Argue (for or against) Chihuahuas being loyal companions or evil demon rats',
      18: '☢️ NUCLEAR: Defend (or oppose) strict pet adoption requirements as animal protection or gatekeeping',
      19: '☢️ NUCLEAR: Argue (for or against) dog training shows being educational or animal exploitation',
      20: '☢️ NUCLEAR: Defend (or condemn) calling yourself "pet parent" as loving bond or delusional anthropomorphism'
    }
  },

  sports: {
    generic: [
      'Generate a hot take about sports'
    ],
    focused: [
      // 'Share a controversial opinion about athlete salaries',
      // 'Create a hot take about youth sports pressure',
      // 'Generate a bold opinion about sports betting legalization',
      // 'Make a divisive claim about performance enhancing drugs',
      // 'Write a hot take about college athlete compensation',
      // 'Share a controversial take on esports as real sports',
      // 'Create a bold opinion about sports fan behavior',
      // 'Generate a divisive take on instant replay in sports',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any famous athlete and generate a controversial take about them',
      'Choose any professional sports team and share a divisive opinion',
      'Select any sport and create a hot take about it being overrated or underrated',
      'Pick any sports controversy or scandal and generate a bold opinion',
      'Choose any sports league or organization and share a controversial take'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) participation trophies building confidence or creating entitlement',
      2:  '☢️ NUCLEAR: Defend (or attack) golf as legitimate sport or overpriced walking',
      3:  '☢️ NUCLEAR: Argue (for or against) baseball being America\'s pastime or boring relic',
      4:  '☢️ NUCLEAR: Defend (or condemn) soccer vs football as superior sport',
      5:  '☢️ NUCLEAR: Argue (for or against) Olympics being inspiring competition or corrupt spectacle',
      6:  '☢️ NUCLEAR: Defend (or attack) sports parents as supportive or toxic to kids',
      7:  '☢️ NUCLEAR: Argue (for or against) gym culture being motivational or intimidating gatekeeping',
      8:  '☢️ NUCLEAR: Defend (or condemn) CrossFit as elite fitness or dangerous cult',
      9:  '☢️ NUCLEAR: Argue (for or against) fantasy sports being harmless fun or gambling addiction',
      10: '☢️ NUCLEAR: Defend (or attack) sports commentators as insightful experts or biased blowhards',
      11: '☢️ NUCLEAR: Argue (for or against) basketball flopping being strategic or cheating disgrace',
      12: '☢️ NUCLEAR: Defend (or oppose) boxing vs MMA as superior combat sport',
      13: '☢️ NUCLEAR: Argue (for or against) NASCAR being real sport or glorified car commercial',
      14: '☢️ NUCLEAR: Defend (or ridicule) sports superstitions as psychological advantage or silly nonsense',
      15: '☢️ NUCLEAR: Argue (for or against) pickleball popularity being deserved or overhyped fad',
      16: '☢️ NUCLEAR: Defend (or condemn) Tom Brady as GOAT quarterback or system quarterback',
      17: '☢️ NUCLEAR: Argue (for or against) LeBron vs Jordan debate having clear winner',
      18: '☢️ NUCLEAR: Defend (or attack) NFL as great entertainment or brain damage factory',
      19: '☢️ NUCLEAR: Argue (for or against) Serena Williams being tennis GOAT or overrated',
      20: '☢️ NUCLEAR: Defend (or condemn) Tiger Woods as golf legend or cautionary tale'
    }
  },

  travel: {
    generic: [
      'Generate a hot take about travel'
    ],
    focused: [
      // 'Share a controversial opinion about tourist behavior',
      // 'Create a hot take about all-inclusive resorts',
      // 'Generate a bold opinion about travel influencers',
      // 'Make a divisive claim about airport security theater',
      // 'Write a hot take about cruise ships and environment',
      // 'Share a controversial take on solo travel safety',
      // 'Create a bold opinion about travel insurance',
      // 'Generate a divisive take on overtourism',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any popular tourist destination and generate a controversial take about it',
      'Choose any country or city and share a divisive opinion about visiting it',
      'Select any travel company or airline and create a hot take about it',
      'Pick any travel trend or phenomenon and generate a bold opinion',
      'Choose any famous landmark or attraction and share a controversial take'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) TSA security being necessary protection or theater',
      2:  '☢️ NUCLEAR: Defend (or condemn) airplane etiquette rules as courtesy or authoritarianism',
      3:  '☢️ NUCLEAR: Argue (for or against) hotel star ratings being accurate or marketing scam',
      4:  '☢️ NUCLEAR: Defend (or attack) travel photography as memory keeping or experience blocking',
      5:  '☢️ NUCLEAR: Argue (for or against) hostels being authentic travel or dirty backpacker nonsense',
      6:  '☢️ NUCLEAR: Defend (or condemn) tourist traps as legitimate business or visitor exploitation',
      7:  '☢️ NUCLEAR: Argue (for or against) carry-on only travel being smart or underprepared',
      8:  '☢️ NUCLEAR: Defend (or destroy) timeshares as great investment or financial trap',
      9:  '☢️ NUCLEAR: Argue (for or against) staycations being practical or giving up on life',
      10: '☢️ NUCLEAR: Defend (or oppose) holiday travel as tradition or masochistic torture',
      11: '☢️ NUCLEAR: Argue (for or against) resort fees being transparent pricing or hidden scam',
      12: '☢️ NUCLEAR: Defend (or attack) guided tours as educational or tourist factory processing',
      13: '☢️ NUCLEAR: Argue (for or against) travel rewards programs being worth it or corporate manipulation',
      14: '☢️ NUCLEAR: Defend (or condemn) destination weddings as dream celebration or guest burden',
      15: '☢️ NUCLEAR: Argue (for or against) van life being freedom or glorified homelessness',
      16: '☢️ NUCLEAR: Defend (or attack) Disney World for adults as magical or creepy arrested development',
      17: '☢️ NUCLEAR: Argue (for or against) Paris being overrated tourist trap or eternal masterpiece',
      18: '☢️ NUCLEAR: Defend (or condemn) Airbnb as travel innovation or housing market destroyer',
      19: '☢️ NUCLEAR: Argue (for or against) Las Vegas being adult playground or moral wasteland',
      20: '☢️ NUCLEAR: Defend (or oppose) Hawaii tourism as economic necessity or cultural destruction'
    }
  },

  relationships: {
    generic: [
      'Generate a hot take about relationships'
    ],
    focused: [
      // 'Share a controversial opinion about dating app culture',
      // 'Create a hot take about love languages validity',
      // 'Generate a bold opinion about relationship therapy',
      // 'Make a divisive claim about long-distance relationships',
      // 'Write a hot take about wedding industry costs',
      // 'Share a controversial take on social media and jealousy',
      // 'Create a bold opinion about relationship milestones',
      // 'Generate a divisive take on friends with benefits',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any celebrity couple and generate a controversial take about their relationship',
      'Choose any dating app or platform and share a divisive opinion about it',
      'Select any relationship trend and create a hot take about it',
      'Pick any famous breakup or divorce and generate a bold opinion about it',
      'Choose any relationship advice guru and share a controversial take'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) ghosting being cowardly or merciful way to end things',
      2:  '☢️ NUCLEAR: Defend (or attack) height preferences as natural attraction or shallow discrimination',
      3:  '☢️ NUCLEAR: Argue (for or against) splitting bills being equality or romance killer',
      4:  '☢️ NUCLEAR: Defend (or condemn) constant texting as connection or unhealthy obsession',
      5:  '☢️ NUCLEAR: Argue (for or against) public proposals being romantic or manipulative pressure',
      6:  '☢️ NUCLEAR: Defend (or oppose) bachelor/ette parties as celebration or cheating rehearsal',
      7:  '☢️ NUCLEAR: Argue (for or against) couples sharing passwords being trust or privacy violation',
      8:  '☢️ NUCLEAR: Defend (or condemn) age gap relationships as true love or power imbalance',
      9:  '☢️ NUCLEAR: Argue (for or against) relationship labels being clarity or relationship prison',
      10: '☢️ NUCLEAR: Defend (or attack) Valentine\'s Day as romantic or corporate manipulation',
      11: '☢️ NUCLEAR: Argue (for or against) couples\' social media as cute sharing or attention seeking',
      12: '☢️ NUCLEAR: Defend (or oppose) prenups as smart planning or marriage poison',
      13: '☢️ NUCLEAR: Argue (for or against) living together before marriage being wise or relationship killer',
      14: '☢️ NUCLEAR: Defend (or condemn) break etiquette rules as courtesy or unnecessary drama',
      15: '☢️ NUCLEAR: Argue (for or against) dating multiple people being exploration or emotional cheating',
      16: '☢️ NUCLEAR: Defend (or attack) Tinder culture as liberation or relationship destroyer',
      17: '☢️ NUCLEAR: Argue (for or against) The Bachelor being entertainment or toxic relationship model',
      18: '☢️ NUCLEAR: Defend (or ridicule) love at first sight as real phenomenon or Hollywood fantasy',
      19: '☢️ NUCLEAR: Argue (for or against) relationship podcasts being helpful or amateur therapy',
      20: '☢️ NUCLEAR: Defend (or condemn) couples therapy as relationship savior or admission of failure'
    }
  },

  life: {
    generic: [
      'Generate a hot take about life'
    ],
    focused: [
      // 'Share a controversial opinion about morning routines',
      // 'Create a hot take about life coaching industry',
      // 'Generate a bold opinion about self-help books',
      // 'Make a divisive claim about work-life balance myths',
      // 'Write a hot take about social media detoxes',
      // 'Share a controversial take on minimalism lifestyle',
      // 'Create a bold opinion about side hustles necessity',
      // 'Generate a divisive take on retirement planning',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any life guru or self-help expert and generate a controversial take about them',
      'Choose any popular lifestyle trend and share a divisive opinion about it',
      'Select any city or place and create a hot take about living there',
      'Pick any generational stereotype and generate a bold opinion about it',
      'Choose any life philosophy or movement and share a controversial take'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) adulting being harder now or every generation\'s excuse',
      2:  '☢️ NUCLEAR: Defend (or attack) New Year resolutions as motivation or self-deception',
      3:  '☢️ NUCLEAR: Argue (for or against) gratitude journaling being transformative or privileged nonsense',
      4:  '☢️ NUCLEAR: Defend (or condemn) meditation apps as accessibility or commercialized spirituality',
      5:  '☢️ NUCLEAR: Argue (for or against) life milestone pressure being motivation or toxic comparison',
      6:  '☢️ NUCLEAR: Defend (or attack) self-care culture as mental health or selfish indulgence',
      7:  '☢️ NUCLEAR: Argue (for or against) productivity hacks being life improvement or procrastination',
      8:  '☢️ NUCLEAR: Defend (or ridicule) manifestation as spiritual power or delusional thinking',
      9:  '☢️ NUCLEAR: Argue (for or against) personal branding being career necessity or narcissistic performance',
      10: '☢️ NUCLEAR: Defend (or condemn) imposter syndrome as humility or self-sabotage excuse',
      11: '☢️ NUCLEAR: Argue (for or against) FOMO being social media disease or natural human emotion',
      12: '☢️ NUCLEAR: Defend (or attack) gap years as valuable exploration or privileged procrastination',
      13: '☢️ NUCLEAR: Argue (for or against) searching for life purpose being growth or millennial obsession',
      14: '☢️ NUCLEAR: Defend (or ridicule) vision boards as manifestation tool or arts and crafts delusion',
      15: '☢️ NUCLEAR: Argue (for or against) influencer lifestyles being inspiring or toxic fantasy',
      16: '☢️ NUCLEAR: Defend (or condemn) millennials vs Gen Z as most struggling or most privileged',
      17: '☢️ NUCLEAR: Argue (for or against) Dave Ramsey\'s advice being financial wisdom or oversimplified',
      18: '☢️ NUCLEAR: Defend (or destroy) hustle culture as success mindset or mental health destroyer',
      19: '☢️ NUCLEAR: Argue (for or against) LinkedIn motivational posts being inspiration or performative cringe',
      20: '☢️ NUCLEAR: Defend (or oppose) "life begins at 40" as wisdom or consolation prize for wasted youth'
    }
  },

  wellness: {
    generic: [
      'Generate a hot take about wellness'
    ],
    focused: [
      // 'Share a controversial opinion about wellness industry pricing',
      // 'Create a hot take about mental health awareness campaigns',
      // 'Generate a bold opinion about alternative medicine',
      // 'Make a divisive claim about body positivity movement',
      // 'Write a hot take about fitness influencer culture',
      // 'Share a controversial take on juice cleanses and detoxes',
      // 'Create a bold opinion about therapy accessibility',
      // 'Generate a divisive take on wellness retreats',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any wellness guru or fitness influencer and generate a controversial take',
      'Choose any popular diet or wellness trend and share a divisive opinion',
      'Select any wellness product or supplement and create a hot take about it',
      'Pick any mental health topic and generate a bold opinion about it',
      'Choose any celebrity wellness brand and share a controversial take'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) gym memberships being health investment or corporate scam',
      2:  '☢️ NUCLEAR: Defend (or attack) yoga as spiritual practice or pretentious stretching',
      3:  '☢️ NUCLEAR: Argue (for or against) supplements industry being health necessity or expensive urine',
      4:  '☢️ NUCLEAR: Defend (or condemn) intermittent fasting as health optimization or eating disorder',
      5:  '☢️ NUCLEAR: Argue (for or against) essential oils being natural medicine or snake oil',
      6:  '☢️ NUCLEAR: Defend (or attack) chiropractic care as legitimate therapy or dangerous pseudoscience',
      7:  '☢️ NUCLEAR: Argue (for or against) wellness influencers being health educators or dangerous misinformation',
      8:  '☢️ NUCLEAR: Defend (or ridicule) cold plunges as biohacking or masochistic trend',
      9:  '☢️ NUCLEAR: Argue (for or against) meditation benefits being scientifically proven or placebo effect',
      10: '☢️ NUCLEAR: Defend (or condemn) therapy stigma as outdated or protecting mental toughness',
      11: '☢️ NUCLEAR: Argue (for or against) crystals and healing being spiritual power or expensive rocks',
      12: '☢️ NUCLEAR: Defend (or attack) keto diet culture as health revolution or dangerous fad',
      13: '☢️ NUCLEAR: Argue (for or against) Peloton culture being fitness community or expensive cult',
      14: '☢️ NUCLEAR: Defend (or condemn) sleep optimization as health priority or anxiety-inducing obsession',
      15: '☢️ NUCLEAR: Argue (for or against) wellness apps being helpful tools or data harvesting schemes',
      16: '☢️ NUCLEAR: Defend (or destroy) Gwyneth Paltrow\'s Goop as wellness innovation or dangerous quackery',
      17: '☢️ NUCLEAR: Argue (for or against) CrossFit being elite fitness or injury-inducing cult',
      18: '☢️ NUCLEAR: Defend (or attack) therapy speak as emotional intelligence or communication poison',
      19: '☢️ NUCLEAR: Argue (for or against) wellness toxic positivity being motivation or gaslighting',
      20: '☢️ NUCLEAR: Defend (or condemn) Joe Rogan health advice as practical wisdom or dangerous bro science'
    }
  },

  society: {
    generic: [
      'Generate a hot take about society'
    ],
    focused: [
      // 'Share a controversial opinion about cancel culture',
      // 'Create a hot take about generational wealth gaps',
      // 'Generate a bold opinion about social media activism',
      // 'Make a divisive claim about suburban vs urban living',
      // 'Write a hot take about influencer impact on youth',
      // 'Share a controversial take on traditional values',
      // 'Create a bold opinion about community involvement',
      // 'Generate a divisive take on social expectations',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any current social movement and generate a controversial take about it',
      'Choose any social media trend and share a divisive opinion about its impact',
      'Select any cultural phenomenon and create a hot take about it',
      'Pick any generational divide topic and generate a bold opinion',
      'Choose any societal norm and share a controversial take about it'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) Karen stereotype being legitimate concern or misogynistic meme',
      2:  '☢️ NUCLEAR: Defend (or attack) HOA regulations as property protection or authoritarian overreach',
      3:  '☢️ NUCLEAR: Argue (for or against) expanding tipping culture as worker support or wage theft excuse',
      4:  '☢️ NUCLEAR: Defend (or condemn) public behavior standards as civility or social control',
      5:  '☢️ NUCLEAR: Argue (for or against) neighborhood Facebook groups as community building or drama breeding',
      6:  '☢️ NUCLEAR: Defend (or attack) virtue signaling as social awareness or performative hypocrisy',
      7:  '☢️ NUCLEAR: Argue (for or against) small talk being social necessity or meaningless torture',
      8:  '☢️ NUCLEAR: Defend (or condemn) personal space boundaries as respect or antisocial behavior',
      9:  '☢️ NUCLEAR: Argue (for or against) phone use in public being normal evolution or social decay',
      10: '☢️ NUCLEAR: Defend (or attack) social media oversharing as authentic connection or narcissistic exhibition',
      11: '☢️ NUCLEAR: Argue (for or against) gender reveal parties being celebration or attention-seeking spectacle',
      12: '☢️ NUCLEAR: Defend (or condemn) participation culture as inclusivity or mediocrity worship',
      13: '☢️ NUCLEAR: Argue (for or against) helicopter parenting being protection or childhood destruction',
      14: '☢️ NUCLEAR: Defend (or oppose) social credit systems as behavior improvement or dystopian control',
      15: '☢️ NUCLEAR: Argue (for or against) pronoun usage being basic respect or forced speech',
      16: '☢️ NUCLEAR: Defend (or attack) "OK Boomer" as generational justice or ageist dismissal',
      17: '☢️ NUCLEAR: Argue (for or against) influencer culture being democratic fame or vapid narcissism',
      18: '☢️ NUCLEAR: Defend (or condemn) woke culture as social progress or authoritarian ideology',
      19: '☢️ NUCLEAR: Argue (for or against) Gen Alpha iPad kids being adapted or developmentally damaged',
      20: '☢️ NUCLEAR: Defend (or attack) main character syndrome as self-empowerment or toxic narcissism'
    }
  },

  environment: {
    generic: [
      'Generate a hot take about the environment'
    ],
    focused: [
      // 'Share a controversial opinion about individual vs corporate responsibility',
      // 'Create a hot take about electric vehicle adoption',
      // 'Generate a bold opinion about renewable energy transition',
      // 'Make a divisive claim about plastic ban effectiveness',
      // 'Write a hot take about carbon offset programs',
      // 'Share a controversial take on environmental activism',
      // 'Create a bold opinion about sustainable fashion',
      // 'Generate a divisive take on green technology',
      // Open-ended prompts - let AI choose from its vast knowledge
      'Pick any major company and generate a controversial take about their environmental impact',
      'Choose any environmental activist or organization and share a divisive opinion',
      'Select any green technology or renewable energy topic and create a hot take',
      'Pick any environmental disaster or issue and generate a bold opinion',
      'Choose any climate change topic and share a controversial take about it'
    ],
    rngSpice: {
      1:  '☢️ NUCLEAR: Argue (for or against) paper vs plastic straws debate being meaningful or distraction',
      2:  '☢️ NUCLEAR: Defend (or attack) recycling as environmental solution or feel-good theater',
      3:  '☢️ NUCLEAR: Argue (for or against) nuclear energy being green solution or dangerous gamble',
      4:  '☢️ NUCLEAR: Defend (or condemn) individual climate action as necessary or corporate distraction',
      5:  '☢️ NUCLEAR: Argue (for or against) reusable shopping bags being helpful or bacteria breeding grounds',
      6:  '☢️ NUCLEAR: Defend (or attack) lawn care as property maintenance or environmental destruction',
      7:  '☢️ NUCLEAR: Argue (for or against) fast fashion boycotts as activism or privileged virtue signaling',
      8:  '☢️ NUCLEAR: Defend (or condemn) veganism as planetary necessity or personal choice obsession',
      9:  '☢️ NUCLEAR: Argue (for or against) carbon footprint shaming as accountability or classist judgment',
      10: '☢️ NUCLEAR: Defend (or attack) expensive eco-products as investment or green capitalism scam',
      11: '☢️ NUCLEAR: Argue (for or against) electric car batteries being clean or mining disaster',
      12: '☢️ NUCLEAR: Defend (or condemn) composting as easy responsibility or urban impossibility',
      13: '☢️ NUCLEAR: Argue (for or against) greenwashing being corporate deception or environmental progress',
      14: '☢️ NUCLEAR: Defend (or attack) environmental documentaries as education or alarmist propaganda',
      15: '☢️ NUCLEAR: Argue (for or against) climate protests being necessary or counterproductive disruption',
      16: '☢️ NUCLEAR: Defend (or condemn) Greta Thunberg as climate hero or manipulated child activist',
      17: '☢️ NUCLEAR: Argue (for or against) Tesla being environmental savior or overhyped status symbol',
      18: '☢️ NUCLEAR: Defend (or attack) plastic surgery waste as serious issue or ridiculous nitpicking',
      19: '☢️ NUCLEAR: Argue (for or against) billionaire space travel being innovation or environmental crime',
      20: '☢️ NUCLEAR: Defend (or condemn) environmental virtue signaling as awareness or performative hypocrisy'
    }
  }
};

// Helper function to get a prompt based on D20 roll
export const getPromptByD20 = (category: string, d20Roll?: number): string => {
  const categoryPrompts = ENHANCED_PROMPTS[category];
  
  if (!categoryPrompts) {
    // Fallback to a generic prompt if category not found
    return 'Generate a controversial hot take';
  }
  
  // If D20 roll is provided, use the appropriate tier:
  // 19-20: Nuclear rngSpice (10%)
  // 11-18: Focused prompts (40%)
  // 1-10: Generic prompts (50%)
  if (d20Roll) {
    if (d20Roll >= 19 && d20Roll <= 20) {
      // NUCLEAR tier - randomly select from all 20 nuclear prompts
      const nuclearKeys = Object.keys(categoryPrompts.rngSpice).map(k => parseInt(k));
      const randomKey = nuclearKeys[Math.floor(Math.random() * nuclearKeys.length)];
      return categoryPrompts.rngSpice[randomKey] || categoryPrompts.focused[0];
    } else if (d20Roll >= 11 && d20Roll <= 18) {
      // Focused tier - randomly select from focused prompts
      const focusedPrompts = categoryPrompts.focused;
      return focusedPrompts[Math.floor(Math.random() * focusedPrompts.length)];
    } else {
      // Generic tier (1-10)
      const genericPrompts = categoryPrompts.generic;
      return genericPrompts[Math.floor(Math.random() * genericPrompts.length)];
    }
  }
  
  // If no D20 roll provided, default to focused prompts
  const focusedPrompts = categoryPrompts.focused;
  return focusedPrompts[Math.floor(Math.random() * focusedPrompts.length)];
};

// Helper function to get all prompts for a category (for debugging)
export const getAllPromptsForCategory = (category: string): CategoryPrompts | null => {
  return ENHANCED_PROMPTS[category] || null;
};