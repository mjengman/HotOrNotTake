// Enhanced Three-Tier Prompt System for AI Content Generation
// Each category has: generic (fallback), focused (varied topics), and rngSpice (D20 specific/controversial)

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
      'Share a bold opinion about the role of government in everyday life',
      'Generate a controversial take about the two-party system in America',
      'Create a divisive opinion about voting rights and access',
      'Write a hot take on political correctness or free speech in politics',
      'Make a bold claim about political polarization and echo chambers',
      'Share a controversial take about generational politics (Boomers vs Gen Z)',
      'Create a hot take about billionaires influencing elections',
      'Generate a divisive opinion on political debates and their usefulness'
    ],
    rngSpice: {
      1:  'Generate a hot take about the U.S. Constitution',
      2:  'Create a controversial opinion on term limits for Congress',
      3:  'Share a bold take about gerrymandering and redistricting',
      4:  'Generate a divisive opinion about mail-in voting and ballot security',
      5:  'Make a hot take about the power of unelected judges',
      6:  'Write a controversial opinion about the role of the Supreme Court',
      7:  'Share a hot take about presidential executive orders',
      8:  'Create a controversial opinion about political lobbying',
      9:  'Make a divisive claim about the filibuster in the Senate',
      10: 'Generate a bold opinion about the influence of cable news',
      11: 'Share a hot take about third parties like the Libertarians or Greens',
      12: 'Write a controversial take about political donations from corporations',
      13: 'Generate a divisive opinion about campaign ads and misinformation',
      14: 'Create a hot take about student loan forgiveness as a political tool',
      15: 'Create a controversial take on political memes or TikTok activism',
      16: 'Generate a hot take about the role of money in Super PACs',
      17: 'Share a divisive opinion about the Electoral College',
      18: 'Create a controversial opinion about Fox News vs MSNBC',
      19: 'Generate a hot take about Kamala Harris',
      20: 'Generate a hot take about Donald Trump'
    }
  },

  food: {
    generic: [
      'Generate a hot take about food'
    ],
    focused: [
      'Share a controversial opinion about plant-based meat alternatives',
      'Create a hot take about food delivery apps ruining restaurants',
      'Generate a bold opinion about cooking at home vs eating out',
      'Make a divisive claim about food allergies and dietary restrictions',
      'Write a hot take about portion sizes in American restaurants',
      'Share a controversial take on organic vs conventional produce',
      'Create a bold opinion about celebrity chef restaurants',
      'Generate a divisive take on food photography and Instagram culture'
    ],
    rngSpice: {
      1:  'Generate a hot take about pineapple on pizza',
      2:  'Create a controversial opinion about ketchup on steak',
      3:  'Share a bold take about well-done vs rare meat',
      4:  'Generate a divisive opinion about breakfast for dinner',
      5:  'Make a hot take about cereal as a legitimate meal',
      6:  'Write a controversial opinion about coffee vs tea superiority',
      7:  'Share a hot take about gluten-free diets for non-celiacs',
      8:  'Create a controversial opinion about food expiration dates',
      9:  'Make a divisive claim about tipping culture at restaurants',
      10: 'Generate a bold opinion about fast food quality',
      11: 'Share a hot take about wine pairing pretentiousness',
      12: 'Write a controversial take about veganism as a lifestyle',
      13: 'Generate a divisive opinion about meal prep Sunday culture',
      14: 'Create a hot take about avocado toast and millennials',
      15: 'Create a controversial take on food trucks vs restaurants',
      16: 'Generate a hot take about Gordon Ramsay',
      17: 'Share a divisive opinion about Starbucks coffee',
      18: 'Create a controversial opinion about McDonald\'s',
      19: 'Generate a hot take about Chipotle',
      20: 'Generate a hot take about Guy Fieri and Flavortown'
    }
  },

  technology: {
    generic: [
      'Generate a hot take about technology'
    ],
    focused: [
      'Share a controversial opinion about screen time and digital wellness',
      'Create a hot take about the metaverse and virtual reality',
      'Generate a bold opinion about cryptocurrency and NFTs',
      'Make a divisive claim about tech company monopolies',
      'Write a hot take about online privacy and data collection',
      'Share a controversial take on remote work technology',
      'Create a bold opinion about AI replacing human jobs',
      'Generate a divisive take on social media\'s impact on society'
    ],
    rngSpice: {
      1:  'Generate a hot take about smartphone addiction',
      2:  'Create a controversial opinion about 5G conspiracy theories',
      3:  'Share a bold take about right to repair laws',
      4:  'Generate a divisive opinion about facial recognition technology',
      5:  'Make a hot take about subscription services everywhere',
      6:  'Write a controversial opinion about tech bros culture',
      7:  'Share a hot take about coding bootcamps vs CS degrees',
      8:  'Create a controversial opinion about open source vs proprietary',
      9:  'Make a divisive claim about tech support and customer service',
      10: 'Generate a bold opinion about planned obsolescence',
      11: 'Share a hot take about password requirements',
      12: 'Write a controversial take about two-factor authentication',
      13: 'Generate a divisive opinion about cloud storage vs local',
      14: 'Create a hot take about software update notifications',
      15: 'Create a controversial take on tech influencers',
      16: 'Generate a hot take about Apple vs Android',
      17: 'Share a divisive opinion about TikTok',
      18: 'Create a controversial opinion about Elon Musk',
      19: 'Generate a hot take about Mark Zuckerberg and Meta',
      20: 'Generate a hot take about ChatGPT and AI chatbots'
    }
  },

  entertainment: {
    generic: [
      'Generate a hot take about entertainment'
    ],
    focused: [
      'Share a controversial opinion about remake culture in Hollywood',
      'Create a hot take about binge-watching vs weekly releases',
      'Generate a bold opinion about celebrity culture and parasocial relationships',
      'Make a divisive claim about award shows and their relevance',
      'Write a hot take about streaming service proliferation',
      'Share a controversial take on reality TV\'s impact on society',
      'Create a bold opinion about movie theater experiences',
      'Generate a divisive take on influencer entertainment'
    ],
    rngSpice: {
      1:  'Generate a hot take about superhero movie fatigue',
      2:  'Create a controversial opinion about dubbed vs subtitled content',
      3:  'Share a bold take about spoiler culture and etiquette',
      4:  'Generate a divisive opinion about laugh tracks in sitcoms',
      5:  'Make a hot take about musical episodes in TV shows',
      6:  'Write a controversial opinion about reboots and sequels',
      7:  'Share a hot take about true crime obsession',
      8:  'Create a controversial opinion about concert ticket prices',
      9:  'Make a divisive claim about autotune in music',
      10: 'Generate a bold opinion about reaction videos',
      11: 'Share a hot take about podcast oversaturation',
      12: 'Write a controversial take about fanfiction and fan culture',
      13: 'Generate a divisive opinion about CGI vs practical effects',
      14: 'Create a hot take about Game of Thrones or Harry Potter or Star Wars',
      15: 'Create a controversial take on TikTok dances',
      16: 'Generate a hot take about Marvel vs DC',
      17: 'Share a divisive opinion about Netflix',
      18: 'Create a controversial opinion about Taylor Swift',
      19: 'Generate a hot take about The Rock (Dwayne Johnson)',
      20: 'Generate a hot take about the Kardashians'
    }
  },

  work: {
    generic: [
      'Generate a hot take about work'
    ],
    focused: [
      'Share a controversial opinion about the 4-day work week',
      'Create a hot take about hustle culture and burnout',
      'Generate a bold opinion about workplace dress codes',
      'Make a divisive claim about open office layouts',
      'Write a hot take about unlimited PTO policies',
      'Share a controversial take on workplace small talk',
      'Create a bold opinion about company culture and perks',
      'Generate a divisive take on performance reviews'
    ],
    rngSpice: {
      1:  'Generate a hot take about working from home permanently',
      2:  'Create a controversial opinion about LinkedIn culture',
      3:  'Share a bold take about unpaid internships',
      4:  'Generate a divisive opinion about email after work hours',
      5:  'Make a hot take about team building activities',
      6:  'Write a controversial opinion about office coffee quality',
      7:  'Share a hot take about Slack vs email communication',
      8:  'Create a controversial opinion about standing desks',
      9:  'Make a divisive claim about lunch break duration',
      10: 'Generate a bold opinion about workplace surveillance',
      11: 'Share a hot take about corporate jargon and buzzwords',
      12: 'Write a controversial take about exit interviews',
      13: 'Generate a divisive opinion about workplace birthday celebrations',
      14: 'Create a hot take about casual Friday dress codes',
      15: 'Create a controversial take on quiet quitting',
      16: 'Generate a hot take about Zoom meeting fatigue',
      17: 'Share a divisive opinion about WeWork and coworking',
      18: 'Create a controversial opinion about Amazon workplace culture',
      19: 'Generate a hot take about Google employee perks',
      20: 'Generate a hot take about Elon Musk as a boss'
    }
  },

  pets: {
    generic: [
      'Generate a hot take about pets'
    ],
    focused: [
      'Share a controversial opinion about pet humanization',
      'Create a hot take about outdoor vs indoor cats',
      'Generate a bold opinion about breed-specific legislation',
      'Make a divisive claim about pet insurance necessity',
      'Write a hot take about raw food diets for pets',
      'Share a controversial take on emotional support animals',
      'Create a bold opinion about pet grooming frequency',
      'Generate a divisive take on pets in restaurants'
    ],
    rngSpice: {
      1:  'Generate a hot take about dogs vs cats superiority',
      2:  'Create a controversial opinion about pitbull breeds',
      3:  'Share a bold take about declawing cats',
      4:  'Generate a divisive opinion about pet clothing and costumes',
      5:  'Make a hot take about pets sleeping in human beds',
      6:  'Write a controversial opinion about dog parks etiquette',
      7:  'Share a hot take about exotic pets as companions',
      8:  'Create a controversial opinion about pet daycare necessity',
      9:  'Make a divisive claim about leash laws',
      10: 'Generate a bold opinion about pet birthday parties',
      11: 'Share a hot take about designer dog breeds',
      12: 'Write a controversial take about pet CBD products',
      13: 'Generate a divisive opinion about service dog regulations',
      14: 'Create a hot take about pets on airplanes',
      15: 'Create a controversial take on pet influencers',
      16: 'Generate a hot take about Golden Retrievers',
      17: 'Share a divisive opinion about Chihuahuas',
      18: 'Create a controversial opinion about pet adoption requirements',
      19: 'Generate a hot take about Cesar Millan (Dog Whisperer)',
      20: 'Generate a hot take about cats being better than dogs'
    }
  },

  sports: {
    generic: [
      'Generate a hot take about sports'
    ],
    focused: [
      'Share a controversial opinion about athlete salaries',
      'Create a hot take about youth sports pressure',
      'Generate a bold opinion about sports betting legalization',
      'Make a divisive claim about performance enhancing drugs',
      'Write a hot take about college athlete compensation',
      'Share a controversial take on esports as real sports',
      'Create a bold opinion about sports fan behavior',
      'Generate a divisive take on instant replay in sports'
    ],
    rngSpice: {
      1:  'Generate a hot take about participation trophies',
      2:  'Create a controversial opinion about golf as a sport',
      3:  'Share a bold take about baseball being boring',
      4:  'Generate a divisive opinion about soccer vs football',
      5:  'Make a hot take about Olympics relevance',
      6:  'Write a controversial opinion about sports parents',
      7:  'Share a hot take about gym culture and etiquette',
      8:  'Create a controversial opinion about CrossFit',
      9:  'Make a divisive claim about fantasy sports',
      10: 'Generate a bold opinion about sports commentators',
      11: 'Share a hot take about basketball flopping',
      12: 'Write a controversial take about boxing vs MMA',
      13: 'Generate a divisive opinion about NASCAR as a sport',
      14: 'Create a hot take about sports superstitions',
      15: 'Create a controversial take on pickleball popularity',
      16: 'Generate a hot take about Tom Brady',
      17: 'Share a divisive opinion about LeBron vs Jordan',
      18: 'Create a controversial opinion about the NFL',
      19: 'Generate a hot take about Serena Williams',
      20: 'Generate a hot take about Tiger Woods'
    }
  },

  travel: {
    generic: [
      'Generate a hot take about travel'
    ],
    focused: [
      'Share a controversial opinion about tourist behavior',
      'Create a hot take about all-inclusive resorts',
      'Generate a bold opinion about travel influencers',
      'Make a divisive claim about airport security theater',
      'Write a hot take about cruise ships and environment',
      'Share a controversial take on solo travel safety',
      'Create a bold opinion about travel insurance',
      'Generate a divisive take on overtourism'
    ],
    rngSpice: {
      1:  'Generate a hot take about TSA and airport security',
      2:  'Create a controversial opinion about airplane etiquette',
      3:  'Share a bold take about hotel star ratings',
      4:  'Generate a divisive opinion about travel photography',
      5:  'Make a hot take about hostel vs hotel stays',
      6:  'Write a controversial opinion about tourist traps',
      7:  'Share a hot take about carry-on only travel',
      8:  'Create a controversial opinion about timeshares',
      9:  'Make a divisive claim about staycations vs vacations',
      10: 'Generate a bold opinion about travel during holidays',
      11: 'Share a hot take about resort fees and hidden charges',
      12: 'Write a controversial take about guided tours vs solo',
      13: 'Generate a divisive opinion about travel rewards programs',
      14: 'Create a hot take about destination weddings',
      15: 'Create a controversial take on van life trend',
      16: 'Generate a hot take about Disney World for adults',
      17: 'Share a divisive opinion about Paris being overrated',
      18: 'Create a controversial opinion about Airbnb',
      19: 'Generate a hot take about Las Vegas',
      20: 'Generate a hot take about Hawaii tourism impact'
    }
  },

  relationships: {
    generic: [
      'Generate a hot take about relationships'
    ],
    focused: [
      'Share a controversial opinion about dating app culture',
      'Create a hot take about love languages validity',
      'Generate a bold opinion about relationship therapy',
      'Make a divisive claim about long-distance relationships',
      'Write a hot take about wedding industry costs',
      'Share a controversial take on social media and jealousy',
      'Create a bold opinion about relationship milestones',
      'Generate a divisive take on friends with benefits'
    ],
    rngSpice: {
      1:  'Generate a hot take about ghosting in dating',
      2:  'Create a controversial opinion about height preferences',
      3:  'Share a bold take about splitting the bill on dates',
      4:  'Generate a divisive opinion about texting frequency',
      5:  'Make a hot take about public proposals',
      6:  'Write a controversial opinion about bachelor/ette parties',
      7:  'Share a hot take about couples sharing passwords',
      8:  'Create a controversial opinion about age gap relationships',
      9:  'Make a divisive claim about relationship labels',
      10: 'Generate a bold opinion about Valentine\'s Day',
      11: 'Share a hot take about couples\' social media accounts',
      12: 'Write a controversial take about prenuptial agreements',
      13: 'Generate a divisive opinion about living together before marriage',
      14: 'Create a hot take about relationship break etiquette',
      15: 'Create a controversial take on dating multiple people',
      16: 'Generate a hot take about Tinder and hookup culture',
      17: 'Share a divisive opinion about The Bachelor franchise',
      18: 'Create a controversial opinion about love at first sight',
      19: 'Generate a hot take about relationship advice podcasts',
      20: 'Generate a hot take about couples therapy stigma'
    }
  },

  life: {
    generic: [
      'Generate a hot take about life'
    ],
    focused: [
      'Share a controversial opinion about morning routines',
      'Create a hot take about life coaching industry',
      'Generate a bold opinion about self-help books',
      'Make a divisive claim about work-life balance myths',
      'Write a hot take about social media detoxes',
      'Share a controversial take on minimalism lifestyle',
      'Create a bold opinion about side hustles necessity',
      'Generate a divisive take on retirement planning'
    ],
    rngSpice: {
      1:  'Generate a hot take about adulting difficulties',
      2:  'Create a controversial opinion about New Year resolutions',
      3:  'Share a bold take about gratitude journaling',
      4:  'Generate a divisive opinion about meditation apps',
      5:  'Make a hot take about life milestone pressure',
      6:  'Write a controversial opinion about self-care culture',
      7:  'Share a hot take about productivity hacks',
      8:  'Create a controversial opinion about manifestation',
      9:  'Make a divisive claim about personal branding',
      10: 'Generate a bold opinion about imposter syndrome',
      11: 'Share a hot take about FOMO and social media',
      12: 'Write a controversial take about gap years',
      13: 'Generate a divisive opinion about life purpose searching',
      14: 'Create a hot take about vision boards effectiveness',
      15: 'Create a controversial take on influencer lifestyles',
      16: 'Generate a hot take about millennials vs Gen Z',
      17: 'Share a divisive opinion about Dave Ramsey\'s advice',
      18: 'Create a controversial opinion about hustle culture',
      19: 'Generate a hot take about LinkedIn motivational posts',
      20: 'Generate a hot take about life begins at 40 saying'
    }
  },

  wellness: {
    generic: [
      'Generate a hot take about wellness'
    ],
    focused: [
      'Share a controversial opinion about wellness industry pricing',
      'Create a hot take about mental health awareness campaigns',
      'Generate a bold opinion about alternative medicine',
      'Make a divisive claim about body positivity movement',
      'Write a hot take about fitness influencer culture',
      'Share a controversial take on juice cleanses and detoxes',
      'Create a bold opinion about therapy accessibility',
      'Generate a divisive take on wellness retreats'
    ],
    rngSpice: {
      1:  'Generate a hot take about gym memberships waste',
      2:  'Create a controversial opinion about yoga pretentiousness',
      3:  'Share a bold take about supplements industry',
      4:  'Generate a divisive opinion about intermittent fasting',
      5:  'Make a hot take about essential oils effectiveness',
      6:  'Write a controversial opinion about chiropractic care',
      7:  'Share a hot take about wellness influencers',
      8:  'Create a controversial opinion about cold plunges',
      9:  'Make a divisive claim about meditation benefits',
      10: 'Generate a bold opinion about therapy stigma',
      11: 'Share a hot take about crystals and healing',
      12: 'Write a controversial take about keto diet culture',
      13: 'Generate a divisive opinion about Peloton cult',
      14: 'Create a hot take about sleep optimization obsession',
      15: 'Create a controversial take on wellness apps',
      16: 'Generate a hot take about Gwyneth Paltrow\'s Goop',
      17: 'Share a divisive opinion about CrossFit',
      18: 'Create a controversial opinion about therapy speak',
      19: 'Generate a hot take about wellness toxic positivity',
      20: 'Generate a hot take about Joe Rogan health advice'
    }
  },

  society: {
    generic: [
      'Generate a hot take about society'
    ],
    focused: [
      'Share a controversial opinion about cancel culture',
      'Create a hot take about generational wealth gaps',
      'Generate a bold opinion about social media activism',
      'Make a divisive claim about suburban vs urban living',
      'Write a hot take about influencer impact on youth',
      'Share a controversial take on traditional values',
      'Create a bold opinion about community involvement',
      'Generate a divisive take on social expectations'
    ],
    rngSpice: {
      1:  'Generate a hot take about Karen stereotype',
      2:  'Create a controversial opinion about HOA regulations',
      3:  'Share a bold take about tipping culture expansion',
      4:  'Generate a divisive opinion about public behavior standards',
      5:  'Make a hot take about neighborhood Facebook groups',
      6:  'Write a controversial opinion about virtue signaling',
      7:  'Share a hot take about small talk necessity',
      8:  'Create a controversial opinion about personal space',
      9:  'Make a divisive claim about phone use in public',
      10: 'Generate a bold opinion about social media oversharing',
      11: 'Share a hot take about gender reveal parties',
      12: 'Write a controversial take about participation culture',
      13: 'Generate a divisive opinion about helicopter parenting',
      14: 'Create a hot take about social credit systems',
      15: 'Create a controversial take on pronouns usage',
      16: 'Generate a hot take about OK Boomer phrase',
      17: 'Share a divisive opinion about influencer culture',
      18: 'Create a controversial opinion about woke culture',
      19: 'Generate a hot take about Gen Alpha iPad kids',
      20: 'Generate a hot take about main character syndrome'
    }
  },

  environment: {
    generic: [
      'Generate a hot take about the environment'
    ],
    focused: [
      'Share a controversial opinion about individual vs corporate responsibility',
      'Create a hot take about electric vehicle adoption',
      'Generate a bold opinion about renewable energy transition',
      'Make a divisive claim about plastic ban effectiveness',
      'Write a hot take about carbon offset programs',
      'Share a controversial take on environmental activism',
      'Create a bold opinion about sustainable fashion',
      'Generate a divisive take on green technology'
    ],
    rngSpice: {
      1:  'Generate a hot take about paper vs plastic straws',
      2:  'Create a controversial opinion about recycling effectiveness',
      3:  'Share a bold take about nuclear energy as green',
      4:  'Generate a divisive opinion about climate change solutions',
      5:  'Make a hot take about reusable shopping bags',
      6:  'Write a controversial opinion about lawn care impact',
      7:  'Share a hot take about fast fashion boycotts',
      8:  'Create a controversial opinion about veganism for planet',
      9:  'Make a divisive claim about carbon footprint shaming',
      10: 'Generate a bold opinion about eco-friendly products cost',
      11: 'Share a hot take about electric car batteries',
      12: 'Write a controversial take about composting difficulty',
      13: 'Generate a divisive opinion about greenwashing',
      14: 'Create a hot take about environmental documentaries',
      15: 'Create a controversial take on climate protests',
      16: 'Generate a hot take about Greta Thunberg',
      17: 'Share a divisive opinion about Tesla',
      18: 'Create a controversial opinion about plastic surgery waste',
      19: 'Generate a hot take about billionaire space travel',
      20: 'Generate a hot take about environmental virtue signaling'
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
  
  // If D20 roll is provided and it's 16-20, use rngSpice
  if (d20Roll && d20Roll >= 16 && d20Roll <= 20) {
    return categoryPrompts.rngSpice[d20Roll] || categoryPrompts.focused[0];
  }
  
  // Otherwise, randomly select from focused prompts
  const focusedPrompts = categoryPrompts.focused;
  return focusedPrompts[Math.floor(Math.random() * focusedPrompts.length)];
};

// Helper function to get all prompts for a category (for debugging)
export const getAllPromptsForCategory = (category: string): CategoryPrompts | null => {
  return ENHANCED_PROMPTS[category] || null;
};