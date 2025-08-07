// import { collection, addDoc, Timestamp } from 'firebase/firestore';
// import { db } from '../services/firebase';
// import { TakeFirestore } from '../types/Take';

// // Initial takes to seed the database
// const initialTakes: Omit<TakeFirestore, 'createdAt' | 'userId'>[] = [
//   {
//     text: 'Pineapple on pizza is actually delicious and people who hate it are just following a trend',
//     category: 'food',
//     hotVotes: 1247,
//     notVotes: 2103,
//     totalVotes: 3350,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Working from home is less productive than working in an office',
//     category: 'work',
//     hotVotes: 892,
//     notVotes: 1654,
//     totalVotes: 2546,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Cats are better pets than dogs and anyone who disagrees lacks sophistication',
//     category: 'pets',
//     hotVotes: 2156,
//     notVotes: 1843,
//     totalVotes: 3999,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Social media has made society worse, not better',
//     category: 'technology',
//     hotVotes: 3421,
//     notVotes: 987,
//     totalVotes: 4408,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Money can absolutely buy happiness if you spend it right',
//     category: 'life',
//     hotVotes: 2876,
//     notVotes: 1234,
//     totalVotes: 4110,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Superhero movies are ruining cinema by being too formulaic',
//     category: 'entertainment',
//     hotVotes: 1543,
//     notVotes: 2187,
//     totalVotes: 3730,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Climate change is the most important issue of our generation',
//     category: 'environment',
//     hotVotes: 4123,
//     notVotes: 678,
//     totalVotes: 4801,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Meditation is just sitting around doing nothing and people pretend it helps',
//     category: 'wellness',
//     hotVotes: 567,
//     notVotes: 2890,
//     totalVotes: 3457,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Artificial intelligence will replace most jobs within the next 20 years',
//     category: 'technology',
//     hotVotes: 2345,
//     notVotes: 1876,
//     totalVotes: 4221,
//     isApproved: true,
//     reportCount: 0,
//   },
//   {
//     text: 'Tipping culture has gotten completely out of control',
//     category: 'society',
//     hotVotes: 3654,
//     notVotes: 543,
//     totalVotes: 4197,
//     isApproved: true,
//     reportCount: 0,
//   },
// ];

// export const seedDatabase = async (): Promise<void> => {
//   try {
//     console.log('Starting database seeding...');
    
//     const promises = initialTakes.map(async (take, index) => {
//       const takeData: TakeFirestore = {
//         ...take,
//         createdAt: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)), // Spread over days
//         userId: 'system-admin', // System user for initial takes
//       };

//       const docRef = await addDoc(collection(db, 'takes'), {
//         ...takeData,
//         createdAt: Timestamp.fromDate(takeData.createdAt),
//       });

//       console.log(`Added take ${index + 1}: ${docRef.id}`);
//       return docRef.id;
//     });

//     await Promise.all(promises);
//     console.log('Database seeding completed successfully!');
//   } catch (error) {
//     console.error('Error seeding database:', error);
//     throw error;
//   }
// };

// // Uncomment to run the seeding script
// // seedDatabase().catch(console.error);