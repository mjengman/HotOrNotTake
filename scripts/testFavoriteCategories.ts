import { getTopCategories } from '../src/utils/stats';

const counts = { food: 5, tech: 3, politics: 8, sports: 2, art: 8 };
const top = getTopCategories(counts, 3);
console.log('Top categories:', top);

if (JSON.stringify(top) !== JSON.stringify(['art', 'politics', 'food'])) {
  throw new Error('Favorite categories computation failed');
}

console.log('Favorite categories computation passed');
