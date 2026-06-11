import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAOjz3KP9HK3aunRGyNr3vOfpuSWEmSdiE",
  authDomain: "jarsofjoy-bakes.firebaseapp.com",
  projectId: "jarsofjoy-bakes",
  storageBucket: "jarsofjoy-bakes.firebasestorage.app",
  messagingSenderId: "532713849124",
  appId: "1:532713849124:web:9cae568bf96a046900b3b1"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
