import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Web API keys are not secrets; access is enforced by firestore.rules.
const firebaseConfig = {
  apiKey: "AIzaSyD15HuPSO1gyTIe-q0ijkUN4Ftne1PRjYY",
  authDomain: "tenderza-5db96.firebaseapp.com",
  projectId: "tenderza-5db96",
  storageBucket: "tenderza-5db96.firebasestorage.app",
  messagingSenderId: "828768010113",
  appId: "1:828768010113:web:f7300d7504b541b8d73280",
  measurementId: "G-VS1NZ0LXCL"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
isSupported().then(ok => ok && getAnalytics(app)).catch(() => {});

export * from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
export * from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
