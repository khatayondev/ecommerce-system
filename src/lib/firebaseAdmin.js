import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let adminDb = null;

try {
  const existingApps = getApps();
  let app;

  if (existingApps.length === 0) {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountEnv) {
      // Strip surrounding quotes that Vercel/env may include
      const cleaned = serviceAccountEnv.trim().replace(/^['"]|['"]$/g, '');
      let serviceAccount = null;
      if (!cleaned.includes('[SENSITIVE]')) {
        try {
          serviceAccount = JSON.parse(cleaned);
        } catch {
          serviceAccount = JSON.parse(cleaned.replace(/\\n/g, '\n'));
        }
      }
      if (serviceAccount) {
        app = initializeApp({ credential: cert(serviceAccount) });
      }
    } else {
      // Fallback: try service-account.json for local dev (synchronous)
      try {
        const path = require('path');
        const fs = require('fs');
        const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
        if (fs.existsSync(serviceAccountPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
          app = initializeApp({ credential: cert(serviceAccount) });
        }
      } catch {
        // no service-account.json present — skip silently
      }
    }
  } else {
    app = existingApps[0];
  }

  const resolvedApp = app || (getApps().length > 0 ? getApps()[0] : null);
  if (resolvedApp) {
    const rawDatabaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID;
    const databaseId = (rawDatabaseId && rawDatabaseId.trim() !== '' && rawDatabaseId.trim() !== '(default)')
      ? rawDatabaseId.trim()
      : undefined;
    adminDb = databaseId ? getFirestore(resolvedApp, databaseId) : getFirestore(resolvedApp);
  }
} catch (error) {
  console.error('Firebase Admin init error:', error.message);
}

export { adminDb };
