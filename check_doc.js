import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("/Users/evieloughnan/Documents/CODEX/Chronos/firebase-applet-config.json", "utf-8"));

const app = initializeApp(config);
const db = getFirestore(app);

async function check() {
  const ref = doc(db, "projects", "Gc8mM4l6jDQSQZjiQ6Rr");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    console.log("DATA:", JSON.stringify(snap.data(), null, 2));
  } else {
    console.log("NOT FOUND");
  }
  process.exit(0);
}

check();
