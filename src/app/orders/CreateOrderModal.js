'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, setDoc, query, where, updateDoc, runTransaction } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CreateOrderModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [orderType, setOrderType] = useState('delivery'); // delivery or pickup
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [activePromo, setActivePromo] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('unpaid'); // paid or unpaid
  const [notes, setNotes] = useState('');

  // Cart items: [{ product_id, name, quantity, price }]
  const [cart, setCart] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductQty, setSelectedProductQty] = useState(1);

  useEffect(() => {
    async function loadProducts() {
      if (!db) {
        setProducts([
          { id: 'bottle-500ml', name: '500ml Honey Bottle', price: 45.00, stockLevel: 20 },
          { id: 'gallon-4.5l', name: '4.5L Honey Gallon', price: 300.00, stockLevel: 10 }
        ]);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDocs(collection(db, 'products'));
        const list = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setProducts(list);
        if (list.length > 0) {
          setSelectedProductId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // Lock background scroll and handle Escape key
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleAddProduct = () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    // Check if already in cart
    const existing = cart.find(item => item.id === prod.id);
    if (existing) {
      setCart(cart.map(item => item.id === prod.id ? { ...item, quantity: item.quantity + selectedProductQty } : item));
    } else {
      setCart([...cart, {
        id: prod.id,
        name: prod.name,
        quantity: selectedProductQty,
        price: prod.price || 0
      }]);
    }
    setSelectedProductQty(1);
  };

  const handleRemoveProduct = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  let promoDiscount = 0;
  if (activePromo) {
    if (activePromo.type === 'percentage') {
      promoDiscount = subtotal * (activePromo.value / 100);
    } else {
      promoDiscount = activePromo.value;
    }
  }
  
  const totalDiscount = Number(discount) + promoDiscount;
  const total = Math.max(0, subtotal + Number(deliveryFee) - totalDiscount);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      toast.error('Enter a promo code.');
      return;
    }
    try {
      const q = query(
        collection(db, 'promos'),
        where('code', '==', promoCode.trim().toUpperCase()),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('Invalid or inactive promo code.');
        return;
      }
      const promo = { ...snap.docs[0].data(), id: snap.docs[0].id };
      
      if (promo.minOrder > 0 && subtotal < promo.minOrder) {
        toast.error(`Minimum order value of GHS ${promo.minOrder} required.`);
        return;
      }
      if (promo.maxUses > 0 && (promo.usesCount || 0) >= promo.maxUses) {
        toast.error('Promo code has reached max uses.');
        return;
      }
      if (promo.validFrom && new Date(promo.validFrom) > new Date()) {
        toast.error('Promo code not active yet.');
        return;
      }
      if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
        toast.error('Promo code has expired.');
        return;
      }

      setActivePromo(promo);
      toast.success(`Promo code "${promo.code}" applied!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to validate promo.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error("Please add at least one product to the order.");
      return;
    }

    setIsSubmitting(true);
    const orderNumber = `THP-PH-${Math.floor(10000 + Math.random() * 90000)}`;

    const orderPayload = {
      order_number: orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      orderType,
      deliveryAddress: orderType === 'pickup' ? 'Amrahia Warehouse Collection' : deliveryAddress,
      deliveryFee: orderType === 'pickup' ? 0 : Number(deliveryFee),
      discount: totalDiscount,
      promo_code: activePromo ? activePromo.code : null,
      subtotal,
      totalAmount: total,
      paymentStatus,
      channel: 'phone',
      status: 'pending',
      notes,
      cartItems: cart,
      items: cart.map(item => `${item.quantity}x ${item.name}`).join(', '),
      created_by: user?.uid || null,
      created_by_name: user?.full_name || 'Staff',
      createdAt: new Date().toISOString(),
      placed_at: new Date().toISOString()
    };

    if (!db) {
      onCreated({ id: `offline-${Date.now()}`, ...orderPayload });
      toast.success("Order created successfully (Sandbox Mode)!");
      setIsSubmitting(false);
      onClose();
      return;
    }

    try {
      const orderCol = collection(db, 'orders');
      const docRef = await addDoc(orderCol, orderPayload);
      
      if (customerPhone) {
        const customerRef = doc(db, 'customers', customerPhone);
        await setDoc(customerRef, {
          name: customerName,
          phone: customerPhone,
          email: customerEmail || '',
          address: deliveryAddress || '',
          lastOrderAt: new Date().toISOString()
        }, { merge: true });
      }

      const historyRef = doc(db, 'order_status_history', `hist-${Date.now().toString(36)}-${docRef.id}`);
      await setDoc(historyRef, {
        order_id: docRef.id,
        status: 'pending',
        changed_by: user?.uid || 'system',
        changed_by_name: user?.full_name || 'Staff',
        changed_at: new Date().toISOString(),
        notes: `Order created manually by ${user?.full_name || 'Staff'}.`
      });

      // Notify Admin
      try {
        await addDoc(collection(db, 'notifications'), {
          title: '📝 New Manual Order Created',
          message: `Order #${orderNumber} for ${customerName} (₵${total.toFixed(2)}) entered by ${user?.full_name || 'Staff'}.`,
          time: new Date().toISOString(),
          unread: true,
          link: '/orders'
        });
      } catch (notifErr) {
        console.warn('Manual order notification warning:', notifErr);
      }

      // Update Promo usage count if applicable
      if (activePromo) {
        try {
          await runTransaction(db, async (transaction) => {
            const promoRef = doc(db, 'promos', activePromo.id);
            const promoSnap = await transaction.get(promoRef);
            if (promoSnap.exists()) {
              const currentUses = promoSnap.data().usesCount || 0;
              transaction.update(promoRef, { usesCount: currentUses + 1 });
            }
          });
        } catch (promoErr) {
          console.error('Failed to update promo usage count:', promoErr);
        }
      }

      // Automatically trigger email & SMS notification based on payment status
      if (customerEmail || customerPhone) {
        try {
          if (paymentStatus === 'paid') {
            // Product paid immediately -> Send Product Payment Receipt via Email & SMS
            fetch('/api/send-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerEmail: customerEmail || null,
                customerPhone: customerPhone || null,
                receipt: {
                  id: orderNumber,
                  cartItems: cart,
                  subtotal: subtotal,
                  tax: 0,
                  total: total,
                  discount: totalDiscount,
                  sale_date: new Date().toISOString(),
                  customer_name: customerName,
                  payment_method: 'Prepaid'
                },
                channel: 'both'
              })
            }).catch(err => console.error('Failed to trigger receipt notification:', err));
          } else {
            // Unpaid -> Send Invoice / Delivery Link
            fetch('/api/send-invoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: docRef.id,
                ...orderPayload
              })
            }).catch(err => console.error('Failed to trigger invoice notification:', err));
          }
        } catch (notifErr) {
          console.error('Error dispatching order notification:', notifErr);
        }
      }

      toast.success("Order logged successfully!");
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create phone order:", err);
      toast.error(`Failed to save order: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden"
    >
      <div className="bg-bg-card border border-gold/15 p-6 rounded-2xl w-full max-w-xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Title */}
        <div className="flex justify-between items-center border-b border-gold/10 pb-4">
          <h3 className="text-lg font-display font-semibold text-white">Log Phone / Offline Order</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-white/5 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Customer Details Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gold uppercase tracking-wider">Customer Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Customer Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +233 24 123 4567"
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white font-mono"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Email Address (Optional)</label>
              <input
                type="email"
                placeholder="e.g. john@example.com"
                className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Fulfillment details */}
          <div className="space-y-3 pt-2 border-t border-gold/10">
            <h4 className="text-xs font-semibold text-gold uppercase tracking-wider">Fulfillment & Delivery</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Order Type</label>
                <select
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2.5 rounded-lg text-white"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                >
                  <option value="delivery">Delivery</option>
                  <option value="pickup">Pickup (Collection)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Payment Initial Status</label>
                <select
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2.5 rounded-lg text-white"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="unpaid">Unpaid / COD</option>
                  <option value="paid">Prepaid / Paid</option>
                </select>
              </div>
            </div>

            {orderType === 'delivery' && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-muted">Delivery Address *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Enter full shipping / drop-off address"
                    className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white resize-none"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted">Delivery Fee (₵)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white font-mono"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted">Manual Discount (₵)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white font-mono"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-xs text-text-muted">Promo / Coupon Code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. SUMMER20"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        disabled={!!activePromo}
                        className="flex-1 bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white font-mono uppercase"
                      />
                      {activePromo ? (
                        <button
                          type="button"
                          onClick={() => { setActivePromo(null); setPromoCode(''); }}
                          className="px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="px-3 bg-gold hover:bg-gold-light text-bg-dark rounded-lg text-xs font-bold transition"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Product selector & cart */}
          <div className="space-y-3 pt-2 border-t border-gold/10">
            <h4 className="text-xs font-semibold text-gold uppercase tracking-wider">Order Items</h4>
            
            {/* Selector inputs */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-text-muted">Select Product</label>
                <select
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2.5 rounded-lg text-white"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={loading}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₵{(p.price || 0).toFixed(2)})</option>
                  ))}
                </select>
              </div>
              <div className="w-20 flex flex-col gap-1">
                <label className="text-xs text-text-muted">Qty</label>
                <input
                  type="number"
                  min="1"
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white font-mono"
                  value={selectedProductQty}
                  onChange={(e) => setSelectedProductQty(parseInt(e.target.value) || 1)}
                />
              </div>
              <button
                type="button"
                onClick={handleAddProduct}
                className="bg-gold text-black px-3 py-2.5 rounded-lg hover:bg-gold-hover font-semibold flex items-center gap-1.5 h-[42px]"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* Cart list table */}
            {cart.length > 0 && (
              <div className="border border-gold/10 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left text-white">
                  <thead>
                    <tr className="bg-bg-dark/40 text-text-muted border-b border-gold/5 font-semibold">
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Price</th>
                      <th className="p-2.5 text-center w-10">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.id} className="border-b border-gold/5 hover:bg-white/5 transition-all">
                        <td className="p-2.5 font-medium">{item.name}</td>
                        <td className="p-2.5 text-center font-mono">{item.quantity}</td>
                        <td className="p-2.5 text-right font-mono">₵{(item.price * item.quantity).toFixed(2)}</td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(item.id)}
                            className="text-text-muted hover:text-gold transition p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pricing summary */}
          <div className="bg-bg-dark/40 p-3 rounded-lg border border-gold/10 space-y-1.5 font-mono text-xs text-white">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal:</span>
              <span>₵{subtotal.toFixed(2)}</span>
            </div>
            {orderType === 'delivery' && deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-text-muted">Delivery Fee:</span>
                <span>₵{deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {totalDiscount > 0 && (
              <div className="flex justify-between text-amber-500 font-semibold">
                <span>Discount:</span>
                <span>-₵{totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-gold/10 pt-1.5 text-gold text-sm">
              <span>Total amount:</span>
              <span>₵{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Intake Notes / Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Call customer before arrival"
              className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-3 border-t border-gold/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gold/20 text-gold rounded-lg hover:bg-gold/10 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gold text-black rounded-lg hover:bg-gold-hover font-bold shadow-md"
            >
              Record Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
