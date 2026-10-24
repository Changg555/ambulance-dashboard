import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCy0B8aBsn7v8ZlrTfPOwUEPBVrv8ChNhc",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "kps-ambulance-5308f.firebaseapp.com",
  databaseURL: process.env.REACT_APP_FIREBASE_DB_URL || "https://kps-ambulance-5308f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "kps-ambulance-5308f",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "kps-ambulance-5308f.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "911722332967",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:911722332967:web:ef0c31b83f541a4e605f02",
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

let registeringStaff = false;
export const setRegisteringStaff = (value) => {
  registeringStaff = Boolean(value);
};
export const isRegisteringStaff = () => registeringStaff;

export { db, auth, storage };
export default app;