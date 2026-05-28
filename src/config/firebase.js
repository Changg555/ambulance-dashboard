import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA4TVIeTuKIz3QSQyFwiEaQN_xU0UqTtMw", 
  authDomain: "kps-ambulance.firebaseapp.com",
  databaseURL: "https://kps-ambulance-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kps-ambulance",
  storageBucket: "kps-ambulance.firebasestorage.app",
  messagingSenderId: "603735444136",
  appId: "1:603735444136:web:9e1cfa833cdaf87401509d",
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

const db = getDatabase(app);
const auth = getAuth(app);

export { db, auth };
export default app;