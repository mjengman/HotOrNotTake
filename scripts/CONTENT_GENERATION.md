# 🔥 Content Generation Scripts

Two scripts for generating hot takes to seed your app with quality content.

## 🎯 Premium Generator (generateTakes.js)

Advanced content generation with personality archetypes and spicy mode.

### Usage:
```bash
node scripts/generateTakes.js [category] [count] [mode]
```

### Examples:
```bash
# Generate 5 focused food takes
node scripts/generateTakes.js food 5

# Generate 3 SPICY political takes (nuclear level)
node scripts/generateTakes.js politics 3 spicy

# Generate 10 takes across all categories
node scripts/generateTakes.js all 10

# Generate 15 spicy takes across all categories
node scripts/generateTakes.js all 15 spicy
```

### Features:
- **21 personality archetypes** (Contrarian, Futurist, Chaos Agent, etc.)
- **Two modes**: `focused` (default) or `spicy` (nuclear controversial)
- **Premium prompts** from enhancedPrompts.ts
- **Detailed output** with persona, prompt used, and character count

## 📝 Simple Generator (generateTakes-simple.js)

Basic content generation for quick takes.

### Usage:
```bash
node scripts/generateTakes-simple.js [category] [count]
```

### Examples:
```bash
node scripts/generateTakes-simple.js food 5
node scripts/generateTakes-simple.js politics 3
node scripts/generateTakes-simple.js all 10
```

### NPM Shortcuts:
```bash
npm run generate food 3        # Uses simple generator
npm run generate:all           # Generate 10 takes across all
```

## Available Categories

All 13 categories from your app:
- `technology` - Tech, social media, and digital culture
- `food` - Food opinions and culinary controversies
- `politics` - Political opinions and social issues  
- `work` - Career, remote work, and workplace culture
- `life` - Life advice and modern society
- `entertainment` - Movies, TV, celebrities, and pop culture
- `relationships` - Dating, marriage, and social dynamics
- `pets` - Animal ownership and pet culture
- `wellness` - Health, fitness, and mental health
- `travel` - Tourism and travel culture
- `society` - Social issues and cultural trends
- `environment` - Climate and environmental topics
- `sports` - Sports, athletes, and competition

## How to Use Generated Content

1. **Run the script** to generate takes
2. **Review the output** in your terminal
3. **Copy the good ones** (look for the 📝 emoji)
4. **Paste into your app** via the Submit Take screen
5. **Select appropriate category** when submitting

## Which Generator to Use?

- **Use Premium (generateTakes.js)** when you want:
  - Higher quality, more diverse takes
  - Nuclear-level controversial content (spicy mode)
  - Different personality voices
  - More sophisticated prompts

- **Use Simple (generateTakes-simple.js)** when you want:
  - Quick generation
  - Basic controversial takes
  - Simpler output format

## Tips

- Generated takes are ~200-280 characters (perfect for the app)
- Premium generator uses 21 different personality archetypes
- Spicy mode creates nuclear-level controversial takes
- Run multiple times to get variety with different personas
- Cherry-pick only the best ones for your app
- Avoid takes that are too similar to existing content

## Example Output

```
🎯 Generating food take...
📝 "Pineapple on pizza is a culinary masterpiece that embraces sweet and savory balance."
📊 Length: 85 chars
🏷️ Category: food
```

## Troubleshooting

- If API errors occur, check the API key in `generateTakes-simple.js`
- Rate limits: Script includes 500ms delays between requests
- For bulk generation, run the script multiple times rather than huge batches