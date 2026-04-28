import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";
import fs from "fs";

const dataContent = fs.readFileSync("./data.js", "utf-8");
let fullInventory;
eval(dataContent.replace("const fullInventory =", "fullInventory ="));

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

async function syncData() {
  try {
    const colRef = collection(db, "inventory");
    const querySnapshot = await getDocs(colRef);
    console.log("Current Docs count:", querySnapshot.size);
    
    // Delete existing
    let batch = writeBatch(db);
    let count = 0;
    querySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count++;
    });
    if (count > 0) {
        await batch.commit();
        console.log("Deleted", count, "old docs.");
    }

    // Insert new
    batch = writeBatch(db);
    fullInventory.forEach((item) => {
        const docRef = doc(db, "inventory", item.codigo);
        batch.set(docRef, { ...item, estado: item.estado || "", revisado: false, comentarios: "", fotoUrl: "" });
    });
    await batch.commit();
    console.log("Inserted", fullInventory.length, "new docs.");
    process.exit(0);
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

syncData();
