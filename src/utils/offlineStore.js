/**
 * Offline Store Utility for POS Offline Support
 * Handles local caching of products, customers, exhibitions, and queued offline transactions.
 */
import { doc, setDoc, updateDoc, increment, collection, addDoc } from 'firebase/firestore';

const KEYS = {
  PRODUCTS: 'thp_pos_products_cache',
  CUSTOMERS: 'thp_pos_customers_cache',
  EXHIBITIONS: 'thp_pos_exhibitions_cache',
  BATCHES: 'thp_pos_batches_cache',
  OFFLINE_SALES: 'thp_pos_offline_sales_queue'
};

// Safe localStorage access helper
const safeGetItem = (key, defaultValue = []) => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`[OfflineStore] Error reading ${key}:`, e);
    return defaultValue;
  }
};

const safeSetItem = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[OfflineStore] Error setting ${key}:`, e);
  }
};

// Catalog Caching
export const cacheProducts = (products) => safeSetItem(KEYS.PRODUCTS, products);
export const getCachedProducts = () => safeGetItem(KEYS.PRODUCTS, []);
export const removeCachedProduct = (productId) => {
  const current = getCachedProducts();
  const updated = current.filter(p => p.id !== productId);
  cacheProducts(updated);
  return updated;
};

export const cacheCustomers = (customers) => safeSetItem(KEYS.CUSTOMERS, customers);
export const getCachedCustomers = () => safeGetItem(KEYS.CUSTOMERS, []);

export const cacheExhibitions = (exhibitions) => safeSetItem(KEYS.EXHIBITIONS, exhibitions);
export const getCachedExhibitions = () => safeGetItem(KEYS.EXHIBITIONS, []);

export const cacheBatches = (batches) => safeSetItem(KEYS.BATCHES, batches);
export const getCachedBatches = () => safeGetItem(KEYS.BATCHES, []);

// Offline Sales Queue Management
export const getOfflineSalesQueue = () => safeGetItem(KEYS.OFFLINE_SALES, []);

export const addOfflineSale = (salePayload) => {
  const currentQueue = getOfflineSalesQueue();
  const updatedQueue = [...currentQueue, {
    ...salePayload,
    isOfflineQueued: true,
    queuedAt: new Date().toISOString()
  }];
  safeSetItem(KEYS.OFFLINE_SALES, updatedQueue);
  return updatedQueue;
};

export const clearOfflineSale = (saleId) => {
  const currentQueue = getOfflineSalesQueue();
  const updatedQueue = currentQueue.filter(s => s.id !== saleId && s.sale_id !== saleId);
  safeSetItem(KEYS.OFFLINE_SALES, updatedQueue);
  return updatedQueue;
};

// Sync Queued Offline Sales to Firebase
export const syncOfflineSales = async (db, onSyncProgress) => {
  const queue = getOfflineSalesQueue();
  if (!queue || queue.length === 0) {
    return { success: true, count: 0 };
  }

  let syncedCount = 0;
  const errors = [];

  for (const sale of queue) {
    try {
      const saleId = sale.id || sale.sale_id;
      const paymentId = `pay-${saleId}`;

      // Clean payload before saving to Firestore
      const { isOfflineQueued, queuedAt, ...cleanSalePayload } = sale;

      // 1. Write sale document
      const saleRef = doc(db, 'sales', saleId);
      await setDoc(saleRef, cleanSalePayload);

      // 2. Write payment document
      const paymentRef = doc(db, 'payments', paymentId);
      await setDoc(paymentRef, {
        sale_id: saleId,
        amount: cleanSalePayload.total,
        method: cleanSalePayload.payment_method,
        reference: `POS Offline Order ${saleId}`,
        paid_at: cleanSalePayload.sale_date
      });

      // 3. Decrement Product Stock in Firestore
      if (cleanSalePayload.cartItems && Array.isArray(cleanSalePayload.cartItems)) {
        for (const item of cleanSalePayload.cartItems) {
          try {
            if (item.isPackage && Array.isArray(item.packageItems)) {
              for (const comp of item.packageItems) {
                const compId = comp.product_id;
                const compQty = (parseInt(comp.quantity) || 1) * (item.quantity || 1);
                if (compId) {
                  const compRef = doc(db, 'products', compId);
                  await updateDoc(compRef, {
                    stockLevel: increment(-compQty)
                  });
                }
              }
            } else if (item.id) {
              const productRef = doc(db, 'products', item.id);
              await updateDoc(productRef, {
                stockLevel: increment(-item.quantity)
              });
            }
          } catch (err) {
            console.warn(`[OfflineStore] Stock decrement warning for item ${item.id}:`, err);
          }
        }
      }

      // 4. Update exhibition sales total if exhibition attached
      if (cleanSalePayload.exhibition_id && cleanSalePayload.exhibition_id !== 'none') {
        try {
          const exRef = doc(db, 'exhibitions', cleanSalePayload.exhibition_id);
          await updateDoc(exRef, { sales_total: increment(cleanSalePayload.total) });
        } catch (exErr) {
          console.warn('[OfflineStore] Exhibition sales increment warning:', exErr);
        }
      }

      // Notify admin of synced offline sale
      try {
        await addDoc(collection(db, 'notifications'), {
          title: '🔄 Offline Sale Synced',
          message: `Offline Sale #${saleId} (₵${(cleanSalePayload.total || 0).toFixed(2)}) processed by ${cleanSalePayload.user_name || 'Staff'} synced successfully.`,
          time: new Date().toISOString(),
          unread: true,
          link: '/reports'
        });
      } catch (notifErr) {
        console.warn('[OfflineStore] Synced sale notification warning:', notifErr);
      }

      // Remove from local queue
      clearOfflineSale(saleId);
      syncedCount++;

      if (onSyncProgress) {
        onSyncProgress(syncedCount, queue.length);
      }
    } catch (err) {
      console.error(`[OfflineStore] Failed to sync sale ${sale.id}:`, err);
      errors.push({ saleId: sale.id, error: err.message });
    }
  }

  return {
    success: errors.length === 0,
    syncedCount,
    total: queue.length,
    errors
  };
};
