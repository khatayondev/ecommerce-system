import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
    }

    // 1. Delete product document from Firestore
    await adminDb.collection('products').doc(id).delete();

    // 2. Also clean up any lingering batches associated with this product
    try {
      const batchesSnap = await adminDb.collection('batches').where('product_id', '==', id).get();
      const batchDeletes = [];
      batchesSnap.forEach((docSnap) => {
        batchDeletes.push(docSnap.ref.delete());
      });
      if (batchDeletes.length > 0) {
        await Promise.all(batchDeletes);
      }
    } catch (batchErr) {
      console.warn('[DeleteProductAPI] Batch cleanup warning:', batchErr.message);
    }

    return NextResponse.json({ success: true, message: `Product ${id} deleted successfully` });
  } catch (error) {
    console.error('[DeleteProductAPI] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
