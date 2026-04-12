import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4ERm5HxLQEeMjGOBCotzAHpNgVplEVXQ",
  authDomain: "granmontana-pos.firebaseapp.com",
  projectId: "granmontana-pos",
  storageBucket: "granmontana-pos.firebasestorage.app",
  messagingSenderId: "321996000397",
  appId: "1:321996000397:web:e7947f74001c446ed7a6c4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };