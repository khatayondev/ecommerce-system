'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { useUI } from '@/context/UIContext';
import { hasPermission } from '@/utils/permissions';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { 
  startPreparing, 
  markReady, 
  dispatchDelivery, 
  completeOrder, 
  cancelOrder 
} from '@/lib/orderActions';
import OrderDetailsModal from './OrderDetailsModal';
import CreateOrderModal from './CreateOrderModal';
import OrderSlipModal from './OrderSlipModal';

import { 
  ShoppingCart, 
  Search, 
  Plus, 
  AlertCircle,
  Clock,
  Eye,
  CheckCircle,
  Truck,
  Package,
  XCircle,
  RefreshCw,
  Bell,
  Sliders,
  DollarSign,
  Printer,
  Filter
} from 'lucide-react';

const MOCK_ORDERS = [
  { 
    id: 'ORD-A7F93', 
    order_number: 'THP-WEB-10041',
    customerName: 'Alice Mensah', 
    customerEmail: 'alice@example.com',
    customerPhone: '+233 543 987 654',
    deliveryAddress: 'House 42, Spintex Road, Accra',
    items: '2x 500ml Honey Bottle', 
    cartItems: [{ id: 'bottle-500ml', name: '500ml Honey Bottle', quantity: 2, price: 45.00 }],
    subtotal: 90.00,
    deliveryFee: 15.00,
    discount: 0,
    totalAmount: 105.00, 
    status: 'pending', 
    paymentStatus: 'paid',
    orderType: 'delivery',
    channel: 'website',
    placed_at: new Date(Date.now() - 600000).toISOString() 
  },
  { 
    id: 'ORD-B8921', 
    order_number: 'THP-PH-84920',
    customerName: 'Kwame Owusu', 
    customerEmail: 'kwame@example.com',
    customerPhone: '+233 244 123 456',
    deliveryAddress: 'Pick-up at Amrahia Warehouse',
    items: '1x 4.5L Honey Gallon', 
    cartItems: [{ id: 'gallon-4.5l', name: '4.5L Honey Gallon', quantity: 1, price: 300.00 }],
    subtotal: 300.00,
    deliveryFee: 0,
    discount: 10.00,
    totalAmount: 290.00, 
    status: 'confirmed', 
    paymentStatus: 'unpaid',
    orderType: 'pickup',
    channel: 'phone',
    placed_at: new Date(Date.now() - 3600000).toISOString() 
  },
];

export default function OrdersPage() {
  const { roles, user } = useAuth();
  const { isStoreOpen, isBusyMode, toggleStoreOpen, toggleBusyMode } = useStoreSettings();
  const { showConfirm } = useUI();

  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState('all'); // all, pending, confirmed, preparing, ready, out_for_delivery, completed, cancelled
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all'); // all, paid, unpaid, refunded
  const [typeFilter, setTypeFilter] = useState('all'); // all, delivery, pickup
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, highest

  // Modals state
  const [selectedOrderForView, setSelectedOrderForView] = useState(null);
  const [orderForSlip, setOrderForSlip] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dispatchingOrderId, setDispatchingOrderId] = useState(null);
  const [courierName, setCourierName] = useState('');

  useEffect(() => {
    if (!db) {
      setOrders(MOCK_ORDERS);
      setIsMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Listen for orders
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        if (snapshot.empty) {
          setOrders([]);
        } else {
          const list = [];
          snapshot.forEach((doc) => {
            list.push({ ...doc.data(), id: doc.id });
          });
          setOrders(list);
        }
        setIsMock(false);
        setLoading(false);
      },
      (err) => {
        console.warn("[Orders] Firestore orders permission warning:", err.message);
        setOrders([]);
        setIsMock(false);
        setLoading(false);
      }
    );

    // 2. Listen for batches (for FIFO complete order logic)
    const unsubscribeBatches = onSnapshot(
      collection(db, 'batches'),
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id });
        });
        setBatches(list);
      },
      (err) => console.warn("[Orders] Batches permission warning:", err.message)
    );

    return () => {
      unsubscribeOrders();
      unsubscribeBatches();
    };
  }, []);

  // Sandbox Mode helper handler
  const handleSandboxStatusUpdate = (orderId, updates) => {
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o)
    );
  };

  // Actions Wrapper

  const handleStartPreparing = async (orderId) => {
    if (isMock) {
      handleSandboxStatusUpdate(orderId, { status: 'preparing' });
      toast.success("Started preparing order (Sandbox Mode)!");
      return;
    }
    try {
      await startPreparing(orderId, user?.uid, user?.full_name);
      toast.success("Order status marked as Preparing!");
    } catch (err) {
      console.error(err);
      toast.error(`Update failed: ${err.message}`);
    }
  };

  const handleMarkReady = async (orderId) => {
    if (isMock) {
      handleSandboxStatusUpdate(orderId, { status: 'ready' });
      toast.success("Order marked as Ready (Sandbox Mode)!");
      return;
    }
    try {
      await markReady(orderId, user?.uid, user?.full_name);
      toast.success("Order marked as Ready for Delivery/Pickup!");
    } catch (err) {
      console.error(err);
      toast.error(`Update failed: ${err.message}`);
    }
  };

  const handleOpenDispatch = (orderId) => {
    setDispatchingOrderId(orderId);
    setCourierName('');
  };

  const handleConfirmDispatch = async () => {
    if (isMock) {
      handleSandboxStatusUpdate(dispatchingOrderId, { status: 'out_for_delivery' });
      toast.success("Order dispatched (Sandbox Mode)!");
      setDispatchingOrderId(null);
      return;
    }
    try {
      await dispatchDelivery(dispatchingOrderId, courierName, '', user?.uid, user?.full_name);
      toast.success("Order dispatched!");
      setDispatchingOrderId(null);
    } catch (err) {
      console.error(err);
      toast.error(`Dispatch failed: ${err.message}`);
    }
  };

  const handleComplete = async (orderId) => {
    if (isMock) {
      handleSandboxStatusUpdate(orderId, { status: 'completed', paymentStatus: 'paid' });
      toast.success("Order completed (Sandbox Mode)!");
      return;
    }
    try {
      await completeOrder(orderId, user?.uid, user?.full_name, batches);
      toast.success("Order completed successfully!");
    } catch (err) {
      console.error(err);
      toast.error(`Completion failed: ${err.message}`);
    }
  };

  const handleCancel = async (orderId) => {
    const isConfirmed = await showConfirm({
        title: 'Cancel Order',
        message: 'Are you sure you want to cancel this order?',
        confirmText: 'Yes, Cancel'
    });
    if (!isConfirmed) return;
    
    const reason = prompt("Please enter the reason for cancellation:");
    if (reason === null) return; 
    
    if (isMock) {
      handleSandboxStatusUpdate(orderId, { status: 'cancelled', cancelReason: reason });
      toast.success("Order cancelled (Sandbox Mode)!");
      return;
    }
    try {
      await cancelOrder(orderId, reason, user?.uid, user?.full_name);
      toast.success("Order cancelled, reserved stock returned to inventory.");
    } catch (err) {
      console.error(err);
      toast.error(`Cancellation failed: ${err.message}`);
    }
  };

  const handleRefund = async (orderId) => {
    if (isMock) {
      handleSandboxStatusUpdate(orderId, { status: 'cancelled', paymentStatus: 'refunded' });
      toast.success("Refund simulated (Sandbox Mode)!");
      return;
    }
    try {
      await cancelOrder(orderId, "Customer Refund Requested", user?.uid, user?.full_name);
      toast.success("Order cancelled & refund triggered!");
    } catch (err) {
      console.error(err);
      toast.error(`Refund failed: ${err.message}`);
    }
  };

  // Safe helper to parse dates from various formats (ISO strings, Firestore Timestamps, etc.)
  const parseDate = (val) => {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    return new Date(val);
  };

  // Helper to normalize status values for robust comparison
  const getNormalizedStatus = (status) => {
    if (!status) return '';
    return status.toLowerCase().replace(/_/g, '').replace(/\s+/g, '');
  };

  // KPI Calculations
  const newOrdersCount = orders.filter(o => {
    const s = getNormalizedStatus(o.status);
    return s === 'pending' || s === 'confirmed';
  }).length;

  const preparingCount = orders.filter(o => getNormalizedStatus(o.status) === 'preparing').length;
  
  const activeDeliveryPickupCount = orders.filter(o => {
    const s = getNormalizedStatus(o.status);
    return s === 'ready' || s === 'outfordelivery';
  }).length;

  const completedTodayList = orders.filter(o => {
    const s = getNormalizedStatus(o.status);
    const isCompleted = s === 'completed' || s === 'collected' || s === 'delivered';
    if (!isCompleted) return false;
    const completedDate = parseDate(o.updatedAt || o.placed_at || o.createdAt).toDateString();
    return completedDate === new Date().toDateString();
  });
  
  const completedTodayCount = completedTodayList.length;
  const todayRevenue = completedTodayList.reduce((sum, o) => sum + (o.totalAmount || o.total || 0), 0);

  // Search, Payment, Type & Tab Filters
  const filteredOrders = orders.filter(order => {
    // 1. Search filter (ID, Number, Customer Name, Phone, Delivery Address, Item Names)
    const q = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      (order.id && order.id.toLowerCase().includes(q)) ||
      (order.order_number && order.order_number.toLowerCase().includes(q)) ||
      (order.customerName && order.customerName.toLowerCase().includes(q)) ||
      (order.customerPhone && order.customerPhone.includes(searchTerm)) ||
      (order.deliveryAddress && order.deliveryAddress.toLowerCase().includes(q)) ||
      (order.cartItems && order.cartItems.some(i => i.name && i.name.toLowerCase().includes(q)));

    if (!matchesSearch) return false;

    // 2. Tab filter
    if (activeTab !== 'all') {
      const s = (order.status || '').toLowerCase();
      if (activeTab === 'pending') {
        if (s !== 'pending') return false;
      } else if (activeTab === 'PENDING_DELIVERY_COST') {
        if (order.status !== 'PENDING_DELIVERY_COST') return false;
      } else {
        if (s !== activeTab.toLowerCase()) return false;
      }
    }

    // 3. Payment Filter
    if (paymentFilter !== 'all') {
      const p = (order.paymentStatus || 'unpaid').toLowerCase();
      if (p !== paymentFilter) return false;
    }

    // 4. Fulfillment Type Filter
    if (typeFilter !== 'all') {
      const t = (order.orderType || order.deliveryType || 'delivery').toLowerCase();
      if (t !== typeFilter) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'oldest') {
      return new Date(a.placed_at || a.createdAt || 0) - new Date(b.placed_at || b.createdAt || 0);
    }
    if (sortBy === 'highest') {
      return (b.totalAmount || b.total || 0) - (a.totalAmount || a.total || 0);
    }
    // Default newest first
    return new Date(b.placed_at || b.createdAt || 0) - new Date(a.placed_at || a.createdAt || 0);
  });

  return (
    <AuthShield requiredPermission="order.view">
    <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
      {/* Actions Area */}
      <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">

        {/* Store Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-[#ffa200]/5 border border-[#ffa200]/15 p-2 rounded-xl">
          <div className="flex items-center gap-2 border-r border-gray-200 pr-3 mr-1">
            <Sliders className="w-4 h-4 text-[#d07b00]/60" />
            <span className="text-xs font-bold text-gray-900">Store Ops:</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isStoreOpen}
                onChange={toggleStoreOpen}
                disabled={!hasPermission(roles, 'store.toggle')}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-gray-250 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              <span className={`text-xs font-bold ${isStoreOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isStoreOpen ? 'Open for Orders' : 'Store Closed'}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isBusyMode}
                onChange={toggleBusyMode}
                disabled={!hasPermission(roles, 'store.toggle')}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-gray-250 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              <span className={`text-xs font-bold ${isBusyMode ? 'text-amber-600' : 'text-gray-500'}`}>
                Busy Mode
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-bg-card border border-gold/10 p-5 rounded-2xl flex justify-between items-center shadow-lg">
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">New Orders</span>
            <p className="text-3xl font-bold font-display text-white mt-1">{newOrdersCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-bg-card border border-gold/10 p-5 rounded-2xl flex justify-between items-center shadow-lg">
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Preparing</span>
            <p className="text-3xl font-bold font-display text-white mt-1">{preparingCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-bg-card border border-gold/10 p-5 rounded-2xl flex justify-between items-center shadow-lg">
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Out / Ready</span>
            <p className="text-3xl font-bold font-display text-white mt-1">{activeDeliveryPickupCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-bg-card border border-gold/10 p-5 rounded-2xl flex justify-between items-center shadow-lg">
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Today's Sales</span>
            <p className="text-3xl font-bold font-display text-emerald-400 mt-1">
              ₵{todayRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-emerald-500/80 font-medium">({completedTodayCount} Completed)</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-bg-card border border-gold/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Table Filters & Toolbar */}
        <div className="p-5 border-b border-gold/10 space-y-4 md:space-y-0 md:flex md:justify-between md:items-center bg-bg-dark/20 gap-4">
          
          {/* Tabs */}
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'PENDING_DELIVERY_COST', label: 'Needs Delivery Cost' },
              { id: 'pending', label: 'New / Pending' },
              { id: 'confirmed', label: 'Confirmed' },
              { id: 'preparing', label: 'Preparing' },
              { id: 'ready', label: 'Ready' },
              { id: 'out_for_delivery', label: 'Out' },
              { id: 'completed', label: 'Completed' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-gold text-black shadow-sm font-bold' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & New Order Action */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ID, Customer, Phone, Item..."
                className="bg-bg-dark border border-gold/10 focus:border-gold pl-9 pr-4 py-2 w-full rounded-xl text-xs text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gold hover:bg-gold-hover text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md flex-shrink-0 transition-all duration-150"
            >
              <Plus className="w-4 h-4" /> Log Phone Order
            </button>
          </div>
        </div>

        {/* Secondary Filter Row: Payment, Type, Sort */}
        <div className="px-5 py-3 border-b border-gold/10 flex flex-wrap items-center gap-3 bg-bg-dark/40 text-xs">
          <div className="flex items-center gap-1.5 text-white/70 font-semibold">
            <Filter className="w-3.5 h-3.5 text-gold" />
            <span>Filters:</span>
          </div>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-bg-dark border border-gold/10 focus:border-gold px-2.5 py-1.5 rounded-lg text-xs text-white outline-none cursor-pointer"
          >
            <option value="all">Payment: All</option>
            <option value="paid">Payment: Paid</option>
            <option value="unpaid">Payment: Unpaid</option>
            <option value="refunded">Payment: Refunded</option>
          </select>

          {/* Fulfillment Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-bg-dark border border-gold/10 focus:border-gold px-2.5 py-1.5 rounded-lg text-xs text-white outline-none cursor-pointer"
          >
            <option value="all">Fulfillment: All</option>
            <option value="delivery">Fulfillment: Doorstep Delivery</option>
            <option value="pickup">Fulfillment: Self Pickup</option>
          </select>

          {/* Sort Order */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-bg-dark border border-gold/10 focus:border-gold px-2.5 py-1.5 rounded-lg text-xs text-white outline-none ml-auto cursor-pointer"
          >
            <option value="newest">Sort: Newest Placed</option>
            <option value="oldest">Sort: Oldest Placed</option>
            <option value="highest">Sort: Highest Order Value</option>
          </select>
        </div>

        {/* Table View */}
        {loading ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 text-gold animate-spin" />
            <p className="text-sm">Retrieving orders feed...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center text-text-muted space-y-2">
            <AlertCircle className="w-10 h-10 text-gold/40 mx-auto" />
            <p className="text-sm font-semibold text-white/80">No matching orders found</p>
            <p className="text-xs">There are no orders listed in this view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gold/10 bg-bg-dark/40 text-xs font-semibold text-text-muted uppercase tracking-wider">
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Time Placed</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/5 text-white/90">
                {filteredOrders.map((order) => {
                  const isNew = order.status === 'pending' || order.status === 'Pending';
                  
                  return (
                    <tr 
                      key={order.id} 
                      onClick={() => setSelectedOrderForView(order)}
                      className={`hover:bg-white/5 transition-all duration-150 cursor-pointer ${
                        isNew ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Order ID */}
                      <td className="p-4 font-mono font-semibold text-gold">
                        {order.order_number || order.id}
                      </td>

                      {/* Customer Info */}
                      <td className="p-4">
                        <div>
                          <p className="font-semibold text-white">{order.customerName}</p>
                          <p className="text-xs text-text-muted font-mono">{order.customerPhone}</p>
                        </div>
                      </td>

                      {/* Payment Status badge */}
                      <td className="p-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.paymentStatus === 'paid' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {order.paymentStatus || 'unpaid'}
                        </span>
                      </td>

                      {/* Date / Time */}
                      <td className="p-4 text-xs text-text-muted">
                        {new Date(order.placed_at || order.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      {/* Delivery/Pickup type */}
                      <td className="p-4 text-xs font-semibold uppercase tracking-wider text-white/70">
                        {order.orderType || 'delivery'}
                      </td>

                      {/* Status badge */}
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                          order.status === 'PENDING_DELIVERY_COST' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          order.status === 'AWAITING_PAYMENT' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          order.status === 'pending' || order.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          order.status === 'confirmed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          order.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          order.status === 'preparing' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          order.status === 'ready' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          order.status === 'out_for_delivery' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                          order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {order.status === 'PENDING_DELIVERY_COST' ? 'Needs Delivery Cost' : 
                           order.status === 'AWAITING_PAYMENT' ? 'Awaiting Payment' : 
                           order.status === 'paid' ? 'Paid' :
                           order.status}
                        </span>
                      </td>

                      {/* Pricing total */}
                      <td className="p-4 font-mono font-semibold text-right text-gold">
                        ₵{(order.totalAmount || order.total || 0).toFixed(2)}
                      </td>

                      {/* Row contextual actions */}
                      <td className="p-4">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrderForView(order)}
                            title="View Details"
                            className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/15 text-white rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Print Packing Slip */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setOrderForSlip(order); }}
                            title="Print Packing Slip"
                            className="p-1.5 bg-[#ffa200]/15 border border-[#ffa200]/30 hover:bg-[#ffa200]/30 text-[#d07b00] rounded-lg transition"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Reject pending order */}
                          {(order.status === 'pending' || order.status === 'Pending') && hasPermission(roles, 'order.cancel') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }}
                              title="Reject Order"
                              className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-lg transition font-semibold text-xs px-2"
                            >
                              Reject
                            </button>
                          )}

                          {/* Pending/Confirmed -> Preparing */}
                          {(order.status === 'confirmed' || order.status === 'pending' || order.status === 'paid' || order.status === 'Pending') && hasPermission(roles, 'order.process') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartPreparing(order.id); }}
                              title="Start Preparing"
                              className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition font-semibold text-xs px-2.5"
                            >
                              Prepare
                            </button>
                          )}

                          {/* Preparing -> Ready */}
                          {order.status === 'preparing' && hasPermission(roles, 'order.process') && (
                            <button
                              onClick={() => handleMarkReady(order.id)}
                              title="Mark Ready"
                              className="p-1.5 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400 rounded-lg transition font-semibold text-xs px-2.5"
                            >
                              Ready
                            </button>
                          )}

                          {/* Ready & Pickup -> Collected (Complete) */}
                          {order.status === 'ready' && order.orderType === 'pickup' && hasPermission(roles, 'order.process') && (
                            <button
                              onClick={() => handleComplete(order.id)}
                              title="Complete Order"
                              className="p-1.5 bg-emerald-500/15 border border-emerald-500/25 hover:bg-emerald-500/25 text-emerald-400 rounded-lg transition font-semibold text-xs px-2.5"
                            >
                              Collected
                            </button>
                          )}

                          {/* Ready & Delivery -> Dispatch */}
                          {order.status === 'ready' && order.orderType === 'delivery' && hasPermission(roles, 'order.assign_delivery') && (
                            <button
                              onClick={() => handleOpenDispatch(order.id)}
                              title="Dispatch / Courier"
                              className="p-1.5 bg-cyan-500/15 border border-cyan-500/25 hover:bg-cyan-500/25 text-cyan-400 rounded-lg transition font-semibold text-xs px-2.5"
                            >
                              Dispatch
                            </button>
                          )}

                          {/* OutForDelivery -> Complete */}
                          {order.status === 'out_for_delivery' && hasPermission(roles, 'order.process') && (
                            <button
                              onClick={() => handleComplete(order.id)}
                              title="Deliver Order"
                              className="p-1.5 bg-emerald-500/15 border border-emerald-500/25 hover:bg-emerald-500/25 text-emerald-400 rounded-lg transition font-semibold text-xs px-2.5"
                            >
                              Delivered
                            </button>
                          )}

                          {/* General cancel button (up to completed) */}
                          {['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status) && hasPermission(roles, 'order.cancel') && (
                            <button
                              onClick={() => handleCancel(order.id)}
                              title="Cancel Order"
                              className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-rose-400 rounded-lg transition"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Refund completed order */}
                          {order.status === 'completed' && hasPermission(roles, 'order.refund') && (
                            <button
                              onClick={() => handleRefund(order.id)}
                              title="Refund Order"
                              className="p-1.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 rounded-lg transition font-semibold text-xs px-2"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedOrderForView && (
        <OrderDetailsModal
          order={orders.find(o => o.id === selectedOrderForView.id) || selectedOrderForView}
          onClose={() => setSelectedOrderForView(null)}
        />
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            if (isMock) {
              toast.success("Mock orders refreshed!");
            }
          }}
        />
      )}

      {/* Dispatching courier prompt modal */}
      {dispatchingOrderId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-gold/15 p-6 rounded-2xl w-full max-w-sm space-y-4 text-sm text-white">
            <h3 className="text-base font-semibold">Dispatch Order</h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-text-muted font-medium">Rider / Courier Name</label>
              <input
                type="text"
                placeholder="e.g. Standard Dispatch, DHL, Rider Ama"
                className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDispatchingOrderId(null)}
                className="px-4 py-1.5 border border-gold/20 text-gold rounded-lg hover:bg-gold/10"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispatch}
                disabled={!courierName}
                className="px-4 py-1.5 bg-gold text-black rounded-lg hover:bg-gold-hover font-semibold shadow-md disabled:opacity-50"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Packing & Dispatch Slip Modal */}
      {orderForSlip && (
        <OrderSlipModal
          order={orderForSlip}
          onClose={() => setOrderForSlip(null)}
        />
      )}
    </div>
    </AuthShield>
  );
}
