'use client';

import React, { useEffect } from 'react';
import { X, Printer, Package, Truck, Phone, MapPin, Calendar, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function OrderSlipModal({ order, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const orderNumber = order.order_number || order.orderNumber || order.id;
  const placedDate = order.placed_at || order.createdAt || new Date().toISOString();
  const cartItems = order.cartItems || order.items || [];
  const subtotal = order.subtotal || order.totalAmount || 0;
  const deliveryFee = order.deliveryFee !== undefined ? Number(order.deliveryFee) : 0;
  const discount = order.discount || order.discountAmount || 0;
  const total = order.totalAmount || order.total || Math.max(0, subtotal + deliveryFee - discount);
  const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid';
  const isPickup = order.orderType === 'pickup' || order.deliveryType === 'pickup';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Container Card */}
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 border border-gray-200 text-gray-900">
        
        {/* Modal Top Bar (Hidden on Print) */}
        <div className="no-print bg-gray-900 text-white px-6 py-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#ffa200]" />
            <span className="font-bold text-sm tracking-wide">Official Order Packing &amp; Dispatch Slip</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#ffa200] hover:bg-[#e69100] text-black font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md"
            >
              <Printer className="w-4 h-4" /> Print Slip (A4 / Thermal)
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Packing Slip Area */}
        <div id="printable-order-slip" className="p-8 md:p-10 space-y-6 bg-white font-sans text-gray-900 text-sm">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-gray-900 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl md:text-2xl font-black tracking-tight text-gray-900 font-display">
                  THE HONEY PALACE AFRICA
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                100% Pure, Unprocessed &amp; Certified Natural Honey
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Warehouse &amp; Apiary: Amrahia, Off Dodowa Road, Greater Accra | Phone: +233 50 260 6270 / +233 54 883 4874
              </p>
            </div>

            <div className="text-left sm:text-right bg-gray-50 sm:bg-transparent p-3 sm:p-0 rounded-xl w-full sm:w-auto border sm:border-0 border-gray-200">
              <span className="inline-block px-3 py-1 bg-black text-[#ffa200] text-xs font-black uppercase rounded-lg tracking-wider mb-1">
                PACKING &amp; DISPATCH SLIP
              </span>
              <p className="font-mono font-bold text-lg text-gray-900">
                #{orderNumber}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(placedDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* Customer & Fulfillment Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
            {/* Customer Details */}
            <div className="space-y-1.5">
              <span className="font-bold text-gray-500 uppercase tracking-wider block text-[10px]">
                Customer Details
              </span>
              <p className="font-bold text-sm text-gray-900">{order.customerName || 'Valued Customer'}</p>
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-mono text-sm text-blue-700 font-bold">{order.customerPhone || order.phone || 'N/A'}</span>
              </p>
              {order.customerEmail && (
                <p className="text-gray-600">{order.customerEmail}</p>
              )}
            </div>

            {/* Delivery Destination */}
            <div className="space-y-1.5">
              <span className="font-bold text-gray-500 uppercase tracking-wider block text-[10px]">
                {isPickup ? 'Fulfillment Method' : 'Delivery Destination'}
              </span>
              <p className="font-bold text-sm text-gray-900">
                {isPickup ? '🏢 Self Pickup at Amrahia Warehouse' : '🚚 Doorstep Courier Delivery'}
              </p>
              {!isPickup && (
                <>
                  <p className="text-gray-800 leading-relaxed font-medium">
                    {order.deliveryAddress || 'No street address specified'}
                  </p>
                  {order.deliveryAreaName && (
                    <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-800 text-[10px] font-bold rounded">
                      Zone: {order.deliveryAreaName}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Delivery Instructions (If present) */}
          {(order.deliveryNotes || order.deliveryInstructions) && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs">
              <span className="font-bold text-amber-900 block mb-0.5 uppercase tracking-wide text-[10px]">
                ⚠️ Special Customer Instructions / Delivery Notes:
              </span>
              <p className="text-amber-950 font-medium italic">
                "{order.deliveryNotes || order.deliveryInstructions}"
              </p>
            </div>
          )}

          {/* Itemized Pick List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                Itemized Order Pick List (Warehouse Verification)
              </span>
              <span className="text-[11px] text-gray-500">
                Check off items as packed into Honey Palace bag
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3 w-14 text-center">Pick [✓]</th>
                  <th className="py-2.5 px-3">Product Description &amp; Variant</th>
                  <th className="py-2.5 px-3 text-center">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cartItems.map((item, idx) => {
                  const qty = item.quantity || 1;
                  const price = item.price || 0;
                  const itemTotal = qty * price;

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 text-center">
                        <div className="w-4 h-4 border-2 border-gray-400 rounded inline-block" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        {item.name}
                        {item.size && (
                          <span className="ml-1.5 text-gray-500 font-normal">({item.size})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-sm text-gray-900">
                        {qty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                        GH₵{price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                        GH₵{itemTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Payment Status */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t-2 border-gray-200">
            {/* Payment Badge Card */}
            <div className="space-y-2">
              <span className="font-bold text-[10px] text-gray-500 uppercase tracking-wider block">
                Payment Verification
              </span>
              <div className={`p-3 rounded-xl border inline-block ${
                isPaid 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  {isPaid ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : null}
                  <span>{isPaid ? 'PAID IN FULL (PREPAID)' : 'CASH ON DELIVERY / UNPAID'}</span>
                </div>
                <p className="text-[10px] mt-0.5">
                  Method: {order.paymentMethod || (isPaid ? 'Paystack (Mobile Money / Card)' : 'Cash / Pending')}
                </p>
                {order.paystackReference && (
                  <p className="text-[10px] font-mono mt-0.5">
                    Ref: {order.paystackReference}
                  </p>
                )}
              </div>
            </div>

            {/* Calculations Table */}
            <div className="w-full sm:w-64 space-y-1 text-xs">
              <div className="flex justify-between text-gray-600 py-0.5">
                <span>Items Subtotal:</span>
                <span className="font-mono">GH₵{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600 py-0.5">
                <span>Delivery Fee:</span>
                <span className="font-mono">
                  {deliveryFee === 0 ? 'FREE' : `GH₵${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium py-0.5">
                  <span>Promo Discount:</span>
                  <span className="font-mono">-GH₵{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-300">
                <span>Total Amount:</span>
                <span className="font-mono text-gray-900">GH₵{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Staff & Courier Sign-Off Section */}
          <div className="pt-6 border-t border-dashed border-gray-300 space-y-4">
            <span className="font-bold text-[10px] uppercase tracking-wider text-gray-500 block">
              Fulfillment Verification &amp; Handover Sign-Off
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] text-gray-700">
              <div className="border border-gray-200 p-2.5 rounded-lg space-y-4 bg-gray-50/50">
                <span className="font-bold block text-gray-500 text-[10px]">1. Packed By</span>
                <div className="border-b border-gray-400 pt-4" />
                <span className="text-[9px] text-gray-400 block">Name &amp; Time</span>
              </div>

              <div className="border border-gray-200 p-2.5 rounded-lg space-y-4 bg-gray-50/50">
                <span className="font-bold block text-gray-500 text-[10px]">2. Courier / Rider</span>
                <div className="border-b border-gray-400 pt-4" />
                <span className="text-[9px] text-gray-400 block">Rider Name &amp; Contact</span>
              </div>

              <div className="border border-gray-200 p-2.5 rounded-lg space-y-4 bg-gray-50/50">
                <span className="font-bold block text-gray-500 text-[10px]">3. Dispatched At</span>
                <div className="border-b border-gray-400 pt-4" />
                <span className="text-[9px] text-gray-400 block">Date &amp; Dispatch Time</span>
              </div>

              <div className="border border-gray-200 p-2.5 rounded-lg space-y-4 bg-gray-50/50">
                <span className="font-bold block text-gray-500 text-[10px]">4. Customer Signature</span>
                <div className="border-b border-gray-400 pt-4" />
                <span className="text-[9px] text-gray-400 block">Received in Good Order</span>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center pt-2 text-[10px] text-gray-500 border-t border-gray-100">
            Thank you for supporting sustainable beekeeping with The Honey Palace Africa. Visit us at www.thehoneypalaceafrica.com
          </div>

        </div>

      </div>

      {/* Global CSS for clean print layout */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-order-slip,
          #printable-order-slip * {
            visibility: visible;
          }
          #printable-order-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
