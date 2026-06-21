import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDGmZOGdm7vUNRIUqjIu6sVtdT-PZj1j6s",
  authDomain: "medsafe-e1d89.firebaseapp.com",
  projectId: "medsafe-e1d89",
  storageBucket: "medsafe-e1d89.firebasestorage.app",
  messagingSenderId: "875344895809",
  appId: "1:875344895809:web:b203f874ca20b4f2ab0bc0",
  measurementId: "G-88RRTZ9QH2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const auth = getAuth(app);

export default app;
