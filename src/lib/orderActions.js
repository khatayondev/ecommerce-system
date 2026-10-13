import { db } from './firebase';
import { doc, runTransaction, collection, getDocs, query, where } from 'firebase/firestore';
import { logAction } from '@/utils/logging';

/**
 * Helper to resolve the correct product document when online store IDs (e.g. size-type)
 * mismatch with core inventory IDs.
 */
async function resolveProduct(transaction, itemId) {
  let resolvedId = itemId;
  let productRef = doc(db, 'products', resolvedId);
  let productSnap = await transaction.get(productRef);

  if (!productSnap.exists()) {
    const suffixes = ['-multifloral', '-acacia', '-moringa', '-neem', '-baobab', '-mango', '-cashew'];
    for (const suffix of suffixes) {
      if (itemId.endsWith(suffix)) {
        if (suffix === '-multifloral') {
          resolvedId = itemId.slice(0, -suffix.length);
        } else {
          resolvedId = suffix.slice(1);
        }
        productRef = doc(db, 'products', resolvedId);
        productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          break;
        }
      }
    }
  }

  return { resolvedId, productRef, productSnap };
}

/**
 * Transition order to Preparing (This now reserves stock)
 */
export async function startPreparing(orderId, userId, userName) {
  if (!db) throw new Error("Database not connected.");

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Order does not exist.");

    const orderData = orderSnap.data();
    const currentStatus = orderData.status?.toLowerCase();
    
    // Allow transitioning from pending, paid, confirmed, or awaiting_payment directly to preparing
    const allowed = ['confirmed', 'pending', 'paid', 'awaiting_payment', 'pending_delivery_payment'];
    if (!allowed.includes(currentStatus)) {
      throw new Error(`Order is in status '${orderData.status}', cannot start preparing.`);
    }

    // Check and reserve stock since we skipped the 'accept' step
    const cartItems = orderData.cartItems || [];
    
    // --- PHASE 1: READS ---
    const productData = [];
    for (const item of cartItems) {
      const { resolvedId, productRef, productSnap } = await resolveProduct(transaction, item.id);
      if (!productSnap.exists()) {
        console.warn(`[WARN] Product ${item.name} (id: ${item.id}) does not exist in inventory. Skipping reservation.`);
        continue;
      }

      const currentStock = productSnap.data().stockLevel || 0;
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}. Available: ${currentStock}`);
      }
      
      productData.push({ ref: productRef, stock: currentStock, item: item, resolvedId });
    }

    // --- PHASE 2: WRITES ---
    for (const data of productData) {
      // Reserve stock (decrement stock level)
      transaction.update(data.ref, {
        stockLevel: data.stock - data.item.quantity,
        lastUpdated: new Date().toISOString()
      });

      // Record reserved stock movement
      const movementId = `mov-res-${Date.now().toString(36)}-${data.resolvedId}`;
      const movementRef = doc(db, 'stock_movements', movementId);
      transaction.set(movementRef, {
        product_id: data.resolvedId,
        movement_type: 'reserved',
        quantity: data.item.quantity,
        reference: `Order Reserved (Preparing) ${orderId}`,
        moved_at: new Date().toISOString()
      });
    }

    transaction.update(orderRef, {
      status: 'preparing',
      updatedAt: new Date().toISOString()
    });

    const historyRef = doc(db, 'order_status_history', `hist-${Date.now().toString(36)}-${orderId}`);
    transaction.set(historyRef, {
      order_id: orderId,
      status: 'preparing',
      changed_by: userId || 'system',
      changed_by_name: userName || 'System',
      changed_at: new Date().toISOString(),
      note: 'Started preparing/packing order. Stock reserved.'
    });
  });

  await logAction({
    module: 'ORDERS',
    action: 'START_PREPARING',
    details: `Order #${orderId} moved to Preparing (stock reserved)`,
    targetId: orderId,
    severity: 'info',
    userName: userName || 'Staff',
    userEmail: userId?.includes('@') ? userId : ''
  });
}

/**
 * Transition order to Ready
 */
export async function markReady(orderId, userId, userName) {
  if (!db) throw new Error("Database not connected.");

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Order does not exist.");

    const orderData = orderSnap.data();
    const currentStatus = orderData.status?.toLowerCase();
    if (currentStatus !== 'preparing') {
      throw new Error(`Order is not preparing. Current status is: ${orderData.status}`);
    }

    transaction.update(orderRef, {
      status: 'ready',
      updatedAt: new Date().toISOString()
    });

    const historyRef = doc(db, 'order_status_history', `hist-${Date.now().toString(36)}-${orderId}`);
    transaction.set(historyRef, {
      order_id: orderId,
      status: 'ready',
      changed_by: userId || 'system',
      changed_by_name: userName || 'System',
      changed_at: new Date().toISOString(),
      note: 'Order packed and ready.'
    });
  });

  await logAction({
    module: 'ORDERS',
    action: 'ORDER_READY',
    details: `Order #${orderId} marked as Ready / Packed`,
    targetId: orderId,
    severity: 'info',
    userName: userName || 'Staff',
    userEmail: userId?.includes('@') ? userId : ''
  });
}

/**
 * Transition order to OutForDelivery (assign courier)
 */
export async function dispatchDelivery(orderId, courierName, trackingRef, userId, userName) {
  if (!db) throw new Error("Database not connected.");

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Order does not exist.");

    const orderData = orderSnap.data();
    const currentStatus = orderData.status?.toLowerCase();
    if (currentStatus !== 'ready' && currentStatus !== 'preparing') {
      throw new Error(`Order is not ready or preparing.`);
    }

    transaction.update(orderRef, {
      status: 'out_for_delivery',
      updatedAt: new Date().toISOString()
    });

    // Create delivery doc
    const deliveryId = `del-${Date.now().toString(36)}-${orderId}`;
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    transaction.set(deliveryRef, {
      order_id: orderId,
      courier_name: courierName || 'Standard Rider',
      delivery_address: orderData.deliveryAddress || '',
      contact_phone: orderData.customerPhone || '',
      delivery_status: 'dispatched',
      dispatched_at: new Date().toISOString(),
      tracking_ref: trackingRef || ''
    });

    const historyRef = doc(db, 'order_status_history', `hist-${Date.now().toString(36)}-${orderId}`);
    transaction.set(historyRef, {
      order_id: orderId,
      status: 'out_for_delivery',
      changed_by: userId || 'system',
      changed_by_name: userName || 'System',
      changed_at: new Date().toISOString(),
      note: `Dispatched via ${courierName || 'Standard Rider'}.`
    });
  });

  await logAction({
    module: 'ORDERS',
    action: 'DISPATCH_ORDER',
    details: `Order #${orderId} dispatched via ${courierName || 'Standard Rider'}${trackingRef ? ` (Tracking: ${trackingRef})` : ''}`,
    targetId: orderId,
    severity: 'info',
    userName: userName || 'Staff',
    userEmail: userId?.includes('@') ? userId : ''
  });
}

/**
 * Transition order to Completed (Delivered or Collected)
 * Deducts FIFO batch stock, registers Sale & Payment.
 */
export async function completeOrder(orderId, userId, userName, allBatches) {
  if (!db) throw new Error("Database not connected.");

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Order does not exist.");

    const orderData = orderSnap.data();
    const allowedStatuses = ['ready', 'out_for_delivery'];
    if (!allowedStatuses.includes(orderData.status)) {
      throw new Error(`Order status is '${orderData.status}', cannot complete.`);
    }

    const finalStatus = orderData.orderType === 'pickup' ? 'collected' : 'delivered';

    // 1. Log actual out stock movement for the order completion
    // The actual deduction from stockLevel already happened during 'startPreparing'
    const cartItems = orderData.cartItems || [];
    for (const item of cartItems) {
      const { resolvedId } = await resolveProduct(transaction, item.id);
      const movementId = `mov-${Date.now().toString(36)}-${resolvedId}`;
      const movementRef = doc(db, 'stock_movements', movementId);
      transaction.set(movementRef, {
        product_id: resolvedId,
        movement_type: 'out',
        quantity: item.quantity,
        reference: `Order Complete ${orderId}`,
        moved_at: new Date().toISOString()
      });
    }

    // 2. Create Sale Record
    const saleId = `sale-online-${Date.now().toString(36)}`;
    const saleRef = doc(db, 'sales', saleId);
    transaction.set(saleRef, {
      id: saleId,
      customerName: orderData.customerName || 'Online Customer',
      customerPhone: orderData.customerPhone || '',
      items: orderData.items || '',
      cartItems: cartItems,
      subtotal: orderData.subtotal || 0,
      discount: orderData.discount || 0,
      deliveryFee: orderData.deliveryFee || 0,
      totalAmount: orderData.totalAmount || 0,
      paymentMethod: orderData.paymentStatus === 'paid' ? 'Prepaid Online' : 'Cash/COD',
      sale_type: 'online',
      createdAt: new Date().toISOString()
    });

    // 3. Create Payment Record (only if paid now, or if it was prepaid)
    const paymentId = `pay-${Date.now().toString(36)}`;
    const paymentRef = doc(db, 'payments', paymentId);
    transaction.set(paymentRef, {
      id: paymentId,
      sale_id: saleId,
      amount: orderData.totalAmount || 0,
      method: orderData.paymentStatus === 'paid' ? 'Prepaid Online' : 'Cash/COD',
      paid_at: new Date().toISOString()
    });

    // 4. Update Order Document
    transaction.update(orderRef, {
      status: 'completed',
      paymentStatus: 'paid',
      sale_id: saleId,
      updatedAt: new Date().toISOString()
    });

    // Log status history
    const historyRef = doc(db, 'order_status_history', `hist-${Date.now().toString(36)}-${orderId}`);
    transaction.set(historyRef, {
      order_id: orderId,
      status: 'completed',
      changed_by: userId || 'system',
      changed_by_name: userName || 'System',
      changed_at: new Date().toISOString(),
      note: `Order fulfilled (${finalStatus}). Sale logged.`
    });
  });

  await logAction({
    module: 'ORDERS',
    action: 'COMPLETE_ORDER',
    details: `Order #${orderId} fulfilled and marked completed. Sale record created.`,
    targetId: orderId,
    severity: 'success',
    userName: userName || 'Staff',
    userEmail: userId?.includes('@') ? userId : ''
  });
}

/**
 * Cancel order
 * If order was past Confirmed, restores stock levels.
 */
export async function cancelOrder(orderId, reason, userId, userName) {
  if (!db) throw new Error("Database not connected.");

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Order does not exist.");

    const orderData = orderSnap.data();
    if (orderData.status === 'completed' || orderData.status === 'cancelled') {
      throw new Error(`Order in status '${orderData.status}' cannot be cancelled.`);
    }

    // Determine if stock was reserved (status is Preparing, Ready, or Out for Delivery)
    const reservedStatuses = ['preparing', 'ready', 'out_for_delivery'];
    const currentStatus = orderData.status ? orderData.status.toLowerCase() : '';
    const wasStockReserved = reservedStatuses.includes(currentStatus);

    if (wasStockReserved) {
      const cartItems = orderData.cartItems || [];
      
      // --- PHASE 1: READS ---
      const productData = [];
      for (const item of cartItems) {
        const { resolvedId, productRef, productSnap } = await resolveProduct(transaction, item.id);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stockLevel || 0;
          productData.push({ ref: productRef, stock: currentStock, item: item, resolvedId });
        }
      }

      // --- PHASE 2: WRITES ---
      for (const data of productData) {
        transaction.update(data.ref, {
          stockLevel: data.stock + data.item.quantity,
          lastUpdated: new Date().toISOString()
        });

        // Add a release stock movement
        const movementId = `mov-rel-${Date.now().toString(36)}-${data.resolvedId}`;
        const movementRef = doc(db, 'stock_movements', movementId);
        transaction.set(movementRef, {
          product_id: data.resolvedId,
          movement_type: 'release',
          quantity: data.item.quantity,
          reference: `Order Cancelled ${orderId}`,
          moved_at: new Date().toISOString()
        });
      }
    }

    // Update order status
    transaction.update(orderRef, {
      status: 'cancelled',
      cancelReason: reason || 'Not specified',
      updatedAt: new Date().toISOString()
    });

    const historyRef = doc(db, 'order_status_history', `hist-${Date.now().toString(36)}-${orderId}`);
    transaction.set(historyRef, {
      order_id: orderId,
      status: 'cancelled',
      changed_by: userId || 'system',
      changed_by_name: userName || 'System',
      changed_at: new Date().toISOString(),
      note: `Cancelled. Reason: ${reason || 'Not specified'}`
    });
  });

  await logAction({
    module: 'ORDERS',
    action: 'CANCEL_ORDER',
    details: `Order #${orderId} cancelled. Reason: ${reason || 'Not specified'}`,
    targetId: orderId,
    severity: 'danger',
    userName: userName || 'Staff',
    userEmail: userId?.includes('@') ? userId : ''
  });
}
