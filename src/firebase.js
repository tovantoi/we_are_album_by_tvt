// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// DÁN ĐOẠN FIREBASE CONFIG CỦA BẠN VÀO ĐÂY
const firebaseConfig = {
  apiKey: "AIzaSyA0DQB37bhL5p11fCuUZxZ4tYxooAk2M2g",
  authDomain: "albumanywhere.firebaseapp.com",
  projectId: "albumanywhere",
  storageBucket: "albumanywhere.firebasestorage.app",
  messagingSenderId: "873856672072",
  appId: "1:873856672072:web:2613c34bc330bcf2f8537d",
  measurementId: "G-074QTK8DTB",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
