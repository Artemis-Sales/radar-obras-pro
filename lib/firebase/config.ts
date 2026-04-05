import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guard Clause Vitalícia: Evita crash 500 caso o servidor Next.js na Cloud
// incie a renderização SSR sem enxergar as chaves do .env.production
const isConfigValid = typeof window !== 'undefined' 
  ? Boolean(firebaseConfig.apiKey) 
  : Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

if (!isConfigValid) {
  console.warn("⚠️ Firebase configs missing! Cheque se o .env está sendo lido em Production.");
}

const app = (!getApps().length && isConfigValid) ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
