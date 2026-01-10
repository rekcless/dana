// Import Firebase SDK (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-analytics.js";

// Firebase config (Saku)
const firebaseConfig = {
  apiKey: "AIzaSyDSypYYx52DMrDHiUvejCVGjWElDIZmCgk",
  authDomain: "saku-952f4.firebaseapp.com",
  projectId: "saku-952f4",
  storageBucket: "saku-952f4.firebasestorage.app",
  messagingSenderId: "1018110332142",
  appId: "1:1018110332142:web:30034e7ea2cc42b3ae37ff",
  measurementId: "G-Y3ZKR9193L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);

// Analytics (optional)
export const analytics = getAnalytics(app);
