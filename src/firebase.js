// src/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ✅ Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9PyKMVTunp2O9Yvn9a9j0n0WbJozv73U",
  authDomain: "myrota-13aa3.firebaseapp.com",
  projectId: "myrota-13aa3",
  storageBucket: "myrota-13aa3.appspot.com",
  messagingSenderId: "566180879565",
  appId: "1:566180879565:web:00dc1ff817055ce5df9d84",
  measurementId: "G-CD6THPXS9X",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Export initialized services
export const db = getFirestore(app);
export const auth = getAuth(app);
