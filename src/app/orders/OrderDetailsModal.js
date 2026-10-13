'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, setDoc } from 'firebase/firestore';
import { X, Calendar, User, Phone, MapPin, DollarSign, Clock, Shield, CheckCircle2, Truck, Package, RotateCcw, Printer, Edit2, Sliders } from 'lucide-react';
import { startPreparing, markReady, dispatchDelivery, completeOrder } from '@/lib/orderActions';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import toast from 'react-hot-toast';
import OrderSlipModal from './OrderSlipModal';

export default function OrderDetailsModal({ order, onClose }) {
  const { user } = useAuth();
  const { showConfirm } = useUI();
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [courierInput, setCourierInput] = useState('Standard Express Rider');
  const [trackingInput, setTrackingInput] = useState('');

  const confirmDispatch = async (e) => {
    if (e) e.preventDefault();
    if (!courierInput.trim()) {
      toast.error("Please enter a courier / rider name.");
      return;
    }
    
    setProcessingStatus('dispatch');
    try {
      const courier = courierInput.trim();
      const tracking = trackingInput.trim();
      await dispatchDelivery(order.id, courier, tracking, user?.uid, user?.full_name);
      await sendDispatchNotification('out_for_delivery', courier);
      toast.success(`Order dispatched via ${courier}!`);
      setShowDispatchModal(false);
    } catch (err) {
      toast.error(`Dispatch failed: ${err.message}`);
    } finally {
      setProcessingStatus('');
    }
  };

  // Stepper state
  const currentStep = getStepFromStatus(order?.status);

  function getStepFromStatus(status) {
    const s = status?.toLowerCase();
    switch (s) {
      case 'pending': 
      case 'paid': 
      case 'confirmed': return 0;
      case 'preparing': return 1;
      case 'ready': 
      case 'out_for_delivery': return 2;
      case 'completed': 
      case 'delivered': 
      case 'collected': return 3;
      default: return 0;
    }
  }

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

  useEffect(() => {
    async function fetchHistory() {
      if (!db || !order?.id) return;
      setLoadingHistory(true);
      try {
        const q = query(
          collection(db, 'order_status_history'),
          where('order_id', '==', order.id),
          orderBy('changed_at', 'asc')
        );
        const snap = await getDocs(q);
        const list = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setHistory(list);
      } catch (err) {
        console.error("Failed to load status history:", err);
      } finally {
        setLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [order, processingStatus]); // Re-fetch on status change

  if (!order) return null;

  const handleAction = async (actionType) => {
    try {
      setProcessingStatus(actionType);
      
      if (actionType === 'prepare') {
        await startPreparing(order.id, user?.uid, user?.full_name);
      } else if (actionType === 'ready') {
        await markReady(order.id, user?.uid, user?.full_name);
        await sendDispatchNotification('ready');
      } else if (actionType === 'dispatch') {
        setProcessingStatus('');
        setShowDispatchModal(true);
        return;
      } else if (actionType === 'complete') {
        await completeOrder(order.id, user?.uid, user?.full_name, []);
        
        // Trigger completion receipt email & SMS ONLY if not already sent on payment
        const targetEmail = order.customerEmail || null;
        const targetPhone = order.customerPhone || order.phone || null;
        const alreadySent = order.receipt_sent === true || order.receiptSent === true || order.orderType === 'booth_pickup' || order.deliveryType === 'booth_pickup';

        if ((targetEmail || targetPhone) && !alreadySent) {
          try {
            await fetch('/api/send-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerEmail: targetEmail,
                customerPhone: targetPhone,
                receipt: {
                  id: order.order_number || order.id,
                  cartItems: order.cartItems || [],
                  subtotal: order.subtotal || order.totalAmount || 0,
                  tax: order.tax || 0,
                  total: order.totalAmount || 0,
                  discount: order.discount || 0,
                  sale_date: new Date().toISOString(),
                  customer_name: order.customerName || 'Valued Customer',
                  payment_method: order.paymentStatus === 'paid' ? 'Prepaid Online' : 'Payment on Delivery'
                },
                channel: 'both'
              })
            });
          } catch (receiptErr) {
            console.error("Failed to trigger completion receipt:", receiptErr);
          }
        }
      }
      
      // Close modal on complete to refresh parent view
      if (actionType === 'complete') {
        toast.success("Order completed and receipt sent!");
        onClose();
        setProcessingStatus('');
        toast.success("Order status updated!");
      }
    } catch (err) {
      toast.error(`Action failed: ${err.message}`);
      setProcessingStatus('');
    }
  };

  const handleMarkPaid = async () => {
    const isConfirmed = await showConfirm({
      title: 'Confirm Payment',
      message: `Are you sure you want to mark Order ${order.order_number || order.id} as manually paid? This will set status to Confirmed.`,
      confirmText: 'Yes, Paid'
    });
    if (!isConfirmed) return;

    setProcessingStatus('markPaid');
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        status: 'confirmed',
        updatedAt: new Date().toISOString()
      });

      // Log status history
      const historyRef = doc(db, 'order_status_history', `hist-${Date.now().toString(36)}-${order.id}`);
      await setDoc(historyRef, {
        order_id: order.id,
        status: 'confirmed',
        changed_by: user?.uid || 'system',
        changed_by_name: user?.full_name || 'System',
        changed_at: new Date().toISOString(),
        note: 'Marked paid manually by admin.'
      });

      // Send payment receipt via Email & SMS ONLY if not already sent
      const targetEmail = order.customerEmail || null;
      const targetPhone = order.customerPhone || order.phone || null;
      const alreadySent = order.receipt_sent === true || order.receiptSent === true || order.orderType === 'booth_pickup' || order.deliveryType === 'booth_pickup';

      if ((targetEmail || targetPhone) && !alreadySent) {
        try {
          await fetch('/api/send-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerEmail: targetEmail,
              customerPhone: targetPhone,
              receipt: {
                id: order.order_number || order.id,
                cartItems: order.cartItems || [],
                subtotal: order.subtotal || order.totalAmount || 0,
                tax: order.tax || 0,
                total: order.totalAmount || 0,
                discount: order.discount || 0,
                sale_date: new Date().toISOString(),
                customer_name: order.customerName || 'Valued Customer',
                payment_method: 'Paid'
              },
              channel: 'both'
            })
          });
        } catch (receiptErr) {
          console.error("Failed to trigger mark paid receipt:", receiptErr);
        }
      }

      toast.success("Order marked as paid & receipt sent!");
    } catch (err) {
      console.error(err);
      toast.error(`Failed to mark paid: ${err.message}`);
    } finally {
      setProcessingStatus('');
    }
  };

  const sendDispatchNotification = async (status, courierName = '') => {
    if (!order.customerEmail && !order.customerPhone && !order.phone) return;
    
    try {
      await fetch('/api/send-dispatch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order,
          customerEmail: order.customerEmail || '',
          customerPhone: order.customerPhone || order.phone || '',
          customerName: order.customerName || '',
          courierName,
          status
        })
      });
    } catch (err) {
      console.error("Failed to trigger dispatch notification API", err);
    }
  };


  const handleManualStatusOverride = async (newStatus) => {
    if (!newStatus || newStatus === order.status) return;

    const isConfirmed = await showConfirm({
      title: 'Update Fulfillment Status',
      message: `Change order fulfillment status from "${order.status || 'pending'}" to "${newStatus.replace(/_/g, ' ')}"?`,
      confirmText: 'Yes, Update Status'
    });
    if (!isConfirmed) return;

    setProcessingStatus('statusOverride');
    try {
      if (db && order.id) {
        const orderRef = doc(db, 'orders', order.id);
        await updateDoc(orderRef, {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });

        const historyRef = doc(db, 'order_status_history', `hist-${Date.now().toString(36)}-${order.id}`);
        await setDoc(historyRef, {
          order_id: order.id,
          status: newStatus,
          changed_by: user?.uid || 'staff',
          changed_by_name: user?.full_name || 'Staff',
          changed_at: new Date().toISOString(),
          note: `Manual status override to ${newStatus}`
        });
      }

      toast.success(`Fulfillment status updated to ${newStatus.replace(/_/g, ' ')}!`);
      order.status = newStatus;
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update status: ${err.message}`);
    } finally {
      setProcessingStatus('');
    }
  };

  const handleTogglePaymentStatus = async () => {
    const nextPaymentStatus = order.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    const isConfirmed = await showConfirm({
      title: 'Update Payment Status',
      message: `Change payment status to ${nextPaymentStatus.toUpperCase()}?`,
      confirmText: 'Confirm'
    });
    if (!isConfirmed) return;

    setProcessingStatus('togglePayment');
    try {
      if (db && order.id) {
        const orderRef = doc(db, 'orders', order.id);
        await updateDoc(orderRef, {
          paymentStatus: nextPaymentStatus,
          updatedAt: new Date().toISOString()
        });
      }
      toast.success(`Payment status marked as ${nextPaymentStatus.toUpperCase()}!`);
      order.paymentStatus = nextPaymentStatus;
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update payment status: ${err.message}`);
    } finally {
      setProcessingStatus('');
    }
  };

  const handleSetDeliveryCost = async () => {
    if (!deliveryFeeInput || isNaN(deliveryFeeInput) || Number(deliveryFeeInput) < 0) {
      toast.error("Please enter a valid delivery fee");
      return;
    }
    
    setProcessingStatus('deliveryCost');
    try {
      const fee = Number(deliveryFeeInput);
      const sub = order.subtotal || 0;
      const disc = order.discount || order.discountAmount || 0;
      const newTotal = sub - disc + fee;
      
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        deliveryFee: fee,
        totalAmount: newTotal,
        status: 'AWAITING_PAYMENT',
        updatedAt: new Date().toISOString()
      });
      
      // Send API request to trigger invoice, paystack link, email, SMS
      const apiRes = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...order,
          deliveryFee: fee,
          totalAmount: newTotal,
          status: 'AWAITING_PAYMENT'
        })
      });
      
      const resData = await apiRes.json();
      if (!apiRes.ok) throw new Error(resData.error || "Failed to send invoice");
      
      toast.success("Delivery cost set and payment link sent!");
      setDeliveryFeeInput('');
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Something went wrong");
    } finally {
      setProcessingStatus('');
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden"
    >
      <div className="bg-white border border-gray-200 p-6 rounded-2xl w-full max-w-2xl space-y-6 max-h-[92vh] overflow-y-auto text-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-display font-bold text-gray-900 flex items-center gap-2">
              Order {order.order_number || order.id}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Placed on {new Date(order.placed_at || order.createdAt).toLocaleString('en-GB')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSlipModal(true)}
              className="px-3.5 py-2 bg-[#ffa200] hover:bg-[#e69100] text-black text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> Print Order Slip
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        
        {order.status === 'PENDING_DELIVERY_COST' && (
          <div className="bg-rose-50 border border-rose-200 p-4 sm:p-5 rounded-xl mb-6">
            <h4 className="text-rose-800 font-bold mb-1.5 text-sm sm:text-base">Delivery Cost Required</h4>
            <p className="text-xs text-rose-600 mb-3.5 leading-relaxed">
              This order requires a delivery fee before the customer can pay. Please enter the exact delivery fee to generate the payment link.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-xs sm:text-sm">GHS</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={deliveryFeeInput}
                  onChange={(e) => setDeliveryFeeInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 bg-white text-gray-900 border border-rose-300 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none text-base font-semibold shadow-sm"
                />
              </div>
              <button
                onClick={handleSetDeliveryCost}
                disabled={!!processingStatus}
                className="w-full sm:w-auto bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-rose-700 transition disabled:opacity-50 text-sm whitespace-nowrap shadow-sm flex items-center justify-center gap-2"
              >
                {processingStatus === 'deliveryCost' ? 'Processing...' : 'Set Delivery & Send Link'}
              </button>
            </div>
          </div>
        )}

        {/* --- STEPPER UI --- */}

        {order.status !== 'cancelled' && (
          <div className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gray-200 -z-10 -translate-y-1/2" />
              <div className={`absolute top-1/2 left-0 h-[2px] bg-blue-500 -z-10 -translate-y-1/2 transition-all duration-500`} style={{ width: `${(Math.min(currentStep, 2) / 2) * 100}%` }} />
              
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${currentStep >= 1 ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-300 text-gray-400'}`}>
                  {currentStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : <Package className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>Processing</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${currentStep >= 2 ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-300 text-gray-400'}`}>
                  {currentStep > 2 ? <CheckCircle2 className="w-5 h-5" /> : <Truck className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>Dispatched</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${currentStep >= 3 ? 'bg-[#ffa200] text-black shadow-md' : 'bg-white border border-gray-300 text-gray-400'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${currentStep >= 3 ? 'text-[#D07B00]' : 'text-gray-400'}`}>Complete</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center border-t border-gray-200 pt-4">
              {currentStep === 0 && (
                <div className="flex gap-3">
                  <button onClick={() => handleAction('prepare')} disabled={!!processingStatus} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50">
                    {processingStatus === 'prepare' ? 'Processing...' : 'Start Processing'}
                  </button>
                  {order.status === 'AWAITING_PAYMENT' && (
                    <button onClick={handleMarkPaid} disabled={!!processingStatus} className="bg-[#ffa200] hover:bg-[#D07B00] text-black px-6 py-2 rounded-lg font-bold transition disabled:opacity-50">
                      {processingStatus === 'markPaid' ? 'Processing...' : 'Mark as Paid'}
                    </button>
                  )}
                </div>
              )}
              {currentStep === 1 && (
                <button onClick={() => handleAction(order.orderType === 'pickup' ? 'ready' : 'dispatch')} disabled={!!processingStatus} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-50">
                  {processingStatus ? 'Updating...' : order.orderType === 'pickup' ? 'Mark Ready for Pickup' : 'Dispatch for Delivery'}
                </button>
              )}
              {currentStep === 2 && (
                <button onClick={() => handleAction('complete')} disabled={!!processingStatus} className="bg-[#ffa200] hover:bg-[#D07B00] text-black px-6 py-2 rounded-lg font-bold transition disabled:opacity-50">
                  {processingStatus === 'complete' ? 'Completing...' : 'Complete Order'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" /> Customer Information
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-gray-500">Name:</span> {order.customerName || 'N/A'}</p>
                <p className="flex items-center gap-2"><Phone className="w-3 h-3 text-gray-400" /> {order.customerPhone || 'N/A'}</p>
                <p><span className="font-medium text-gray-500">Email:</span> {order.customerEmail || 'N/A'}</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" /> Delivery Information
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-gray-500">Type:</span> <span className="capitalize font-bold text-gray-900">{order.orderType || order.deliveryType || 'delivery'}</span></p>
                {order.deliveryAreaName && (
                  <p><span className="font-medium text-gray-500">Delivery Zone:</span> <span className="font-semibold text-gray-900">{order.deliveryAreaName}</span></p>
                )}
                {order.orderType === 'delivery' && (
                  <>
                    <p><span className="font-medium text-gray-500">Address:</span> <span className="text-gray-900">{order.deliveryAddress || 'N/A'}</span></p>
                    <p><span className="font-medium text-gray-500">Upfront Fee:</span> <span className="font-bold text-gray-900">GHS {Number(order.deliveryFee || 0).toFixed(2)}</span></p>
                  </>
                )}
                {(order.deliveryNotes || order.deliveryInstructions) && (
                  <p className="text-xs italic bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 font-medium">
                    Notes: "{order.deliveryNotes || order.deliveryInstructions}"
                  </p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center justify-between">
                <span className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-gray-500" /> Payment &amp; Status</span>
                <span className="text-[10px] text-gray-400 uppercase font-mono">Manual Controls</span>
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1.5">
                  <p className="text-gray-500 text-xs">Payment</p>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${order.paymentStatus === 'paid' ? 'bg-[#ffa200]/15 text-[#D07B00]' : 'bg-yellow-100 text-yellow-800'}`}>
                      {order.paymentStatus?.toUpperCase() || 'UNPAID'}
                    </span>
                    <button
                      type="button"
                      onClick={handleTogglePaymentStatus}
                      disabled={!!processingStatus}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline"
                    >
                      {order.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-gray-500 text-xs">Fulfillment Status</p>
                  <span className="px-2 py-0.5 rounded text-xs font-bold capitalize bg-gray-200 text-gray-800 block w-fit">
                    {order.status?.replace(/_/g, ' ') || 'pending'}
                  </span>
                </div>
              </div>

              {/* Manual Status Selector */}
              <div className="pt-2 border-t border-gray-200 space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-[#ffa200]" /> Override Fulfillment Status:
                </label>
                <select
                  value={order.status || 'pending'}
                  onChange={(e) => handleManualStatusOverride(e.target.value)}
                  disabled={!!processingStatus}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#ffa200] text-gray-900"
                >
                  <option value="pending">Pending / New Order</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing / Packaging</option>
                  <option value="ready">Ready for Pickup / Dispatch</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="completed">Delivered / Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" /> Order Items
              </h4>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {(order.cartItems || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white border border-gray-200 p-2.5 rounded-lg text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className="text-xs text-gray-500">{item.quantity} x GHS {item.price?.toFixed(2)}</span>
                    </div>
                    <span className="font-bold text-gray-900">GHS {(item.quantity * item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>GHS {order.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Delivery</span><span>GHS {order.deliveryFee?.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total</span><span>GHS {order.totalAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {history.length > 0 && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" /> Order History
                </h4>
                <div className="space-y-3 max-h-32 overflow-y-auto pr-1">
                  {history.map((h, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                        {i !== history.length - 1 && <div className="w-px h-full bg-gray-200 my-1" />}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="font-medium text-gray-900 capitalize">{h.status?.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-500">{new Date(h.changed_at).toLocaleString('en-GB')}</p>
                        <p className="text-[10px] text-gray-400 mt-1">by {h.changed_by_name || 'System'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- CENTERED DISPATCH COURIER MODAL --- */}
        {showDispatchModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-purple-600" /> Dispatch Order & Courier Info
                </h4>
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Assign a courier or rider for <strong>Order #{order.order_number || order.id}</strong>. The customer will receive an instant dispatch update via SMS and Email.
              </p>

              <form onSubmit={confirmDispatch} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 block">Courier Service / Rider Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Express Rider, Yango, Bolt Send"
                    value={courierInput}
                    onChange={(e) => setCourierInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 block">Tracking Ref / Rider Contact (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. +233 24 000 0000 or REF-9921"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowDispatchModal(false)}
                    className="px-4 py-2 text-xs font-semibold border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!courierInput.trim() || processingStatus === 'dispatch'}
                    className="px-5 py-2 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-md"
                  >
                    {processingStatus === 'dispatch' ? 'Dispatching...' : 'Confirm & Dispatch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Packing & Dispatch Slip Modal */}
        {showSlipModal && (
          <OrderSlipModal
            order={order}
            onClose={() => setShowSlipModal(false)}
          />
        )}
      </div>
    </div>
  );
}
