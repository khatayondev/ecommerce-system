const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("Error: service-account.json not found in project root.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const preservedAdminEmail = 'thehoneypalace2022@gmail.com';

async function wipeDatabase() {
  console.log("🚨 STARTING DATABASE WIPE FOR PRODUCTION 🚨");
  
  const collectionsToWipe = [
    'sales',
    'orders',
    'invoices',
    'expenses',
    'purchases',
    'customers',
    'logs',
    'batches',
    'products',
    'suppliers',
    'exhibitions'
  ];

  let totalDeleted = 0;

  for (const colName of collectionsToWipe) {
    console.log(`Clearing collection "${colName}"...`);
    const colRef = db.collection(colName);
    const snapshot = await colRef.get();
    
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
      totalDeleted++;
    }
  }

  console.log(`Cleared ${totalDeleted} transaction and metadata records.`);

  console.log("Clearing user accounts (except primary admin)...");
  let usersDeleted = 0;
  const usersCol = db.collection('users');
  const usersSnapshot = await usersCol.get();

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const docId = doc.id;
    const email = (userData.email || docId || '').toLowerCase().trim();

    if (email !== preservedAdminEmail.toLowerCase()) {
      await doc.ref.delete();
      usersDeleted++;
    } else {
      console.log(`Preserving primary admin account: ${email}`);
    }
  }

  console.log(`Successfully deleted ${usersDeleted} user accounts.`);
  console.log("✨ DATABASE WIPE COMPLETE: READY FOR PRODUCTION! ✨");
}

wipeDatabase().catch(err => {
  console.error("Wipe failed with error:", err);
  process.exit(1);
});
