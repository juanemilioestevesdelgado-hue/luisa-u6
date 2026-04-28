import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBrT6R7FfLJf8PobA8HVVw2jaVA9bS8ens",
  authDomain: "u6-luisa.firebaseapp.com",
  projectId: "u6-luisa",
  storageBucket: "u6-luisa.firebasestorage.app",
  messagingSenderId: "653116231840",
  appId: "1:653116231840:web:f034f17e2800498e47b9c5",
  measurementId: "G-P42X8H3TFJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const querySnapshot = await getDocs(collection(db, "inventory"));
    console.log("Success! Docs count:", querySnapshot.size);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
