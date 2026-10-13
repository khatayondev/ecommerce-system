/**
 * Honey Palace — User Account Seeder
 * 
 * This script creates all staff user accounts in Firebase Authentication
 * AND seeds their role profiles into Firestore using the Firebase Admin SDK.
 * 
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed-users.js
 *   OR if using Application Default Credentials (gcloud auth application-default login):
 *   node scripts/seed-users.js
 * 
 * NOTE: Requires Firebase Admin SDK service account. 
 *       Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// ─── Service Account Detection ────────────────────────────────────────────────
let adminApp;

// Look for service account key in the project root
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const hasServiceAccount = fs.existsSync(serviceAccountPath);

if (hasServiceAccount) {
  const serviceAccount = require(serviceAccountPath);
  adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'thehoneypalaceafrica'
  });
  console.log('✅ Using service account key file.');
} else {
  // Try Application Default Credentials
  adminApp = initializeApp({
    projectId: 'thehoneypalaceafrica'
  });
  console.log('✅ Using Application Default Credentials.');
}

const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);

// ─── Staff Accounts to Seed ───────────────────────────────────────────────────
const STAFF_ACCOUNTS = [
  {
    email: 'thehoneypalace2022@gmail.com',
    password: 'HoneyAdmin@2026',
    displayName: 'Admin CEO',
    full_name: 'Admin CEO',
    roles: ['Admin', 'CEO'],
    is_active: true,
    department: 'Executive',
  },
  {
    email: 'kofi.mensah@honeypalaceafrica.com',
    password: 'SalesKofi@2026',
    displayName: 'Kofi Mensah',
    full_name: 'Kofi Mensah',
    roles: ['Sales Exec'],
    is_active: true,
    department: 'Sales',
  },
  {
    email: 'ama.serwaa@honeypalaceafrica.com',
    password: 'InvAma@2026',
    displayName: 'Ama Serwaa',
    full_name: 'Ama Serwaa',
    roles: ['Inventory'],
    is_active: true,
    department: 'Warehouse',
  },
  {
    email: 'yao.boateng@honeypalaceafrica.com',
    password: 'AcctYao@2026',
    displayName: 'Yao Boateng',
    full_name: 'Yao Boateng',
    roles: ['Accountant'],
    is_active: true,
    department: 'Finance',
  },
  {
    email: 'manager@honeypalaceafrica.com',
    password: 'MgrPalace@2026',
    displayName: 'Operations Manager',
    full_name: 'Operations Manager',
    roles: ['Manager'],
    is_active: true,
    department: 'Operations',
  },
];

// ─── Main Seeder ──────────────────────────────────────────────────────────────
async function seedUsers() {
  console.log('\n🍯 Honey Palace — User Account Seeder\n');
  console.log('─'.repeat(60));

  const results = [];

  for (const account of STAFF_ACCOUNTS) {
    process.stdout.write(`Creating: ${account.full_name} (${account.email}) ... `);

    let uid;
    let status = 'created';

    try {
      // Try to create the user in Firebase Auth
      const userRecord = await adminAuth.createUser({
        email: account.email,
        password: account.password,
        displayName: account.displayName,
        emailVerified: true,
      });
      uid = userRecord.uid;
      console.log(`✅ Created (UID: ${uid.slice(0, 8)}...)`);

    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        // User already exists — fetch their UID and update
        const existingUser = await adminAuth.getUserByEmail(account.email);
        uid = existingUser.uid;

        // Update password to the new one
        await adminAuth.updateUser(uid, {
          password: account.password,
          displayName: account.displayName,
          emailVerified: true,
        });

        status = 'updated';
        console.log(`♻️  Already exists — Updated (UID: ${uid.slice(0, 8)}...)`);
      } else {
        console.log(`❌ FAILED: ${err.message}`);
        results.push({ ...account, status: 'failed', error: err.message });
        continue;
      }
    }

    // Seed their profile into Firestore users/{uid}
    await adminDb.collection('users').doc(uid).set({
      uid,
      full_name: account.full_name,
      email: account.email,
      roles: account.roles,
      department: account.department,
      is_active: true,
      active: true,
      created_at: new Date().toISOString(),
      seeded_by: 'seed-users-script',
    }, { merge: true });

    results.push({ ...account, uid, status });
  }

  // ─── Summary Table ────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('📋 SEED COMPLETE — LOGIN CREDENTIALS\n');

  results.forEach(r => {
    if (r.status === 'failed') {
      console.log(`  ❌ ${r.full_name} — FAILED (${r.error})`);
    } else {
      console.log(`  ${r.status === 'created' ? '🟢' : '🔵'} ${r.full_name}`);
      console.log(`     Role:     ${r.roles.join(', ')}`);
      console.log(`     Email:    ${r.email}`);
      console.log(`     Password: ${r.password}`);
      console.log('');
    }
  });

  console.log('─'.repeat(60));
  console.log('✅ All accounts ready. Log in at http://localhost:3000/login\n');
}

seedUsers().catch((err) => {
  console.error('\n❌ Seeder script crashed:', err);
  process.exit(1);
});
