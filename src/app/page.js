'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { hasPermission } from '@/utils/permissions';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  ArrowRight,
  RefreshCw,
  Clock,
  DollarSign,
  TrendingDown,
  Calendar,
  Filter,
  FileSpreadsheet,
  Award,
  ChevronDown,
  Plus,
  EyeOff,
  Search,
  Power,
  Store,
  CheckCircle2,
  Truck,
  Box,
  ExternalLink,
  Layers
} from 'lucide-react';
import Link from 'next/link';

// Mock datasets for sandbox/fallback
const MOCK_PRODUCTS = [
  { id: 'bottle-500ml', name: '500ml Honey Bottle', stockLevel: 140, costPrice: 22.50, reorderLevel: 30 },
  { id: 'bottle-1l', name: '1L Honey Bottle', stockLevel: 85, costPrice: 40.00, reorderLevel: 20 },
];

const MOCK_SALES = [
  { id: 'sale-A', sale_date: '2026-07-04T12:00:00Z', customer_name: 'Alice Mensah', cartItems: [{ id: 'bottle-500ml', quantity: 2, price: 45.00 }], total: 90.00, exhibition_id: null },
  { id: 'sale-B', sale_date: '2026-07-05T10:00:00Z', customer_name: 'Kwame Owusu', cartItems: [{ id: 'bottle-1l', quantity: 1, price: 80.00 }], total: 80.00, exhibition_id: 'ex-1' },
];

const MOCK_ORDERS = [
  { id: 'THP-101', orderNumber: 'THP-101', customerName: 'Efua Mensah', totalAmount: 145.00, status: 'confirmed', paymentStatus: 'paid', channel: 'website', placed_at: new Date().toISOString(), items: [{ name: '500ml Honey Bottle', quantity: 2 }] },
  { id: 'THP-102', orderNumber: 'THP-102', customerName: 'Kofi Boateng', totalAmount: 80.00, status: 'preparing', paymentStatus: 'paid', channel: 'website', placed_at: new Date().toISOString(), items: [{ name: '1L Honey Bottle', quantity: 1 }] }
];

const MOCK_EXPENSES = [
  { id: 'exp-1', category: 'Packaging', amount: 450.00, expense_date: '2026-07-02', exhibition_id: null },
  { id: 'exp-2', category: 'Exhibition Rental', amount: 800.00, expense_date: '2026-07-04', exhibition_id: 'ex-1' },
];

const MOCK_EXHIBITIONS = [
  { id: 'ex-1', name: 'Accra Food & Honey Expo 2026' }
];

export default function Dashboard() {
  const { roles, user } = useAuth();
  const { isStoreOpen, isBusyMode, toggleStoreOpen, loading: settingsLoading } = useStoreSettings();

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [exhibitions, setExhibitions] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exhibitionId, setExhibitionId] = useState('all');

  // Permission Checks
  const canViewReports = hasPermission(roles, 'report.view');
  const canExportData = hasPermission(roles, 'data.export');
  const canManageSettings = hasPermission(roles, 'settings.manage');

  useEffect(() => {
    if (!db) {
      setProducts(MOCK_PRODUCTS);
      setSales(MOCK_SALES);
      setOrders(MOCK_ORDERS);
      setExpenses(MOCK_EXPENSES);
      setExhibitions(MOCK_EXHIBITIONS);
      setIsMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setProducts(list);
    }, (err) => console.warn('[Dashboard] Products permission warning:', err.message));

    const unsubscribeSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setSales(list);
    }, (err) => console.warn('[Dashboard] Sales permission warning:', err.message));

    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setOrders(list);
      setLoading(false);
    }, (err) => {
      console.warn('[Dashboard] Orders permission warning:', err.message);
      setLoading(false);
    });

    const unsubscribeExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setExpenses(list);
    }, (err) => console.warn('[Dashboard] Expenses permission warning:', err.message));

    const unsubscribeExhibitions = onSnapshot(collection(db, 'exhibitions'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setExhibitions(list);
    }, (err) => console.warn('[Dashboard] Exhibitions permission warning:', err.message));

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
      unsubscribeOrders();
      unsubscribeExpenses();
      unsubscribeExhibitions();
    };
  }, []);

  // --- TIME CALCULATIONS ---
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 1. Today's Orders
  const todayOrders = orders.filter(o => {
    const dStr = o.placed_at || o.createdAt;
    if (!dStr) return false;
    return new Date(dStr) >= todayStart;
  });

  // 2. Pending Orders
  const pendingOrders = orders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return ['pending', 'pending_delivery_cost', 'confirmed', 'preparing', 'ready', 'awaiting_payment'].includes(s);
  });

  // 3. Sales Calculations
  const todaySalesTotal = todayOrders
    .filter(o => o.paymentStatus === 'paid' || o.status === 'confirmed' || o.status === 'completed')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    + sales.filter(s => new Date(s.sale_date) >= todayStart)
    .reduce((sum, s) => sum + (Number(s.totalAmount ?? s.total ?? 0)), 0);

  const totalAllTimeSales = orders
    .filter(o => o.paymentStatus === 'paid' || o.status === 'confirmed' || o.status === 'completed')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    + sales.reduce((sum, s) => sum + (Number(s.totalAmount ?? s.total ?? 0)), 0);

  // Filtered Sales for Financial Summary
  const filteredSales = sales.filter(sale => {
    if (exhibitionId !== 'all' && sale.exhibition_id !== exhibitionId) return false;
    if (startDate && new Date(sale.sale_date) < new Date(startDate)) return false;
    if (endDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(sale.sale_date) > adjustedEnd) return false;
    }
    return true;
  });

  const filteredExpenses = expenses.filter(exp => {
    if (exhibitionId !== 'all' && exp.exhibition_id !== exhibitionId) return false;
    if (startDate && new Date(exp.expense_date) < new Date(startDate)) return false;
    if (endDate && new Date(exp.expense_date) > new Date(endDate)) return false;
    return true;
  });

  const totalRevenue = filteredSales.reduce((acc, sale) => acc + (sale.totalAmount ?? sale.total ?? 0), 0);
  const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

  const totalCOGS = filteredSales.reduce((acc, sale) => {
    let saleCOGS = 0;
    (sale.cartItems || []).forEach(item => {
      const catalogueProduct = products.find(p => p.id === item.id);
      const unitCost = catalogueProduct?.costPrice || 0;
      saleCOGS += (item.quantity * unitCost);
    });
    return acc + saleCOGS;
  }, 0);

  const netProfit = totalRevenue - totalCOGS - totalExpenses;

  // Operational Indicators
  const totalStockQuantity = products.reduce((acc, p) => acc + (p.stockLevel || 0), 0);
  const lowStockCount = products.filter(p => (p.stockLevel || 0) <= (p.reorderLevel || 0)).length;

  // 4. Combined Recent Activity Stream (Chronological)
  const recentActivities = [
    ...orders.map(o => ({
      id: o.orderNumber || o.id,
      type: 'order',
      customer: o.customerName || 'Online Shopper',
      amount: Number(o.totalAmount) || 0,
      timestamp: new Date(o.placed_at || o.createdAt || Date.now()),
      status: o.status || 'confirmed',
      channel: 'Storefront (Paystack)',
      summary: (o.cartItems || o.items || []).map(i => `${i.quantity}x ${i.name || 'Honey'}`).join(', ') || 'Honey Products'
    })),
    ...sales.map(s => ({
      id: s.id,
      type: 'pos_sale',
      customer: s.customer_name || 'Walk-in Customer',
      amount: Number(s.totalAmount ?? s.total ?? 0),
      timestamp: new Date(s.sale_date || Date.now()),
      status: 'completed',
      channel: s.exhibition_name ? `Booth: ${s.exhibition_name}` : 'POS Checkout',
      summary: (s.cartItems || []).map(i => `${i.quantity}x ${i.name || 'Item'}`).join(', ') || 'In-store Purchase'
    }))
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);

  const handleExportCSV = () => {
    if (!canExportData) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Financial Performance Report\n";
    csvContent += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n`;
    csvContent += `Channel: ${exhibitionId === 'all' ? 'All Channels' : exhibitionId}\n\n`;
    csvContent += "Metric,Amount (GHS)\n";
    csvContent += `Today Sales (Live),${todaySalesTotal.toFixed(2)}\n`;
    csvContent += `Total Cumulative Sales,${totalAllTimeSales.toFixed(2)}\n`;
    csvContent += `Today Orders Count,${todayOrders.length}\n`;
    csvContent += `Pending Orders Count,${pendingOrders.length}\n`;
    csvContent += `Total Revenue (Filtered),${totalRevenue.toFixed(2)}\n`;
    csvContent += `Cost of Goods Sold (COGS),${totalCOGS.toFixed(2)}\n`;
    csvContent += `Operational Expenses,${totalExpenses.toFixed(2)}\n`;
    csvContent += `Net Profit,${netProfit.toFixed(2)}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `honeypalace_financial_overview_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
      
      {/* Top Banner: Store Status Quick Switcher & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Admin Executive Console</span>
            {isMock && (
              <span className="inline-flex items-center gap-1 bg-[#ffa200]/10 border border-[#ffa200]/30 px-2 py-0.5 rounded text-[10px] text-[#d07b00] font-semibold">
                <RefreshCw className="w-3 h-3 animate-spin text-[#ffa200]" /> Sandbox Active
              </span>
            )}
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-[#111111] tracking-tight">
            Welcome back, <span className="text-[#ffa200]">{user?.full_name ? user.full_name.trim().split(' ')[0] : 'Admin'}!</span>
          </h2>
          <p className="text-gray-500 text-xs md:text-sm font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Monitor sales, fulfill pending orders, and manage store availability.
          </p>
        </div>

        {/* Global Store Master Status Control Box */}
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200/80 p-3 rounded-2xl">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200">
            <span className={`w-2.5 h-2.5 rounded-full ${isStoreOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <div className="text-left">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block leading-tight">Master Switch</span>
              <span className={`text-xs font-extrabold ${isStoreOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isStoreOpen ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          {canManageSettings && (
            <button
              type="button"
              onClick={toggleStoreOpen}
              disabled={settingsLoading}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                isStoreOpen
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
              title="Toggle customer checkout availability"
            >
              <Power className="w-3.5 h-3.5" />
              {isStoreOpen ? 'Pause Store' : 'Resume Store'}
            </button>
          )}

          {canManageSettings && (
            <Link
              href="/settings"
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-700 hover:text-black bg-white hover:bg-gray-100 border border-gray-200 transition-colors flex items-center gap-1"
            >
              <Store className="w-3.5 h-3.5 text-[#ffa200]" /> Settings
            </Link>
          )}
        </div>
      </div>

      {/* CORE AT-A-GLANCE KPI CARDS (Prompt 7 Focus) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* 1. Today's Orders */}
        <div className="bg-white border border-gray-200/80 hover:border-[#ffa200]/50 p-6 rounded-2xl shadow-none transition-all duration-300 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Orders</span>
              <p className="text-3xl font-bold font-display text-gray-900">{todayOrders.length}</p>
              <p className="text-[11px] text-gray-500 font-medium">
                {todayOrders.filter(o => o.paymentStatus === 'paid').length} paid via Paystack
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#ffa200]/10 flex items-center justify-center text-[#d07b00]">
              <ShoppingCart className="w-6 h-6" />
            </div>
          </div>
          <Link href="/orders" className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[#d07b00] group-hover:translate-x-0.5 transition-transform">
            <span>Manage online orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 2. Total Sales Today / Cumulative */}
        <div className="bg-[#ffa200] text-black p-6 rounded-2xl shadow-none border border-[#d07b00]/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-black/5 rounded-full blur-2xl group-hover:bg-black/10 transition-all duration-500" />
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
              <span className="text-xs text-black/60 font-bold uppercase tracking-wider">Today's Total Sales</span>
              <p className="text-3xl font-bold font-display text-black">₵{todaySalesTotal.toFixed(2)}</p>
              <p className="text-[11px] text-black/75 font-semibold mt-1">
                Cumulative: <strong>₵{totalAllTimeSales.toFixed(2)}</strong>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-black/10 flex items-center justify-center text-black">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-xs font-extrabold text-black/80 relative z-10">
            <span>Online + POS Consolidated</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* 3. Pending Orders (Requiring Action) */}
        <div className={`p-6 rounded-2xl border transition-all duration-300 relative ${
          pendingOrders.length > 0 
            ? 'bg-amber-50/40 border-amber-300/80 hover:border-amber-400' 
            : 'bg-white border-gray-200/80'
        }`}>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Orders</span>
              <p className={`text-3xl font-bold font-display ${pendingOrders.length > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                {pendingOrders.length}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                {pendingOrders.length > 0 ? 'Awaiting packaging & dispatch' : 'All orders fulfilled'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              pendingOrders.length > 0 ? 'bg-amber-500/15 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <Truck className="w-6 h-6" />
            </div>
          </div>
          <Link href="/orders" className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-amber-700 hover:text-amber-800">
            <span>Fulfill pending queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4. Inventory Health & Low Stock Warning */}
        <div className="bg-white border border-gray-200/80 hover:border-[#ffa200]/50 p-6 rounded-2xl shadow-none transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Attention</span>
              <p className={`text-3xl font-bold font-display ${lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {lowStockCount > 0 ? `${lowStockCount} Low` : 'Optimal'}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                {totalStockQuantity} total units on inventory
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {lowStockCount > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
          </div>
          <Link href="/inventory" className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[#d07b00]">
            <span>Inspect inventory stock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

      {/* RECENT ACTIVITY & TRANSACTIONS STREAM (Prompt 7 Focus) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white border border-gray-200/80 rounded-2xl p-6 shadow-none space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#ffa200]" />
                Recent Orders &amp; Activity
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Chronological live transaction log across Storefront and POS</p>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/orders" className="text-xs text-[#d07b00] font-bold hover:underline flex items-center gap-1">
                View All Orders <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="space-y-3 divide-y divide-gray-100">
            {recentActivities.map((act, idx) => {
              const isOrder = act.type === 'order';
              const isConfirmed = ['confirmed', 'paid', 'completed'].includes(act.status.toLowerCase());
              const isPreparing = ['preparing', 'processing'].includes(act.status.toLowerCase());

              return (
                <div key={act.id + idx} className={`pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${idx === 0 ? 'pt-0' : ''}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-gray-900">
                        {act.id}
                      </span>
                      
                      {/* Channel Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isOrder ? 'bg-amber-100/70 text-amber-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {act.channel}
                      </span>

                      {/* Status Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isConfirmed 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : isPreparing 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {act.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 font-medium">
                      Customer: <strong className="text-gray-900 font-semibold">{act.customer}</strong>
                      <span className="mx-2 text-gray-300">•</span>
                      <span className="text-gray-500 text-[11px]">{act.summary}</span>
                    </p>
                  </div>

                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="font-mono text-sm font-bold text-gray-900">
                      ₵{act.amount.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      {act.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {act.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}

            {recentActivities.length === 0 && (
              <p className="text-center py-8 text-xs text-gray-400 italic font-medium">
                No orders or transactions recorded yet today.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Quick Management & Store Actions */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-none space-y-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-base text-gray-900 border-b border-gray-100 pb-4">
              Management Actions
            </h3>
            <p className="text-xs text-gray-500 mt-3 mb-5 font-medium leading-relaxed">
              Fast-track fulfillment, update global business hours, or issue in-person point of sale transactions.
            </p>
            
            <div className="space-y-3">
              <Link 
                href="/orders" 
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200/70 transition-all text-xs font-bold text-amber-900"
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#d07b00]" /> Open Order Fulfillment Queue
                </span>
                <ArrowRight className="w-4 h-4 text-[#ffa200]" />
              </Link>

              {hasPermission(roles, 'sale.create') && (
                <Link 
                  href="/pos" 
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all text-xs font-bold text-gray-800"
                >
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" /> New Point-of-Sale Sale
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </Link>
              )}

              {canManageSettings && (
                <Link 
                  href="/settings" 
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all text-xs font-bold text-gray-800"
                >
                  <span className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#ffa200]" /> Update Store Profile &amp; Hours
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </Link>
              )}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">Financial Reports</span>
              {canExportData && (
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="text-[11px] text-[#d07b00] font-bold hover:underline flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Consolidate day-end Paystack reconciliations against physical inventory movements.
            </p>
          </div>
        </div>

      </div>

      {/* Top Inventory Stock Preview */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-none">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
          <div>
            <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#ffa200]" />
              Artisanal Honey Inventory Status
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Real-time container stock levels and SKU pricing</p>
          </div>
          <Link href="/inventory" className="text-xs text-[#d07b00] font-bold hover:underline flex items-center gap-1">
            Full Inventory <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
          {products.slice(0, 8).map(p => (
            <div key={p.id} className="min-w-[150px] max-w-[150px] flex-shrink-0 border border-gray-200 rounded-xl p-3 hover:shadow-md transition-all bg-white">
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-full h-24 object-cover rounded-lg mb-2" />
              ) : (
                <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                  <Package className="w-6 h-6 text-gray-300" />
                </div>
              )}
              <h4 className="font-bold text-xs text-gray-900 truncate">{p.name}</h4>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.category || 'Raw Honey'}</p>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                <span className="font-mono text-xs font-extrabold text-[#d07b00]">
                  ₵{(p.sellingPrice || p.price || 0).toFixed(2)}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  (p.stockLevel || 0) <= (p.reorderLevel || 0) 
                    ? 'bg-rose-100 text-rose-700' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {p.stockLevel || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
