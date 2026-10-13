const fs = require('fs');
const file = 'src/app/orders/OrderDetailsModal.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update imports
content = content.replace(
  "import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';",
  "import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';"
);

// 2. Add state
content = content.replace(
  "const [processingStatus, setProcessingStatus] = useState('');",
  "const [processingStatus, setProcessingStatus] = useState('');\n  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');"
);

// 3. Add handleSetDeliveryCost
const handlerFunc = `
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
      
      // Update local order visually
      order.deliveryFee = fee;
      order.totalAmount = newTotal;
      order.status = 'AWAITING_PAYMENT';
      
      // Send API request to trigger invoice, paystack link, email, SMS
      const apiRes = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
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
`;
content = content.replace("  return (", handlerFunc + "\n  return (");

// 4. Add UI block for pending delivery cost
const uiBlock = `
        {order.status === 'PENDING_DELIVERY_COST' && (
          <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl mb-6">
            <h4 className="text-rose-800 font-bold mb-2">Delivery Cost Required</h4>
            <p className="text-xs text-rose-600 mb-4">
              This order requires a delivery fee before the customer can pay. Please enter the exact delivery fee to generate the payment link.
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">GHS</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={deliveryFeeInput}
                  onChange={(e) => setDeliveryFeeInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-rose-200 rounded-lg focus:border-rose-400 focus:ring-rose-400 outline-none"
                />
              </div>
              <button
                onClick={handleSetDeliveryCost}
                disabled={!!processingStatus}
                className="bg-rose-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-rose-700 transition disabled:opacity-50 text-sm whitespace-nowrap"
              >
                {processingStatus === 'deliveryCost' ? 'Processing...' : 'Set Delivery & Send Link'}
              </button>
            </div>
          </div>
        )}

        {/* --- STEPPER UI --- */}
`;
content = content.replace("{/* --- STEPPER UI --- */}", uiBlock);

fs.writeFileSync(file, content);
console.log('Done updating OrderDetailsModal.');
