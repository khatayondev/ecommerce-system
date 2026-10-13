import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const prodFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const stagingFirebaseConfig = {
  apiKey: "AIzaSyB-KgNmGe-4pYCK26IsAjxroYCv_NkU6W8",
  authDomain: "thehoneypalace-staging.firebaseapp.com",
  projectId: "thehoneypalace-staging",
  storageBucket: "thehoneypalace-staging.firebasestorage.app",
  messagingSenderId: "534938935232",
  appId: "1:534938935232:web:0945162091842c8b6bb225",
  measurementId: "G-1W2SZKP5P0"
};

const isStaging = 
  process.env.NEXT_PUBLIC_USE_STAGING_FIREBASE === 'true' || 
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

const firebaseConfig = isStaging ? stagingFirebaseConfig : prodFirebaseConfig;

// Check if Firebase is properly configured with real credentials (not placeholders) and Sandbox Mode is not forced
const isConfigured = 
  Boolean(firebaseConfig.apiKey) && 
  firebaseConfig.apiKey !== "your_web_api_key_here" &&
  firebaseConfig.apiKey !== "" &&
  process.env.NEXT_PUBLIC_FORCE_SANDBOX !== "true";

let app = null;
let db = null;
let auth = null;

if (isConfigured) {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    
    // Only initialize persistent cache on the client, and only on first initialization
    if (typeof window !== 'undefined') {
      // Set log level to error to prevent transient network latency warning noise in dev console
      try { setLogLevel('error'); } catch (e) {}

      try {
        const cacheConfig = {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        };
        db = initializeFirestore(app, cacheConfig);
      } catch (e) {
        db = getFirestore(app);
      }
    } else {
      db = getFirestore(app);
    }
  } else {
    // During Hot Reloading (HMR), the app is already initialized
    app = getApp();
    db = getFirestore(app);
  }

  auth = getAuth(app);
}

export { db, auth };
