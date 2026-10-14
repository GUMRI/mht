import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let firestoreInstance: Firestore;

try {
  if (typeof window !== 'undefined') {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    }, firebaseConfig.firestoreDatabaseId);
  } else {
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
} catch (e) {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

// Connectivity validation constraint from skill
export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is currently operating in offline-first mode.');
    }
    return false;
  }
}
