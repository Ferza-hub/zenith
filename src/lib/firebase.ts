import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDof3bpkKAHFWeZm621-iSDI3Nc5-MxVXQ",
  authDomain: "marketintelligence-18262.firebaseapp.com",
  projectId: "marketintelligence-18262",
  storageBucket: "marketintelligence-18262.firebasestorage.app",
  messagingSenderId: "619297383592",
  appId: "1:619297383592:web:9cbe9b4dbcd93be2f0ce9d",
  measurementId: "G-7WCJ9HVSLE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
