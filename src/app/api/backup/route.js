import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BACKUP_COLLECTIONS = [
  'products',
  'orders',
  'sales',
  'customers',
  'store_settings',
  'expenses',
  'purchases',
  'suppliers',
  'batches',
  'promos'
];

async function generateDatabaseBackup(triggerSource = 'api') {
  const timestamp = new Date().toISOString();
  const backupId = `hp_backup_${Date.now()}`;
  const backupData = {};
  const collectionCounts = {};

  if (!adminDb) {
    // Generate fallback snapshot for local/offline demo environments
    const fallbackProducts = [
      { id: 'bottle-500ml', name: '500ml Honey Bottle', category: 'Raw Honey', spec: '500 ml', stockLevel: 140, costPrice: 22.50, sellingPrice: 45.00 },
      { id: 'bottle-1l', name: '1L Honey Bottle', category: 'Raw Honey', spec: '1000 ml', stockLevel: 85, costPrice: 40.00, sellingPrice: 80.00 }
    ];
    const fallbackOrders = [
      { id: 'ORD-9842', orderNumber: 'ORD-9842', total: 215.00, payment_status: 'paid', deliveryAreaName: 'East Legon & Shiashie' },
      { id: 'ORD-9843', orderNumber: 'ORD-9843', total: 360.00, payment_status: 'paid', deliveryAreaName: 'Airport Residential & Cantonments' }
    ];

    for (const colName of BACKUP_COLLECTIONS) {
      if (colName === 'products') backupData[colName] = fallbackProducts;
      else if (colName === 'orders') backupData[colName] = fallbackOrders;
      else backupData[colName] = [];
      collectionCounts[colName] = backupData[colName].length;
    }

    const totalRecords = Object.values(collectionCounts).reduce((a, b) => a + b, 0);

    return {
      system: "The Honey Palace Africa - Inventory & E-Commerce",
      version: "1.0",
      backup_id: backupId,
      created_at: timestamp,
      trigger_source: triggerSource,
      mode: "local_snapshot_fallback",
      total_records: totalRecords,
      collection_counts: collectionCounts,
      data: backupData
    };
  }

  for (const colName of BACKUP_COLLECTIONS) {
    try {
      const snap = await adminDb.collection(colName).get();
      const records = [];
      snap.forEach(doc => {
        records.push({ id: doc.id, ...doc.data() });
      });
      backupData[colName] = records;
      collectionCounts[colName] = records.length;
    } catch (colErr) {
      console.warn(`[BACKUP] Error fetching collection ${colName}:`, colErr.message);
      backupData[colName] = [];
      collectionCounts[colName] = 0;
    }
  }

  const totalRecords = Object.values(collectionCounts).reduce((a, b) => a + b, 0);

  const payload = {
    system: "The Honey Palace Africa - Inventory & E-Commerce",
    version: "1.0",
    backup_id: backupId,
    created_at: timestamp,
    trigger_source: triggerSource,
    total_records: totalRecords,
    collection_counts: collectionCounts,
    data: backupData
  };

  // Record backup audit log in Firestore
  try {
    await adminDb.collection('system_backups').doc(backupId).set({
      backup_id: backupId,
      created_at: timestamp,
      trigger_source: triggerSource,
      total_records: totalRecords,
      collection_counts: collectionCounts,
      status: 'success'
    });
  } catch (logErr) {
    console.warn('[BACKUP] Warning recording system_backups doc:', logErr.message);
  }

  return payload;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download') === 'true';
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'hp_secure_backup_secret';

    // Verify token if called externally
    const token = searchParams.get('token');
    if (token && token !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized backup token' }, { status: 401 });
    }

    const backup = await generateDatabaseBackup(download ? 'manual_download' : 'cron');

    if (download) {
      const jsonString = JSON.stringify(backup, null, 2);
      const filename = `honeypalace_database_backup_${new Date().toISOString().split('T')[0]}.json`;

      return new Response(jsonString, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Automated database backup executed successfully.',
      backup_id: backup.backup_id,
      created_at: backup.created_at,
      total_records: backup.total_records,
      collection_counts: backup.collection_counts
    });

  } catch (error) {
    console.error('[BACKUP API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate database backup' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const backup = await generateDatabaseBackup('manual_admin_trigger');
    return NextResponse.json({
      success: true,
      message: 'Database backup snapshot generated.',
      backup
    });
  } catch (error) {
    console.error('[BACKUP POST ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate database backup' },
      { status: 500 }
    );
  }
}
