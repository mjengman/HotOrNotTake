import { signInAnonymous } from '../services/userService';
import { getApprovedTakes } from '../services/takeService';

export const testFirebaseConnection = async (): Promise<void> => {
  try {
    console.log('🔥 Testing Firebase connection...');
    
    // Test authentication
    console.log('1. Testing anonymous authentication...');
    const user = await signInAnonymous();
    console.log('✅ Authentication successful:', user.uid);
    
    // Test Firestore read
    console.log('2. Testing Firestore read...');
    const takes = await getApprovedTakes();
    console.log(`✅ Firestore read successful: ${takes.length} takes found`);
    
    console.log('🎉 All Firebase services working correctly!');
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    throw error;
  }
};

// Uncomment to run the test
// testFirebaseConnection().catch(console.error);