import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  deleteDoc, 
  doc,
  writeBatch
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBP2T79BqfrYuvs_FIdXm6PHVDX9KuBzqY",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "hotornottakes-86206.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "hotornottakes-86206",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "hotornottakes-86206.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "206176471083",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:206176471083:web:c4f87dc93ac0b063c44c46",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-PYT1P0ST7T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Collections to clear
const COLLECTIONS_TO_CLEAR = [
  'takes',
  'votes',
  'userTakes',
  'userStats'
];

async function clearCollection(collectionName: string): Promise<number> {
  console.log(`\n🗑️  Clearing collection: ${collectionName}`);
  
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`   ✅ Collection '${collectionName}' is already empty`);
      return 0;
    }

    // Use batched writes for efficiency (max 500 operations per batch)
    const batchSize = 500;
    let deletedCount = 0;
    
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = docs.slice(i, i + batchSize);
      
      batchDocs.forEach((docSnapshot) => {
        batch.delete(doc(db, collectionName, docSnapshot.id));
      });
      
      await batch.commit();
      deletedCount += batchDocs.length;
      console.log(`   📊 Progress: ${deletedCount}/${docs.length} documents deleted`);
    }
    
    console.log(`   ✅ Deleted ${deletedCount} documents from '${collectionName}'`);
    return deletedCount;
    
  } catch (error) {
    console.error(`   ❌ Error clearing collection '${collectionName}':`, error);
    return 0;
  }
}

async function clearDatabase() {
  console.log('🔥 HOT OR NOT TAKES - DATABASE RESET TOOL 🔥');
  console.log('==========================================\n');
  
  try {
    // Authenticate first
    console.log('🔐 Authenticating...');
    await signInAnonymously(auth);
    console.log('✅ Authentication successful\n');
    
    // Show warning
    console.log('⚠️  WARNING: This will permanently delete all data!');
    console.log('   Collections to be cleared:');
    COLLECTIONS_TO_CLEAR.forEach(col => console.log(`   - ${col}`));
    console.log('\n   Press Ctrl+C within 5 seconds to cancel...\n');
    
    // Give time to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🚀 Starting database reset...\n');
    
    let totalDeleted = 0;
    
    // Clear each collection
    for (const collectionName of COLLECTIONS_TO_CLEAR) {
      const deleted = await clearCollection(collectionName);
      totalDeleted += deleted;
    }
    
    console.log('\n==========================================');
    console.log(`✨ Database reset complete!`);
    console.log(`📊 Total documents deleted: ${totalDeleted}`);
    console.log('\n🎉 Your database is now fresh and ready for new content!');
    console.log('💡 Tip: The app will automatically generate new AI content on next launch');
    
  } catch (error) {
    console.error('\n❌ Database reset failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
clearDatabase().catch(console.error);