const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'thehoneypalaceafrica'
});

const db = getFirestore();

function titleCaseWord(w) {
  if (!w) return '';
  if (/^(H\.E\.?|COP)$/i.test(w)) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function cleanTitle(rawTitle) {
  let t = (rawTitle || '').trim().replace(/\.+$/, '');
  if (!t) return '';
  const low = t.toLowerCase();
  if (low === 'mr') return 'Mr.';
  if (low === 'mrs') return 'Mrs.';
  if (low === 'ms') return 'Ms.';
  if (low === 'miss') return 'Miss';
  if (low === 'dr') return 'Dr.';
  if (low === 'rev') return 'Rev.';
  if (low === 'hon') return 'Hon.';
  if (low === 'cop') return 'COP';
  if (low === 'h.e' || low === 'he') return 'H.E.';
  if (low === 'pastor') return 'Pastor';
  if (low === 'captain') return 'Captain';
  if (low === 'madam') return 'Madam';
  if (low === 'dear' || low === 'hello') return '';
  return titleCaseWord(t);
}

function cleanName(rawName) {
  let n = (rawName || '').trim().replace(/\s+/g, ' ');
  if (n === n.toUpperCase() && n.length > 2) {
    n = n.split(' ').map(titleCaseWord).join(' ');
  }
  return n;
}

async function runImport() {
  console.log('--- Honey Palace Customer Importer ---');
  
  // 1. Fetch existing customers from Firestore
  const existingSnap = await db.collection('customers').get();
  console.log(`Currently in Firestore: ${existingSnap.size} customers`);
  
  const existingPhoneSet = new Set();
  const existingNameSet = new Set();
  
  existingSnap.forEach(docSnap => {
    const data = docSnap.data();
    const p = (data.phone || data.phoneNumber || '').replace(/[^\d]/g, '');
    if (p) existingPhoneSet.add(p.slice(-9));
    const n = (data.name || data.full_name || '').trim().toLowerCase();
    if (n) existingNameSet.add(n);
  });

  // 2. Read raw input TSV
  const rawPath = path.join(__dirname, '..', 'scratch', 'raw_input.tsv');
  const content = fs.readFileSync(rawPath, 'utf8');
  const lines = content.split('\n').map(l => l.trimEnd()).filter(Boolean);

  // Group raw rows by phone number
  const phoneMap = new Map();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t').map(p => p.trim());
    const rawTitle = parts[0] || '';
    const rawName = parts[1] || '';
    const rawPhone = parts[2] || '';
    const digits = rawPhone.replace(/[^\d]/g, '');
    if (!digits) continue;

    if (!phoneMap.has(digits)) {
      phoneMap.set(digits, []);
    }
    phoneMap.get(digits).push({ rawTitle, rawName, rawPhone, line: i + 1 });
  }

  console.log(`Parsed ${lines.length - 1} rows into ${phoneMap.size} unique phone numbers.`);

  // 3. Resolve best title & name for each phone
  const resolved = [];
  for (const [digits, entries] of phoneMap.entries()) {
    const nonCustomerEntries = entries.filter(e => e.rawName.toLowerCase() !== 'customer');
    const candidates = nonCustomerEntries.length > 0 ? nonCustomerEntries : entries;

    let best = candidates[0];
    for (const c of candidates) {
      const cTitle = cleanTitle(c.rawTitle);
      const bestTitle = cleanTitle(best.rawTitle);
      const cFull = (cTitle ? cTitle + ' ' : '') + cleanName(c.rawName);
      const bestFull = (bestTitle ? bestTitle + ' ' : '') + cleanName(best.rawName);
      if (cFull.length > bestFull.length) {
        best = c;
      }
    }

    const finalTitle = cleanTitle(best.rawTitle);
    const finalName = cleanName(best.rawName);
    const fullName = (finalTitle ? finalTitle + ' ' : '') + finalName;

    const localPhone = digits.length === 9 ? '0' + digits : (digits.startsWith('0') ? digits : '0' + digits);
    const intlPhone = digits.length === 9 ? '233' + digits : (digits.startsWith('0') ? '233' + digits.slice(1) : digits);

    resolved.push({
      digits,
      localPhone,
      intlPhone,
      title: finalTitle,
      nameOnly: finalName,
      fullName,
      isCustomerOnly: finalName.toLowerCase() === 'customer'
    });
  }

  // Filter out contacts whose only name is 'Customer'
  const validContacts = resolved.filter(r => !r.isCustomerOnly);
  const skippedCustomerOnly = resolved.filter(r => r.isCustomerOnly);
  console.log(`Skipped ${skippedCustomerOnly.length} contacts that only had "Customer" as placeholder name.`);
  console.log(`Valid named contacts to process: ${validContacts.length}`);

  // Check against existing Firestore customers by phone
  const alreadyInFirestore = [];
  const toAdd = [];

  validContacts.forEach(c => {
    if (existingPhoneSet.has(c.digits.slice(-9))) {
      alreadyInFirestore.push(c);
    } else {
      toAdd.push(c);
    }
  });

  console.log(`Already in Firestore by phone (skipped): ${alreadyInFirestore.length}`);
  console.log(`New contacts to insert: ${toAdd.length}`);

  // 4. Ensure NO REPETITION OF CUSTOMER NAMES (disambiguate matching names)
  const seenNames = new Map();
  existingNameSet.forEach(n => seenNames.set(n, 1));

  const finalizedToAdd = [];
  toAdd.forEach(c => {
    let name = c.fullName;
    const lower = name.toLowerCase();

    if (seenNames.has(lower)) {
      name = `${c.fullName} (${c.localPhone})`;
    }
    seenNames.set(name.toLowerCase(), 1);

    finalizedToAdd.push({
      ...c,
      finalName: name
    });
  });

  // 5. Batch write to Firestore
  console.log(`Executing batch write of ${finalizedToAdd.length} customers to Firestore...`);
  const BATCH_SIZE = 250;
  const now = new Date().toISOString();

  for (let i = 0; i < finalizedToAdd.length; i += BATCH_SIZE) {
    const chunk = finalizedToAdd.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    chunk.forEach(cust => {
      const docRef = db.collection('customers').doc();
      batch.set(docRef, {
        name: cust.finalName,
        full_name: cust.finalName,
        phone: cust.localPhone,
        phoneNumber: cust.intlPhone,
        customer_type: 'Retail',
        email: '',
        address: '',
        company: '',
        source: 'Contact Import',
        notes: `Imported with unique contact number ${cust.localPhone}`,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: now,
        created_at: now,
        updatedAt: now
      });
    });

    await batch.commit();
    console.log(`Committed chunk ${i + 1} to ${Math.min(i + BATCH_SIZE, finalizedToAdd.length)}`);
  }

  // 6. Write CSV export for reference
  const csvHeaders = ['Name,Phone,International Phone,Customer Type\n'];
  const csvRows = finalizedToAdd.map(c => 
    `"${c.finalName.replace(/"/g, '""')}","${c.localPhone}","${c.intlPhone}","Retail"`
  );
  fs.writeFileSync(
    path.join(__dirname, '..', 'imported_customers.csv'),
    csvHeaders.concat(csvRows.join('\n')).join('')
  );
  console.log(`Saved exported CSV to imported_customers.csv (${finalizedToAdd.length} rows).`);

  // Verify final count
  const finalSnap = await db.collection('customers').get();
  console.log(`\n✅ Done! Total customers in Firestore now: ${finalSnap.size}`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
