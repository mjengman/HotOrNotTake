// D4/D20 Personality Enhancement System
// Adds diverse voices and specific references to AI-generated content

interface PersonalityContext {
  isPersonalityMode: boolean;
  archetype?: string;
  specificReference?: string;
  toneModifiers: string[];
  personalityPrompt: string;
}

// Personality archetypes (D4 roll = 1, then D20 rolls 1-15)
const PERSONALITY_ARCHETYPES = {
  contrarian: {
    name: 'The Contrarian',
    description: 'Always disagrees with popular opinion',
    toneModifiers: ['dismissive', 'skeptical', 'blunt'],
    phrases: ['overrated', 'overhyped', 'just admit it', 'stop pretending', 'unpopular truth'],
    promptModifier: 'Generate a contrarian take that goes against popular opinion. Be dismissive of widely accepted beliefs. Use phrases like "overrated" or "just admit it".'
  },
  nostalgist: {
    name: 'The Nostalgist', 
    description: 'Everything was better in the past',
    toneModifiers: ['wistful', 'disappointed', 'yearning'],
    phrases: ['peaked in', 'was better when', 'ruined by', 'golden age', 'downhill since'],
    promptModifier: 'Generate a nostalgic take about how things were better before. Use phrases like "peaked in" or "was better when". Sound like someone longing for the past.'
  },
  maximalist: {
    name: 'The Maximalist',
    description: 'More is always better',
    toneModifiers: ['enthusiastic', 'excessive', 'dramatic'],
    phrases: ['not enough', 'needs more', 'go big or go home', 'take it to the extreme', 'why settle'],
    promptModifier: 'Generate a maximalist take that argues for excess. Use phrases like "needs more" or "go big or go home". Sound enthusiastic about extremes.'
  },
  minimalist: {
    name: 'The Minimalist',
    description: 'Simplicity and less is better', 
    toneModifiers: ['zen', 'practical', 'efficient'],
    phrases: ['unnecessarily complex', 'just use', 'all you need is', 'overcomplicating', 'simple solution'],
    promptModifier: 'Generate a minimalist take that advocates for simplicity. Use phrases like "unnecessarily complex" or "all you need is". Sound practical and efficient.'
  },
  cynic: {
    name: 'The Cynic',
    description: 'Sees through marketing and BS',
    toneModifiers: ['sarcastic', 'world-weary', 'knowing'],
    phrases: ['just marketing', 'scam disguised as', 'follow the money', 'wake up people', 'obvious cash grab'],
    promptModifier: 'Generate a cynical take that exposes hidden motives. Use phrases like "just marketing" or "obvious cash grab". Sound like someone who sees through the BS.'
  },
  optimist: {
    name: 'The Optimist',
    description: 'Always sees the bright side and potential',
    toneModifiers: ['enthusiastic', 'hopeful', 'uplifting'],
    phrases: ['actually amazing', 'so much potential', 'game changer', 'revolutionary', 'life changing'],
    promptModifier: 'Generate an optimistic take that finds the positive in something others might criticize. Use phrases like "actually amazing" or "game changer". Sound genuinely excited and hopeful.'
  },
  trendsetter: {
    name: 'The Trendsetter',
    description: 'Always ahead of the curve, predicting what\'s next',
    toneModifiers: ['confident', 'prescient', 'cutting-edge'],
    phrases: ['calling it now', 'mark my words', 'ahead of the curve', 'next big thing', 'you heard it here first'],
    promptModifier: 'Generate a trendsetting take that predicts future developments or identifies emerging patterns. Use phrases like "calling it now" or "mark my words". Sound like someone who spots trends early.'
  },
  everyman: {
    name: 'The Everyman',
    description: 'Common sense, relatable, down-to-earth perspective',
    toneModifiers: ['relatable', 'practical', 'common-sense'],
    phrases: ['let\'s be real', 'common sense', 'normal people', 'in the real world', 'most folks'],
    promptModifier: 'Generate an everyman take that represents common sense or typical person perspective. Use phrases like "let\'s be real" or "normal people". Sound relatable and grounded.'
  },
  elitist: {
    name: 'The Elitist',
    description: 'Superior taste and refined standards',
    toneModifiers: ['sophisticated', 'discerning', 'superior'],
    phrases: ['refined taste', 'sophisticated palate', 'true connoisseur', 'uncultured masses', 'quality over quantity'],
    promptModifier: 'Generate an elitist take that emphasizes superior taste or standards. Use phrases like "refined taste" or "true connoisseur". Sound sophisticated and slightly condescending.'
  },
  rebel: {
    name: 'The Rebel',
    description: 'Questions authority and breaks rules',
    toneModifiers: ['defiant', 'anti-establishment', 'rebellious'],
    phrases: ['screw the rules', 'stick it to the man', 'question everything', 'break free', 'fight the system'],
    promptModifier: 'Generate a rebellious take that challenges authority or conventional rules. Use phrases like "screw the rules" or "fight the system". Sound defiant and anti-establishment.'
  },
  perfectionist: {
    name: 'The Perfectionist',
    description: 'Extremely high standards, nothing is ever good enough',
    toneModifiers: ['exacting', 'critical', 'demanding'],
    phrases: ['not good enough', 'should be better', 'half-assed', 'attention to detail', 'do it right'],
    promptModifier: 'Generate a perfectionist take that criticizes low standards or poor execution. Use phrases like "not good enough" or "do it right". Sound demanding and critical of mediocrity.'
  },
  pragmatist: {
    name: 'The Pragmatist',
    description: 'Practical solutions over idealism',
    toneModifiers: ['realistic', 'practical', 'no-nonsense'],
    phrases: ['what actually works', 'in practice', 'realistic solution', 'get real', 'bottom line'],
    promptModifier: 'Generate a pragmatic take that focuses on practical solutions over theory. Use phrases like "what actually works" or "get real". Sound realistic and results-oriented.'
  },
  provocateur: {
    name: 'The Provocateur',
    description: 'Loves to stir the pot and get reactions',
    toneModifiers: ['provocative', 'inflammatory', 'attention-grabbing'],
    phrases: ['hot take', 'unpopular opinion', 'fight me', 'change my mind', 'triggered'],
    promptModifier: 'Generate a provocative take designed to get strong reactions. Use phrases like "fight me" or "unpopular opinion". Sound intentionally controversial and attention-seeking.'
  },
  hipster: {
    name: 'The Hipster',
    description: 'Liked it before it was cool, alternative tastes',
    toneModifiers: ['ironic', 'alternative', 'counter-cultural'],
    phrases: ['before it was cool', 'too mainstream', 'sell out', 'authentic', 'underground'],
    promptModifier: 'Generate a hipster take that emphasizes alternative or pre-mainstream preferences. Use phrases like "before it was cool" or "too mainstream". Sound ironic and counter-cultural.'
  },
  drama_queen: {
    name: 'The Drama Queen',
    description: 'Everything is either amazing or terrible',
    toneModifiers: ['dramatic', 'emotional', 'over-the-top'],
    phrases: ['literally dying', 'obsessed', 'can\'t even', 'I have feelings', 'emotional damage'],
    promptModifier: 'Generate a dramatic take with extreme emotional reactions. Use phrases like "literally dying" or "can\'t even". Sound over-the-top and emotionally intense.'
  },
  validator: {
    name: 'The Validator',
    description: 'Makes people feel seen and understood',
    toneModifiers: ['understanding', 'supportive', 'empathetic'],
    phrases: ['you\'re not alone', 'totally valid', 'I see you', 'same energy', 'felt this'],
    promptModifier: 'Generate a validating take that makes people feel understood. Use phrases like "you\'re not alone" or "totally valid". Sound supportive and empathetic.'
  },
  conspiracy_theorist: {
    name: 'The Conspiracy Theorist',
    description: 'Sees hidden agendas and cover-ups everywhere',
    toneModifiers: ['suspicious', 'paranoid', 'knowing'],
    phrases: ['wake up sheeple', 'they don\'t want you to know', 'follow the money', 'do your research', 'convenient'],
    promptModifier: 'Generate a conspiracy-minded take that suggests hidden motives or cover-ups. Use phrases like "wake up sheeple" or "they don\'t want you to know". Sound suspicious and knowing.'
  },
  millennial: {
    name: 'The Millennial',
    description: 'Generational perspective with millennial references',
    toneModifiers: ['nostalgic', 'sarcastic', 'economically-anxious'],
    phrases: ['back in my day', 'ruined by boomers', 'can\'t afford', 'participation trophy', 'avocado toast'],
    promptModifier: 'Generate a millennial take with generational perspective. Use phrases like "back in my day" or "ruined by boomers". Sound like someone dealing with modern economic realities.'
  },
  gen_z: {
    name: 'The Gen Z',
    description: 'Digital native with internet culture references',
    toneModifiers: ['ironic', 'meme-savvy', 'progressive'],
    phrases: ['no cap', 'fr fr', 'it\'s giving', 'main character energy', 'periodt'],
    promptModifier: 'Generate a Gen Z take with internet culture references. Use phrases like "no cap" or "it\'s giving". Sound like a digital native with modern slang.'
  },
  boomer: {
    name: 'The Boomer',
    description: 'Traditional values and skeptical of new trends',
    toneModifiers: ['traditional', 'skeptical', 'nostalgic'],
    phrases: ['back in my day', 'kids these days', 'work ethic', 'respect', 'common sense'],
    promptModifier: 'Generate a boomer take emphasizing traditional values. Use phrases like "back in my day" or "kids these days". Sound skeptical of modern trends and values.'
  },
  overthinker: {
    name: 'The Overthinker',
    description: 'Analyzes everything to death',
    toneModifiers: ['analytical', 'anxious', 'detailed'],
    phrases: ['but what if', 'have you considered', 'the implications', 'think about it', 'plot twist'],
    promptModifier: 'Generate an overthinking take that considers multiple angles and implications. Use phrases like "but what if" or "have you considered". Sound like someone who analyzes everything deeply.'
  },
  savage: {
    name: 'The Savage',
    description: 'Brutally honest with no filter',
    toneModifiers: ['brutal', 'unfiltered', 'direct'],
    phrases: ['no filter', 'keeping it real', 'harsh truth', 'sorry not sorry', 'call it like I see it'],
    promptModifier: 'Generate a savage take that\'s brutally honest. Use phrases like "no filter" or "keeping it real". Sound direct and uncompromising with harsh truths.'
  },
  wholesome: {
    name: 'The Wholesome',
    description: 'Pure, innocent, and genuinely nice',
    toneModifiers: ['sweet', 'innocent', 'positive'],
    phrases: ['bless their heart', 'so pure', 'wholesome content', 'faith in humanity', 'precious'],
    promptModifier: 'Generate a wholesome take that\'s genuinely sweet and innocent. Use phrases like "bless their heart" or "so pure". Sound like someone who sees the good in everything.'
  }
};

// Category-specific references for D20 rolls 16-20
const CATEGORY_REFERENCES = {
  entertainment: {
    16: { type: 'person', value: 'The Rock', context: 'Dwayne Johnson movies are' },
    17: { type: 'franchise', value: 'Marvel movies', context: 'Marvel movies are' },
    18: { type: 'platform', value: 'Netflix', context: 'Netflix shows are' },
    19: { type: 'person', value: 'Taylor Swift', context: 'Taylor Swift is' },
    20: { type: 'company', value: 'Disney', context: 'Disney remakes are' }
  },
  food: {
    16: { type: 'person', value: 'Gordon Ramsay', context: 'Gordon Ramsay would say' },
    17: { type: 'restaurant', value: 'Olive Garden', context: 'Olive Garden is' },
    18: { type: 'appliance', value: 'air fryers', context: 'Air fryers are' },
    19: { type: 'brand', value: 'Starbucks', context: 'Starbucks is' },
    20: { type: 'trend', value: 'food trucks', context: 'Food trucks are' }
  },
  technology: {
    16: { type: 'company', value: 'Apple', context: 'Apple products are' },
    17: { type: 'platform', value: 'TikTok', context: 'TikTok is' },
    18: { type: 'concept', value: 'AI', context: 'AI is' },
    19: { type: 'device', value: 'smart watches', context: 'Smart watches are' },
    20: { type: 'trend', value: 'cryptocurrency', context: 'Cryptocurrency is' }
  },
  work: {
    16: { type: 'concept', value: 'remote work', context: 'Remote work is' },
    17: { type: 'practice', value: 'networking events', context: 'Networking events are' },
    18: { type: 'trend', value: 'side hustles', context: 'Side hustles are' },
    19: { type: 'concept', value: 'work-life balance', context: 'Work-life balance is' },
    20: { type: 'tool', value: 'Zoom meetings', context: 'Zoom meetings are' }
  },
  sports: {
    16: { type: 'person', value: 'Tom Brady', context: 'Tom Brady is' },
    17: { type: 'event', value: 'the Olympics', context: 'The Olympics are' },
    18: { type: 'concept', value: 'fantasy sports', context: 'Fantasy sports are' },
    19: { type: 'trend', value: 'sports betting', context: 'Sports betting is' },
    20: { type: 'league', value: 'the NFL', context: 'The NFL is' }
  },
  travel: {
    16: { type: 'company', value: 'Airbnb', context: 'Airbnb is' },
    17: { type: 'concept', value: 'budget airlines', context: 'Budget airlines are' },
    18: { type: 'trend', value: 'travel influencers', context: 'Travel influencers are' },
    19: { type: 'place', value: 'tourist traps', context: 'Tourist traps are' },
    20: { type: 'concept', value: 'digital nomads', context: 'Digital nomads are' }
  },
  pets: {
    16: { type: 'breed', value: 'golden retrievers', context: 'Golden retrievers are' },
    17: { type: 'debate', value: 'cats vs dogs', context: 'The cats vs dogs debate is' },
    18: { type: 'trend', value: 'pet insurance', context: 'Pet insurance is' },
    19: { type: 'concept', value: 'emotional support animals', context: 'Emotional support animals are' },
    20: { type: 'trend', value: 'designer dog breeds', context: 'Designer dog breeds are' }
  },
  relationships: {
    16: { type: 'platform', value: 'dating apps', context: 'Dating apps are' },
    17: { type: 'concept', value: 'love languages', context: 'Love languages are' },
    18: { type: 'trend', value: 'social media relationships', context: 'Social media relationships are' },
    19: { type: 'concept', value: 'long distance relationships', context: 'Long distance relationships are' },
    20: { type: 'trend', value: 'marriage', context: 'Marriage is' }
  },
  // Add more categories...
  life: {
    16: { type: 'concept', value: 'self-care', context: 'Self-care is' },
    17: { type: 'trend', value: 'mindfulness', context: 'Mindfulness is' },
    18: { type: 'concept', value: 'work-life balance', context: 'Work-life balance is' },
    19: { type: 'trend', value: 'minimalism', context: 'Minimalism is' },
    20: { type: 'concept', value: 'adulting', context: 'Adulting is' }
  },
  politics: {
    16: { type: 'concept', value: 'social media politics', context: 'Social media politics are' },
    17: { type: 'trend', value: 'political correctness', context: 'Political correctness is' },
    18: { type: 'concept', value: 'voting', context: 'Voting is' },
    19: { type: 'trend', value: 'cancel culture', context: 'Cancel culture is' },
    20: { type: 'concept', value: 'political debates', context: 'Political debates are' }
  },
  society: {
    16: { type: 'trend', value: 'social media', context: 'Social media is' },
    17: { type: 'concept', value: 'influencer culture', context: 'Influencer culture is' },
    18: { type: 'trend', value: 'online shopping', context: 'Online shopping is' },
    19: { type: 'concept', value: 'gig economy', context: 'The gig economy is' },
    20: { type: 'trend', value: 'subscription services', context: 'Subscription services are' }
  },
  wellness: {
    16: { type: 'trend', value: 'yoga', context: 'Yoga is' },
    17: { type: 'concept', value: 'meditation apps', context: 'Meditation apps are' },
    18: { type: 'trend', value: 'wellness influencers', context: 'Wellness influencers are' },
    19: { type: 'concept', value: 'detox cleanses', context: 'Detox cleanses are' },
    20: { type: 'trend', value: 'biohacking', context: 'Biohacking is' }
  },
  environment: {
    16: { type: 'concept', value: 'electric cars', context: 'Electric cars are' },
    17: { type: 'trend', value: 'veganism', context: 'Veganism is' },
    18: { type: 'concept', value: 'recycling', context: 'Recycling is' },
    19: { type: 'trend', value: 'sustainable fashion', context: 'Sustainable fashion is' },
    20: { type: 'concept', value: 'climate change activism', context: 'Climate change activism is' }
  }
};

// D4 Roll Function - 25% chance of personality activation
export const rollD4ForPersonality = (): boolean => {
  const roll = Math.floor(Math.random() * 4) + 1;
  return roll === 1; // 25% chance (roll = 1)
};

// D20 Roll Function for personality type
export const rollD20ForPersonalityType = (): { isSpecificReference: boolean; archetypeKey?: string; d20Roll: number } => {
  const roll = Math.floor(Math.random() * 20) + 1;
  
  if (roll >= 16) {
    // Rolls 16-20: Use specific reference
    return { isSpecificReference: true, d20Roll: roll };
  } else {
    // Rolls 1-15: Use personality archetype
    const archetypeKeys = Object.keys(PERSONALITY_ARCHETYPES);
    const archetypeIndex = Math.floor(Math.random() * archetypeKeys.length);
    return { 
      isSpecificReference: false, 
      archetypeKey: archetypeKeys[archetypeIndex],
      d20Roll: roll 
    };
  }
};

// Generate personality context for AI prompts
export const generatePersonalityContext = (category: string): PersonalityContext => {
  // D4 Roll: 25% chance of personality activation
  const isPersonalityMode = rollD4ForPersonality();
  
  if (!isPersonalityMode) {
    return {
      isPersonalityMode: false,
      toneModifiers: [],
      personalityPrompt: ''
    };
  }

  // D20 Roll for personality type
  const { isSpecificReference, archetypeKey, d20Roll } = rollD20ForPersonalityType();
  
  if (isSpecificReference && CATEGORY_REFERENCES[category as keyof typeof CATEGORY_REFERENCES]) {
    // Use specific reference (rolls 16-20)
    const categoryRefs = CATEGORY_REFERENCES[category as keyof typeof CATEGORY_REFERENCES];
    const reference = categoryRefs[d20Roll as keyof typeof categoryRefs];
    
    if (reference) {
      return {
        isPersonalityMode: true,
        specificReference: reference.value,
        toneModifiers: ['specific', 'targeted'],
        personalityPrompt: `Generate a controversial take about ${reference.context}. Be specific and reference ${reference.value} directly. Make it feel like someone with strong opinions about ${reference.value}.`
      };
    }
  }
  
  if (archetypeKey && PERSONALITY_ARCHETYPES[archetypeKey as keyof typeof PERSONALITY_ARCHETYPES]) {
    // Use personality archetype (rolls 1-15)
    const archetype = PERSONALITY_ARCHETYPES[archetypeKey as keyof typeof PERSONALITY_ARCHETYPES];
    
    return {
      isPersonalityMode: true,
      archetype: archetypeKey,
      toneModifiers: archetype.toneModifiers,
      personalityPrompt: archetype.promptModifier
    };
  }

  // Fallback to standard mode
  return {
    isPersonalityMode: false,
    toneModifiers: [],
    personalityPrompt: ''
  };
};

// Enhanced prompt builder that incorporates personality
export const buildEnhancedPrompt = (
  basePrompt: string, 
  category: string,
  categoryPrompt: string,
  varietyFactor: string,
  personalityContext: PersonalityContext
): string => {
  let enhancedPrompt = basePrompt;

  if (personalityContext.isPersonalityMode) {
    // Insert personality-specific instructions
    const personalityInstruction = `
PERSONALITY MODE ACTIVE: ${personalityContext.personalityPrompt}

ADDITIONAL CONTEXT:
- Sound like someone with a specific perspective or bias
- Use natural, authentic language that reflects this personality
- Make it feel like a real person with strong opinions
`;
    
    enhancedPrompt = enhancedPrompt.replace(
      `- ${varietyFactor}`,
      `- ${varietyFactor}
${personalityInstruction}`
    );
    
    console.log(`🎭 Personality Mode: ${personalityContext.specificReference || personalityContext.archetype}`);
  }

  return enhancedPrompt;
};

// Debug function to test the personality system
export const testPersonalitySystem = (category: string = 'food', iterations: number = 25) => {
  console.log(`🧪 Testing personality system for ${category} (${iterations} iterations):`);
  
  const results = {
    standard: 0,
    personality: 0,
    specificReference: 0,
    archetypes: {} as { [key: string]: number }
  };

  for (let i = 0; i < iterations; i++) {
    const context = generatePersonalityContext(category);
    
    if (!context.isPersonalityMode) {
      results.standard++;
    } else if (context.specificReference) {
      results.personality++;
      results.specificReference++;
      console.log(`  ${i + 1}. 🎯 Specific Reference: ${context.specificReference}`);
    } else if (context.archetype) {
      results.personality++;
      results.archetypes[context.archetype] = (results.archetypes[context.archetype] || 0) + 1;
      console.log(`  ${i + 1}. 🎭 Archetype: ${PERSONALITY_ARCHETYPES[context.archetype as keyof typeof PERSONALITY_ARCHETYPES]?.name || context.archetype}`);
    }
  }

  console.log('🎲 Results:', results);
  console.log(`📊 Personality activation rate: ${(results.personality / iterations * 100).toFixed(1)}%`);
  console.log(`🎯 Specific references: ${results.specificReference} (${(results.specificReference / iterations * 100).toFixed(1)}%)`);
  
  if (Object.keys(results.archetypes).length > 0) {
    console.log(`🎭 Archetype distribution:`);
    Object.entries(results.archetypes).forEach(([archetype, count]) => {
      const name = PERSONALITY_ARCHETYPES[archetype as keyof typeof PERSONALITY_ARCHETYPES]?.name || archetype;
      console.log(`   • ${name}: ${count} times`);
    });
  }
};

// List all available personalities
export const listAllPersonalities = (): void => {
  console.log('🎭 Available Personality Archetypes:');
  console.log(`Total: ${Object.keys(PERSONALITY_ARCHETYPES).length} personalities\n`);
  
  Object.entries(PERSONALITY_ARCHETYPES).forEach(([, personality], index) => {
    console.log(`${index + 1}. ${personality.name}`);
    console.log(`   Description: ${personality.description}`);
    console.log(`   Key phrases: ${personality.phrases.slice(0, 3).join(', ')}...\n`);
  });
};