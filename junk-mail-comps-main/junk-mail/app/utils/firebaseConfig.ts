
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBK4wVb1BsgA9A3uIaecbSTR3ulkEemPgU",
  authDomain: "junk-mail-comps.firebaseapp.com",
  projectId: "junk-mail-comps",
  storageBucket: "junk-mail-comps.firebasestorage.app",
  messagingSenderId: "906231894382",
  appId: "1:906231894382:web:5f9d10b53aa15b3fcdb17f",
  measurementId: "G-P9FH9H7QZK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };