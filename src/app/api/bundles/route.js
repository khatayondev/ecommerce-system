import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// Enable CORS for public storefront queries
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database service unavailable' },
        { status: 503, headers: corsHeaders() }
      );
    }

    // Fetch all active products for image & stock calculation
    const productsSnapshot = await adminDb.collection('products').get();
    const productsMap = new Map();
    productsSnapshot.docs.forEach(doc => {
      productsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Fetch promo packages
    const packagesSnapshot = await adminDb.collection('promo_packages').get();
    const bundles = [];

    packagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Only include active packages that are published to online shop
      if (data.isActive === false || data.showOnline === false) {
        return;
      }

      // Check live stock feasibility
      let minPossible = 9999;
      const resolvedItems = (data.items || []).map(item => {
        const prod = productsMap.get(item.product_id);
        const stock = prod ? (prod.stockLevel || 0) : 0;
        const requiredQty = parseInt(item.quantity) || 1;
        const possible = Math.floor(stock / requiredQty);
        if (possible < minPossible) {
          minPossible = possible;
        }

        return {
          product_id: item.product_id,
          product_name: prod ? prod.name : item.product_name || 'Honey Product',
          quantity: requiredQty,
          unit_price: prod ? (prod.sellingPrice || item.unit_price || 0) : (item.unit_price || 0),
          image: prod?.image || null,
          spec: prod?.spec || ''
        };
      });

      const inStock = minPossible > 0;
      const regularTotal = Number(data.regular_total || 0);
      const packagePrice = Number(data.package_price || 0);
      const savings = Math.max(0, regularTotal - packagePrice);
      const discountPercent = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

      bundles.push({
        id: doc.id,
        name: data.name,
        badge: data.badge || (savings > 0 ? `Save ₵${savings.toFixed(0)}` : null),
        description: data.description || '',
        package_price: packagePrice,
        regular_total: regularTotal,
        savings,
        discount_percent: discountPercent,
        inStock,
        availableStock: inStock ? minPossible : 0,
        items: resolvedItems,
        createdAt: data.createdAt || null
      });
    });

    return NextResponse.json(
      {
        success: true,
        count: bundles.length,
        bundles
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('[API /api/bundles] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
