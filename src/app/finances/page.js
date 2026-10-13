'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { hasPermission } from '@/utils/permissions';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { 
  DollarSign, 
  Plus, 
  X, 
  Check, 
  Truck, 
  Users, 
  Boxes, 
  AlertCircle,
  FileText,
  Calendar,
  Compass,
  Trash2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Download
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Wages & Salaries',
  'Fuel & Transport',
  'Packaging & Materials',
  'Rent & Utilities',
  'Exhibition Costs',
  'Marketing & Promo',
  'Other Operational Expenses'
];

const MOCK_EXHIBITIONS = [
  { id: 'ex-1', name: 'Accra Food & Honey Expo 2026', status: 'active' }
];

const MOCK_SUPPLIERS = [
  { id: 'sup-1', name: 'Nkoranza Beekeepers Co-op' },
  { id: 'sup-2', name: 'Volta Glass Containers Ltd' },
];

const MOCK_PRODUCTS = [
  { id: 'bottle-500ml', name: '500ml Honey Bottle', stockLevel: 140 },
  { id: 'bottle-1l', name: '1L Honey Bottle', stockLevel: 85 },
];

const MOCK_EXPENSES = [
  { id: 'exp-1', category: 'Packaging & Materials', amount: 450.00, expense_date: '2026-07-02', description: 'Bought 300x custom labels print run', exhibition_id: null },
  { id: 'exp-2', category: 'Exhibition Costs', amount: 800.00, expense_date: '2026-07-04', description: 'Booth rental space booking fee', exhibition_id: 'ex-1', exhibition_name: 'Accra Food & Honey Expo 2026' },
  { id: 'exp-3', category: 'Fuel & Transport', amount: 120.00, expense_date: '2026-07-05', description: 'Petrol for honey transport van', exhibition_id: null },
];

const MOCK_PURCHASES = [
  { id: 'PO-2026-001', supplier_id: 'sup-1', supplier_name: 'Nkoranza Beekeepers Co-op', product_id: 'bottle-500ml', product_name: '500ml Honey Bottle', quantity: 200, unit_cost: 20.00, total: 4000.00, status: 'approved', created_at: '2026-07-03T10:00:00Z' },
  { id: 'PO-2026-002', supplier_id: 'sup-2', supplier_name: 'Volta Glass Containers Ltd', product_id: 'bottle-1l', product_name: '1L Honey Bottle', quantity: 100, unit_cost: 35.00, total: 3500.00, status: 'received', created_at: '2026-07-05T14:30:00Z' },
];

const MOCK_SALES = [
  { id: 'sale-A', sale_date: '2026-07-04T12:00:00Z', customer_name: 'Alice Mensah', total: 480.00, payment_status: 'paid' },
  { id: 'sale-B', sale_date: '2026-07-05T10:00:00Z', customer_name: 'Kwame Owusu', total: 720.00, payment_status: 'paid' },
  { id: 'sale-C', sale_date: '2026-07-06T15:20:00Z', customer_name: 'Amma Boateng', total: 320.00, payment_status: 'paid' },
];

export default function FinancesPage() {
  const { roles, user } = useAuth();
  const { showConfirm } = useUI();
  
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' (Expenses & Purchases), 'transactions' (Unified logs)
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  // Data states
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [exhibitions, setExhibitions] = useState([]);

  // Form Modals Toggles
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);

  // Form payload states
  const [newExpense, setNewExpense] = useState({
    category: 'Packaging & Materials',
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    exhibition_id: 'none',
  });
  const [newPurchase, setNewPurchase] = useState({
    supplier_id: '',
    product_id: '',
    quantity: 0,
    unit_cost: 0,
  });

  // Transactions Tab search/filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(''); // 'all', 'inflow', 'outflow'

  // Permissions checks
  const canApprove = hasPermission(roles, 'purchase.approve');
  const canReceive = hasPermission(roles, 'purchase.receive');
  const canManageExpenses = hasPermission(roles, 'expense.manage');
  const canCreatePurchases = hasPermission(roles, 'purchase.create');

  useEffect(() => {
    if (!db) {
      setExpenses(MOCK_EXPENSES);
      setPurchases(MOCK_PURCHASES);
      setSales(MOCK_SALES);
      setSuppliers(MOCK_SUPPLIERS);
      setProducts(MOCK_PRODUCTS);
      setExhibitions(MOCK_EXHIBITIONS);
      setIsMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubEx = onSnapshot(collection(db, 'exhibitions'), (snap) => {
      const list = [];
      snap.forEach(d => {
        if (d.data().status === 'active') list.push({ id: d.id, ...d.data() });
      });
      setExhibitions(list);
    }, (error) => {
      console.warn("Exhibitions fetch error:", error);
      setExhibitions([]);
    });

    const unsubSup = onSnapshot(collection(db, 'suppliers'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSuppliers(list);
    }, (error) => {
      console.warn("Suppliers fetch error:", error);
      setSuppliers([]);
    });

    const unsubProd = onSnapshot(collection(db, 'products'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setProducts(list);
    }, (error) => {
      console.warn("Products fetch error:", error);
      setProducts([]);
    });

    const unsubExp = onSnapshot(collection(db, 'expenses'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
      setExpenses(list);
    }, (error) => {
      console.warn("Expenses fetch error:", error);
      setExpenses([]);
    });

    const unsubPur = onSnapshot(collection(db, 'purchases'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setPurchases(list);
    }, (error) => {
      console.warn("Purchases fetch error:", error);
      setPurchases([]);
    });

    const unsubSales = onSnapshot(collection(db, 'sales'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSales(list);
      setLoading(false);
    }, (error) => {
      console.warn("Sales fetch error:", error);
      setSales([]);
      setLoading(false);
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setOrders(list);
    }, (error) => {
      console.warn("Orders fetch error:", error);
      setOrders([]);
    });

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setInvoices(list);
    }, (error) => {
      console.warn("Invoices fetch error:", error);
      setInvoices([]);
    });

    return () => {
      unsubEx();
      unsubSup();
      unsubProd();
      unsubExp();
      unsubPur();
      unsubSales();
      unsubOrders();
      unsubInvoices();
    };
  }, []);

  // --- Expenses actions ---
  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const { category, amount, expense_date, description, exhibition_id } = newExpense;
    if (amount <= 0 || !expense_date || !description.trim()) return;

    const selectedEx = exhibitions.find(ex => ex.id === exhibition_id);
    const docId = `exp-${Date.now().toString(36)}`;
    const payload = {
      category,
      amount: parseFloat(amount),
      expense_date,
      description: description.trim(),
      exhibition_id: exhibition_id !== 'none' ? exhibition_id : null,
      exhibition_name: exhibition_id !== 'none' ? selectedEx?.name : null,
      user_id: user?.uid || 'anonymous',
      user_name: user?.full_name || 'Staff',
      created_at: new Date().toISOString()
    };

    if (isMock) {
      setExpenses(prev => [payload, ...prev]);
      setShowExpenseForm(false);
      setNewExpense({ category: 'Packaging & Materials', amount: 0, expense_date: new Date().toISOString().split('T')[0], description: '', exhibition_id: 'none' });
      toast.success("Expense logged successfully (Sandbox)!");
      return;
    }

    try {
      await setDoc(doc(db, 'expenses', docId), payload);
      setShowExpenseForm(false);
      setNewExpense({ category: 'Packaging & Materials', amount: 0, expense_date: new Date().toISOString().split('T')[0], description: '', exhibition_id: 'none' });
      toast.success("Expense logged successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to log expense.");
    }
  };

  const handleDeleteExpense = async (id) => {
    const isConfirmed = await showConfirm({
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense record?',
      confirmText: 'Delete',
      isDestructive: true
    });
    if (!isConfirmed) return;

    if (isMock) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success("Expense deleted!");
      return;
    }

    try {
      await deleteDoc(doc(db, 'expenses', id));
      toast.success("Expense deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete expense.");
    }
  };

  // --- Purchases actions ---
  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    const { supplier_id, product_id, quantity, unit_cost } = newPurchase;
    if (!supplier_id || !product_id || quantity <= 0 || unit_cost <= 0) return;

    const selectedSupplier = suppliers.find(s => s.id === supplier_id);
    const selectedProduct = products.find(p => p.id === product_id);

    const docId = `PO-2026-${Math.floor(100 + Math.random() * 900)}`;
    const payload = {
      supplier_id,
      supplier_name: selectedSupplier?.name || 'Unknown Supplier',
      product_id,
      product_name: selectedProduct?.name || 'Unknown Product',
      quantity: parseInt(quantity),
      unit_cost: parseFloat(unit_cost),
      total: parseInt(quantity) * parseFloat(unit_cost),
      status: 'draft',
      user_id: user?.uid || 'anonymous',
      user_name: user?.full_name || 'Staff',
      created_at: new Date().toISOString()
    };

    if (isMock) {
      setPurchases(prev => [payload, ...prev]);
      setShowPurchaseForm(false);
      setNewPurchase({ supplier_id: '', product_id: '', quantity: 0, unit_cost: 0 });
      toast.success("Purchase order created successfully (Sandbox)!");
      return;
    }

    try {
      await setDoc(doc(db, 'purchases', docId), payload);
      setShowPurchaseForm(false);
      setNewPurchase({ supplier_id: '', product_id: '', quantity: 0, unit_cost: 0 });
      toast.success("Purchase order created successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save purchase order.");
    }
  };

  const handleApprovePO = async (id) => {
    if (isMock) {
      setPurchases(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p));
      toast.success("PO approved (Sandbox)");
      return;
    }
    try {
      await updateDoc(doc(db, 'purchases', id), { status: 'approved' });
      toast.success("Purchase order approved!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve PO.");
    }
  };

  const handleDeletePurchase = async (id) => {
    const isConfirmed = await showConfirm({
      title: 'Delete Purchase Order',
      message: 'Are you sure you want to delete this purchase order?',
      confirmText: 'Delete',
      isDestructive: true
    });
    if (!isConfirmed) return;

    if (isMock) {
      setPurchases(prev => prev.filter(p => p.id !== id));
      toast.success("Purchase order deleted.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'purchases', id));
      toast.success("Purchase order deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete purchase order.");
    }
  };

  const handleReceivePO = async (purchaseRecord) => {
    const { id, product_id, quantity } = purchaseRecord;

    if (isMock) {
      setPurchases(prev => prev.map(p => p.id === id ? { ...p, status: 'received' } : p));
      setProducts(prev => prev.map(p => p.id === product_id ? { ...p, stockLevel: (p.stockLevel || 0) + quantity } : p));
      toast.success(`PO ${id} received! Stock incremented.`);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const poRef = doc(db, 'purchases', id);
        const poSnap = await transaction.get(poRef);
        if (!poSnap.exists()) throw new Error("Purchase Order not found.");
        const poData = poSnap.data();

        if (poData.status === 'received') throw new Error("PO already received.");

        const prodRef = doc(db, 'products', poData.product_id);
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists()) throw new Error("Product not found.");

        const currentStock = prodSnap.data().stockLevel || 0;
        const newStock = currentStock + poData.quantity;

        transaction.update(prodRef, {
          stockLevel: newStock,
          lastUpdated: new Date().toISOString()
        });

        const movRef = doc(db, 'stock_movements', `mov-${Date.now()}`);
        transaction.set(movRef, {
          product_id: poData.product_id,
          movement_type: 'restock',
          quantity: poData.quantity,
          reason: `PO Received: ${id}`,
          moved_at: new Date().toISOString(),
          moved_by: user?.uid || 'system'
        });

        transaction.update(poRef, {
          status: 'received',
          received_date: new Date().toISOString()
        });
      });

      toast.success(`PO ${id} marked as received! Stock updated.`);
    } catch (err) {
      console.error(err);
      toast.error(`Fulfillment failed: ${err.message}`);
    }
  };

  
  const filteredSales = sales.filter(s => {
    if (startDate && new Date(s.sale_date) < new Date(startDate)) return false;
    if (endDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(s.sale_date) > adjustedEnd) return false;
    }
    return true;
  });

  const filteredOrders = orders.filter(o => {
    if (startDate && new Date(o.createdAt) < new Date(startDate)) return false;
    if (endDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(o.createdAt) > adjustedEnd) return false;
    }
    return true;
  });

  const filteredInvoices = invoices.filter(i => {
    if (startDate && new Date(i.createdAt) < new Date(startDate)) return false;
    if (endDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(i.createdAt) > adjustedEnd) return false;
    }
    return true;
  });

  const filteredExpenses = expenses.filter(e => {
    if (startDate && new Date(e.expense_date) < new Date(startDate)) return false;
    if (endDate && new Date(e.expense_date) > new Date(endDate)) return false;
    return true;
  });

  const filteredPurchases = purchases.filter(p => {
    if (startDate && new Date(p.created_at) < new Date(startDate)) return false;
    if (endDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(p.created_at) > adjustedEnd) return false;
    }
    return true;
  });

  // --- Financial Metrics Calculations ---
  const revenueTotal = filteredSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || parseFloat(s.total) || 0), 0)
    + filteredOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || parseFloat(o.total) || 0), 0)
    + filteredInvoices.reduce((sum, i) => sum + (parseFloat(i.totalAmount) || parseFloat(i.total) || 0), 0);
  const expenseTotal = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const purchasesTotal = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || parseFloat(p.total) || 0), 0);
  
  const totalOutflow = expenseTotal + purchasesTotal;
  const netCashFlow = revenueTotal - totalOutflow;

  // --- Compile Unified Transactions Log ---
  const compileTransactions = () => {
    const list = [];

    // Sales (Inflows)
    filteredSales.forEach(s => {
      list.push({
        id: s.id || '',
        date: s.sale_date || s.createdAt || new Date().toISOString(),
        type: 'Inflow',
        category: 'Sales Revenue',
        description: `Sale to ${s.customer_name || s.customerName || 'Retail Customer'}`,
        amount: parseFloat(s.totalAmount || s.total) || 0,
        status: s.payment_status || s.paymentStatus || 'paid',
      });
    });

    // Orders (Inflows)
    filteredOrders.forEach(o => {
      list.push({
        id: o.id || '',
        date: o.createdAt || new Date().toISOString(),
        type: 'Inflow',
        category: 'POS Sale',
        description: `Order from ${o.customerName || 'Retail Customer'}`,
        amount: parseFloat(o.totalAmount || o.total) || 0,
        status: o.paymentStatus || o.status || 'paid',
      });
    });

    // Invoices (Inflows)
    filteredInvoices.forEach(i => {
      list.push({
        id: i.id || '',
        date: i.createdAt || new Date().toISOString(),
        type: 'Inflow',
        category: 'Invoice',
        description: `Invoice to ${i.customerName || 'Customer'}`,
        amount: parseFloat(i.totalAmount || i.total) || 0,
        status: i.status || 'paid',
      });
    });

    // Expenses (Outflows)
    filteredExpenses.forEach(e => {
      list.push({
        id: e.id || '',
        date: e.expense_date || new Date().toISOString(),
        type: 'Outflow',
        category: 'Operational Expense',
        description: `${e.category || 'Expense'}: ${e.description || ''}`,
        amount: parseFloat(e.amount) || 0,
        status: 'paid',
      });
    });

    // Purchases (Outflows)
    filteredPurchases.forEach(p => {
      list.push({
        id: p.id || '',
        date: p.created_at || new Date().toISOString(),
        type: 'Outflow',
        category: 'Stock Purchase',
        description: `PO restock: ${p.quantity || 0}x ${p.product_name || ''} from ${p.supplier_name || ''}`,
        amount: parseFloat(p.total) || 0,
        status: p.status || 'draft',
      });
    });

    // Sort by Date descending
    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter by type and search query
    return list.filter(tx => {
      const matchesSearch = 
        (tx.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.category || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = 
        txTypeFilter === 'all' || 
        (txTypeFilter === 'inflow' && tx.type === 'Inflow') ||
        (txTypeFilter === 'outflow' && tx.type === 'Outflow');

      return matchesSearch && matchesType;
    });
  };

  
  const downloadLedgerReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Transactions Ledger\n";
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n\n`;
    csv += "Date,Transaction Reference,Flow Category,Description,Amount (GHS),Status\n";

    compiledTxs.forEach(tx => {
      const isOutflow = tx.type === 'Outflow';
      const amtStr = `${isOutflow ? '-' : ''}${tx.amount.toFixed(2)}`;
      csv += `${new Date(tx.date).toLocaleDateString()},"${tx.id}","${tx.category}","${tx.description.replace(/"/g, '""')}",${amtStr},${tx.status}\n`;
    });

    const encoded = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `honey_palace_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const compiledTxs = compileTransactions();

  return (
    <AuthShield requiredPermission="purchase.create" alternativePermission="expense.manage">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        

        {/* Actions Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div className="bg-white border border-black/5 p-4 rounded-xl flex flex-wrap gap-4 items-end shadow-sm flex-1 max-w-xl">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-text-muted-dark font-semibold text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#ffa200]" /> Start Date
              </span>
              <input
                type="date"
                className="bg-bg-light border border-black/10 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black font-semibold text-xs"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-text-muted-dark font-semibold text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#ffa200]" /> End Date
              </span>
              <input
                type="date"
                className="bg-bg-light border border-black/10 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black font-semibold text-xs"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">

            {canManageExpenses && (
              <button
                onClick={() => setShowExpenseForm(true)}
                className="flex items-center gap-2 px-4 py-2 border border-[#ffa200]/20 hover:border-[#ffa200]/40 bg-[#ffa200]/5 text-[#ffa200] font-bold rounded-xl transition-all duration-300 text-xs"
              >
                <Plus className="w-4 h-4" /> Log Expense
              </button>
            )}
            {canCreatePurchases && (
              <button
                onClick={() => setShowPurchaseForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#ffa200] hover:bg-[#ffa200]-light text-black font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-gold/20 text-xs"
              >
                <Plus className="w-4 h-4" /> Create Restock PO
              </button>
            )}
          </div>
        </div>

        {/* Top Financial Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Revenue Card */}
          <div className="bg-white border border-black/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] text-text-muted-dark font-medium uppercase tracking-wider">Total Cash Inflow</span>
              <p className="text-2xl font-bold font-display text-emerald-400">₵{revenueTotal.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>

          {/* Outflow Card */}
          <div className="bg-white border border-black/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] text-text-muted-dark font-medium uppercase tracking-wider">Total Outflow (Costs)</span>
              <p className="text-2xl font-bold font-display text-rose-400">₵{totalOutflow.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>

          {/* Net Flow Card */}
          <div className="bg-white border border-black/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] text-text-muted-dark font-medium uppercase tracking-wider">Net Profit / cashflow</span>
              <p className={`text-2xl font-bold font-display ${netCashFlow >= 0 ? 'text-[#ffa200]' : 'text-rose-500'}`}>
                ₵{netCashFlow.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netCashFlow >= 0 ? 'bg-[#ffa200]/10 text-[#ffa200]' : 'bg-rose-500/10 text-rose-500'}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>


        {/* Simple Cashflow Chart */}
        <div className="bg-white border border-black/5 p-5 rounded-2xl shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-black flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#ffa200]" /> Cashflow Overview
          </h3>
          <div className="w-full bg-bg-light rounded-full h-3 overflow-hidden flex">
            {revenueTotal === 0 && totalOutflow === 0 ? (
              <div className="bg-gray-200 h-full w-full"></div>
            ) : (
              <>
                <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${(revenueTotal / (revenueTotal + totalOutflow)) * 100}%` }}></div>
                <div className="bg-rose-400 h-full transition-all duration-500" style={{ width: `${(totalOutflow / (revenueTotal + totalOutflow)) * 100}%` }}></div>
              </>
            )}
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-emerald-500">Inflow: ₵{revenueTotal.toFixed(2)}</span>
            <span className="text-rose-500">Outflow: ₵{totalOutflow.toFixed(2)}</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-black/5 gap-6 text-sm text-text-muted-dark">
          <button 
            onClick={() => setActiveTab('ledger')} 
            className={`pb-3 font-semibold transition flex items-center gap-2 border-b-2 ${activeTab === 'ledger' ? 'border-[#ffa200] text-[#ffa200]' : 'border-transparent hover:text-gray-600'}`}
          >
            <Boxes className="w-4 h-4" />
            Expenses & Purchases
          </button>
          <button 
            onClick={() => setActiveTab('transactions')} 
            className={`pb-3 font-semibold transition flex items-center gap-2 border-b-2 ${activeTab === 'transactions' ? 'border-[#ffa200] text-[#ffa200]' : 'border-transparent hover:text-gray-600'}`}
          >
            <FileText className="w-4 h-4" />
            Transactions Log
          </button>
        </div>

        {/* Tab 1: Expenses & Purchases */}
        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* Left Section: Expenses */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-black flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#ffa200]" />
                  Operational Expenses ({expenses.length})
                </h3>
              </div>

              <div className="bg-white border border-black/5 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/5 bg-bg-light/50 text-text-muted-dark uppercase tracking-wider">
                        <th className="p-4 font-semibold">Details</th>
                        <th className="p-4 font-semibold">Category</th>
                        <th className="p-4 font-semibold">Amount</th>
                        <th className="p-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold/5">
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-bg-light/30 transition-colors">
                          <td className="p-4">
                            <div>
                              <p className="font-semibold text-black">{exp.description}</p>
                              <span className="text-[9px] text-text-muted-dark font-mono">{exp.id}</span>
                            </div>
                          </td>
                          <td className="p-4 text-text-muted-dark font-medium">{exp.category}</td>
                          <td className="p-4 font-mono font-semibold text-rose-400">₵{(exp.amount || 0).toFixed(2)}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1.5 border border-rose-500/10 hover:border-rose-500/30 rounded text-rose-400 hover:bg-rose-500/10 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center p-8 text-text-muted-dark font-medium">No expenses logged.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Section: Purchase Orders */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-black flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-[#ffa200]" />
                  Restock Purchases ({purchases.length})
                </h3>
              </div>

              <div className="bg-white border border-black/5 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/5 bg-bg-light/50 text-text-muted-dark uppercase tracking-wider">
                        <th className="p-4 font-semibold">PO Reference</th>
                        <th className="p-4 font-semibold">Item & Supplier</th>
                        <th className="p-4 font-semibold">Total Cost</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold/5">
                      {purchases.map((po) => {
                        const isDraft = po.status === 'draft';
                        const isApproved = po.status === 'approved';
                        const isReceived = po.status === 'received';

                        return (
                          <tr key={po.id} className="hover:bg-bg-light/30 transition-colors">
                            <td className="p-4">
                              <div className="font-mono font-semibold text-black">{po.id}</div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                isDraft ? 'bg-amber-500/10 text-amber-400' : isApproved ? 'bg-[#ffa200]/15 text-[#ffa200]' : 'bg-emerald-500/10 text-emerald-400'
                              }`}>{po.status}</span>
                            </td>
                            <td className="p-4">
                              <div className="font-semibold text-black">{po.product_name}</div>
                              <div className="text-[10px] text-text-muted-dark">{po.supplier_name} • x{po.quantity}</div>
                            </td>
                            <td className="p-4 font-mono font-semibold text-rose-400">₵{(po.total || 0).toFixed(2)}</td>
                            <td className="p-4 text-right">
                              <div className="flex gap-2 justify-end">
                                {isDraft && (
                                  <button
                                    onClick={() => handleApprovePO(po.id)}
                                    disabled={!canApprove}
                                    className="px-2 py-1 bg-[#ffa200] hover:bg-[#ffa200]-light disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded text-[10px] transition-colors"
                                  >
                                    Approve
                                  </button>
                                )}
                                {isApproved && (
                                  <button
                                    onClick={() => handleReceivePO(po)}
                                    disabled={!canReceive}
                                    className="px-2 py-1 bg-[#ffa200] hover:bg-[#D07B00] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded text-[10px] transition-colors"
                                  >
                                    Receive
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePurchase(po.id)}
                                  className="p-1 border border-rose-500/10 hover:border-rose-500/30 rounded text-rose-400 hover:bg-rose-500/10 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {purchases.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center p-8 text-text-muted-dark font-medium">No purchase orders created.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Transactions Log */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {/* Search and filter controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-black/5 p-4 rounded-xl">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions by reference, description..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-black/5 focus:border-[#ffa200] bg-bg-light text-black text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-3 text-xs">
                <select
                  className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2 rounded-xl text-black"
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                >
                  <option value="all">All Financial Flow</option>
                  <option value="inflow">Inflow / Revenue</option>
                  <option value="outflow">Outflow / Cost</option>
                </select>

                <button
                  onClick={downloadLedgerReport}
                  className="flex items-center gap-2 px-4 py-2 bg-[#ffa200] hover:bg-[#ffa200]/80 text-black font-bold rounded-xl transition-all duration-300 text-xs shadow-sm border border-transparent"
                >
                  <Download className="w-3.5 h-3.5 text-black" />
                  Export Ledger (CSV)
                </button>
              </div>
            </div>


            {/* Unified table */}
            <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/5 bg-bg-light/50 text-text-muted-dark uppercase tracking-wider">
                      <th className="p-4 font-semibold">Date</th>
                      <th className="p-4 font-semibold">Transaction Reference</th>
                      <th className="p-4 font-semibold">Flow Category</th>
                      <th className="p-4 font-semibold">Description</th>
                      <th className="p-4 font-semibold">Amount (₵)</th>
                      <th className="p-4 font-semibold">Fulfillment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/5">
                    {compiledTxs.map((tx) => {
                      const isInflow = tx.type === 'Inflow';

                      return (
                        <tr key={`${tx.id}-${tx.type}`} className="hover:bg-bg-light/30 transition-colors">
                          <td className="p-4 font-medium text-text-muted-dark">
                            {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4 font-mono font-semibold text-black">{tx.id}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              isInflow ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {tx.category}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600 max-w-sm truncate" title={tx.description}>{tx.description}</td>
                          <td className={`p-4 font-mono font-bold ${isInflow ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isInflow ? '+' : '-'}₵{tx.amount.toFixed(2)}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                              tx.status === 'received' || tx.status === 'paid' || tx.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/15 text-amber-400'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {compiledTxs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center p-12 text-text-muted-dark font-medium">No transactions found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Log Expense */}
        {showExpenseForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-black/10 p-6 rounded-2xl w-full max-w-md space-y-6">
              <div className="flex justify-between items-center border-b border-black/5 pb-4">
                <h3 className="text-lg font-display font-semibold text-black">Log Business Cost</h3>
                <button onClick={() => setShowExpenseForm(false)} className="text-text-muted-dark hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-4 text-xs text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-text-muted-dark font-medium">Cost Amount (₵)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="₵50.00"
                      className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black font-mono"
                      value={newExpense.amount || ''}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-text-muted-dark font-medium">Expense Date</label>
                    <input
                      type="date"
                      required
                      className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black"
                      value={newExpense.expense_date}
                      onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-muted-dark font-medium">Cost Category</label>
                  <select
                    className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2.5 rounded-lg text-black text-xs"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-muted-dark font-medium">Tag Exhibition Event (Optional)</label>
                  <select
                    className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2.5 rounded-lg text-black text-xs"
                    value={newExpense.exhibition_id}
                    onChange={(e) => setNewExpense({ ...newExpense, exhibition_id: e.target.value })}
                  >
                    <option value="none">None (General Overhead Expense)</option>
                    {exhibitions.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-muted-dark font-medium">Expense Description</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter cost reason..."
                    className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExpenseForm(false)}
                    className="flex-1 px-4 py-2 border border-black/5 rounded-xl text-text-muted-dark hover:text-black transition-all duration-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#ffa200] hover:bg-[#ffa200]-light text-black font-semibold rounded-xl transition-all duration-300 text-xs"
                  >
                    Log Expense
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Purchase Order */}
        {showPurchaseForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-black/10 p-6 rounded-2xl w-full max-w-md space-y-6">
              <div className="flex justify-between items-center border-b border-black/5 pb-4">
                <h3 className="text-lg font-display font-semibold text-black">Create Purchase Order</h3>
                <button onClick={() => setShowPurchaseForm(false)} className="text-text-muted-dark hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs text-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-muted-dark font-medium">Select Supplier</label>
                  <select
                    required
                    className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2.5 rounded-lg text-black text-xs"
                    value={newPurchase.supplier_id}
                    onChange={(e) => setNewPurchase({ ...newPurchase, supplier_id: e.target.value })}
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-muted-dark font-medium">Select Catalogue Product</label>
                  <select
                    required
                    className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2.5 rounded-lg text-black text-xs"
                    value={newPurchase.product_id}
                    onChange={(e) => setNewPurchase({ ...newPurchase, product_id: e.target.value })}
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.spec || 'Standard'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-text-muted-dark font-medium">Restock Quantity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="100"
                      className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black"
                      value={newPurchase.quantity || ''}
                      onChange={(e) => setNewPurchase({ ...newPurchase, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-text-muted-dark font-medium">Unit Cost Price (₵)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="30.00"
                      className="bg-bg-light border border-black/5 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black"
                      value={newPurchase.unit_cost || ''}
                      onChange={(e) => setNewPurchase({ ...newPurchase, unit_cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPurchaseForm(false)}
                    className="flex-1 px-4 py-2 border border-black/5 rounded-xl text-text-muted-dark hover:text-black transition-all duration-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#ffa200] hover:bg-[#ffa200]-light text-black font-semibold rounded-xl transition-all duration-300 text-xs"
                  >
                    Save PO Draft
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AuthShield>
  );
}
