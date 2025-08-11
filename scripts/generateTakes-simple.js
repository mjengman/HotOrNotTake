#!/usr/bin/env node

/**
 * Simple Take Generator - Just shows the structure
 * Replace YOUR_API_KEY_HERE with a valid OpenAI API key
 */

require('dotenv').config();
const fetch = require('node-fetch');

// Your API key - set via environment variable or .env file
const API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || 'YOUR_API_KEY_HERE';

const categories = ['food', 'technology', 'politics', 'work', 'life'];

const prompts = {
  food: 'Generate a controversial food opinion that people will either love or hate',
  technology: 'Create a divisive take about technology or social media',  
  politics: 'Generate a bold political opinion (stay within platform guidelines)',
  work: 'Create a controversial opinion about work culture or careers',
  life: 'Generate a divisive take about modern life or society'
};

async function generateTake(category) {
  console.log(`\n🎯 Generating ${category} take...`);
  
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    // Mock response for demo
    const mockTakes = {
      food: "Pineapple on pizza is actually a sophisticated flavor combination that uncultured people can't appreciate",
      technology: "Social media algorithms are making us smarter by filtering out irrelevant information", 
      politics: "Politicians should be required to pass basic competency tests before running for office",
      work: "Remote work is just an excuse for people to be less productive while pretending to work",
      life: "Cancel culture is just accountability culture for people who don't want to face consequences"
    };
    
    const take = mockTakes[category];
    console.log(`📝 "${take}"`);
    console.log(`📊 Length: ${take.length} chars`);
    console.log(`🏷️ Category: ${category}`);
    return;
  }
  
  // Real API call (when you add your key)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate a controversial "hot take" under 280 characters. Make it divisive but not offensive. Category: ${category}`
        },
        {
          role: 'user', 
          content: prompts[category]
        }
      ],
      max_tokens: 100,
      temperature: 0.9,
    }),
  });
  
  const data = await response.json();
  const take = data.choices?.[0]?.message?.content?.trim();
  
  console.log(`📝 "${take}"`);
  console.log(`📊 Length: ${take.length} chars`);
  console.log(`🏷️ Category: ${category}`);
}

async function main() {
  console.log('🔥 Hot Takes Generator (Demo Mode)');
  console.log('='.repeat(50));
  
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('⚠️ Using mock data - add your OpenAI API key to generate real takes');
  }
  
  const targetCategory = process.argv[2] || 'food';
  const count = parseInt(process.argv[3]) || 3;
  
  if (targetCategory === 'all') {
    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length];
      await generateTake(category);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } else {
    for (let i = 0; i < count; i++) {
      await generateTake(targetCategory);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\n✅ Generation complete!');
  console.log('\n📋 To use with real API:');
  console.log('1. Get API key from https://platform.openai.com/api-keys');
  console.log('2. Replace YOUR_API_KEY_HERE in this file');
  console.log('3. Run: node scripts/generateTakes-simple.js food 5');
}

if (require.main === module) {
  main().catch(console.error);
}