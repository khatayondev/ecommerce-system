'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import AuthShield from '@/components/AuthShield';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar,
  Package,
  DollarSign,
  Boxes,
  TrendingUp,
  TrendingDown,
  Activity,
  User,
  Printer,
  Sparkles,
  PieChart,
  ShoppingBag,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  CreditCard,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight
} from 'lucide-react';

const MOCK_PRODUCTS = [
  { id: 'bottle-500ml', name: '500ml Honey Bottle', category: 'Raw Honey', spec: '500 ml', stockLevel: 140, costPrice: 22.50, sellingPrice: 45.00 },
  { id: 'bottle-1l', name: '1L Honey Bottle', category: 'Raw Honey', spec: '1000 ml', stockLevel: 85, costPrice: 40.00, sellingPrice: 80.00 },
];

const MOCK_SALES = [
  { id: 'sale-A', sale_date: '2026-07-04T12:00:00Z', customer_name: 'Alice Mensah', user_name: 'Kofi Mensah', cartItems: [{ id: 'bottle-500ml', name: '500ml Honey Bottle', quantity: 2, price: 45.00 }], total: 90.00, exhibition_name: null },
  { id: 'sale-B', sale_date: '2026-07-05T10:00:00Z', customer_name: 'Kwame Owusu', user_name: 'Akua Cashier', cartItems: [{ id: 'bottle-1l', name: '1L Honey Bottle', quantity: 1, price: 80.00 }], total: 80.00, exhibition_name: 'Accra Expo' },
];

const MOCK_EXPENSES = [
  { id: 'exp-1', category: 'Packaging', amount: 450.00, expense_date: '2026-07-02', description: 'Bought 300x custom labels' },
  { id: 'exp-2', category: 'Exhibition Rental', amount: 800.00, expense_date: '2026-07-04', description: 'Booth space booking' },
];

const MOCK_BATCHES = [
  { id: 'batch-1', batch_number: 'B-2026-AMR-01', product_name: '500ml Honey Bottle', quantity_remaining: 85, harvest_date: '2026-06-01', expiry_date: '2029-06-01' },
  { id: 'batch-2', batch_number: 'B-2026-NKR-02', product_name: '1L Honey Bottle', quantity_remaining: 50, harvest_date: '2026-05-12', expiry_date: '2029-05-12' },
];

const MOCK_ORDERS = [
  {
    id: 'ORD-9842',
    orderNumber: 'ORD-9842',
    created_at: '2026-07-04T14:30:00Z',
    customer_name: 'Abena Osei',
    customer_phone: '+233544123456',
    customer_email: 'abena.osei@gmail.com',
    deliveryAreaName: 'East Legon & Shiashie',
    deliveryAddress: 'House 14, Boundary Rd, East Legon',
    deliveryFee: 35.00,
    total: 215.00,
    subtotal: 180.00,
    payment_status: 'paid',
    payment_method: 'paystack',
    paystack_channel: 'mobile_money',
    paystack_reference: 'pstk_ref_9842_mo',
    settlement_status: 'settled',
    items: [{ id: 'bottle-500ml', name: '500ml Honey Bottle', quantity: 4, price: 45.00 }]
  },
  {
    id: 'ORD-9843',
    orderNumber: 'ORD-9843',
    created_at: '2026-07-05T09:15:00Z',
    customer_name: 'Kwame Mensah',
    customer_phone: '+233201987654',
    customer_email: 'k.mensah@techgh.com',
    deliveryAreaName: 'Airport Residential & Cantonments',
    deliveryAddress: 'Flat 4B, Cantonments Crescent',
    deliveryFee: 40.00,
    total: 360.00,
    subtotal: 320.00,
    payment_status: 'paid',
    payment_method: 'paystack',
    paystack_channel: 'card',
    paystack_reference: 'pstk_ref_9843_cd',
    settlement_status: 'unsettled',
    items: [{ id: 'bottle-1l', name: '1L Honey Bottle', quantity: 4, price: 80.00 }]
  },
  {
    id: 'ORD-9844',
    orderNumber: 'ORD-9844',
    created_at: '2026-07-05T16:20:00Z',
    customer_name: 'Esi Dapaah',
    customer_phone: '+233245678901',
    customer_email: 'esi.dapaah@yahoo.com',
    deliveryAreaName: 'Tema & Spintex Corridor',
    deliveryAddress: 'Comm 18, Block D',
    deliveryFee: 45.00,
    total: 125.00,
    subtotal: 80.00,
    payment_status: 'pending',
    payment_method: 'paystack',
    paystack_channel: 'mobile_money',
    paystack_reference: 'pstk_ref_9844_pen',
    settlement_status: 'pending',
    items: [{ id: 'bottle-1l', name: '1L Honey Bottle', quantity: 1, price: 80.00 }]
  },
  {
    id: 'ORD-9845',
    orderNumber: 'ORD-9845',
    created_at: '2026-07-06T11:05:00Z',
    customer_name: 'Kojo Antwi',
    customer_phone: '+233501234789',
    customer_email: 'kojo.antwi@accra.org',
    deliveryAreaName: 'Osu, Labone & Ridge',
    deliveryAddress: 'Ringway Estate, Osu',
    deliveryFee: 30.00,
    total: 170.00,
    subtotal: 140.00,
    payment_status: 'failed',
    payment_method: 'paystack',
    paystack_channel: 'mobile_money',
    paystack_reference: 'pstk_ref_9845_fail',
    settlement_status: 'failed',
    items: [{ id: 'bottle-500ml', name: '500ml Honey Bottle', quantity: 3, price: 45.00 }]
  },
  {
    id: 'ORD-9846',
    orderNumber: 'ORD-9846',
    created_at: '2026-07-06T13:40:00Z',
    customer_name: 'Nana Yaw',
    customer_phone: '+233555987123',
    customer_email: 'nanayaw@ghana.gov.gh',
    deliveryAreaName: 'East Legon & Shiashie',
    deliveryAddress: 'Adjiringanor Rd',
    deliveryFee: 35.00,
    total: 275.00,
    subtotal: 240.00,
    payment_status: 'paid',
    payment_method: 'paystack',
    paystack_channel: 'mobile_money',
    paystack_reference: 'pstk_ref_9846_mo',
    settlement_status: 'settled',
    items: [{ id: 'bottle-1l', name: '1L Honey Bottle', quantity: 3, price: 80.00 }]
  }
];

export default function ReportsPage() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isMock, setIsMock] = useState(false);

  // Security & Privacy Controls
  const [revealPII, setRevealPII] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  // Filter ranges
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!db) {
      setProducts(MOCK_PRODUCTS);
      setSales(MOCK_SALES);
      setExpenses(MOCK_EXPENSES);
      setBatches(MOCK_BATCHES);
      setOrders(MOCK_ORDERS);
      setIsMock(true);
      return;
    }

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setProducts(list);
    }, (err) => console.warn('[Reports] Products permission warning:', err.message));

    const unsubscribeSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setSales(list);
    }, (err) => console.warn('[Reports] Sales permission warning:', err.message));

    const unsubscribeExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setExpenses(list);
    }, (err) => console.warn('[Reports] Expenses permission warning:', err.message));

    const unsubscribeBatches = onSnapshot(collection(db, 'batches'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setBatches(list);
    }, (err) => console.warn('[Reports] Batches permission warning:', err.message));

    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setOrders(list.length > 0 ? list : MOCK_ORDERS);
    }, (err) => {
      console.warn('[Reports] Orders permission warning:', err.message);
      setOrders(MOCK_ORDERS);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
      unsubscribeExpenses();
      unsubscribeBatches();
      unsubscribeOrders();
    };
  }, []);

  // Quick Date Range Preset Handler
  const applyDatePreset = (preset) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (preset === 'week') {
      const day = now.getDay() || 7; // get current day of week (Monday=1, Sunday=7)
      if (day !== 1) start.setHours(-24 * (day - 1));
      start.setHours(0, 0, 0, 0);
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
    } else if (preset === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Filtered lists
  const filteredSales = sales.filter(sale => {
    if (startDate && new Date(sale.sale_date) < new Date(startDate)) return false;
    if (endDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(sale.sale_date) > adjustedEnd) return false;
    }
    return true;
  });

  const filteredExpenses = expenses.filter(exp => {
    if (startDate && new Date(exp.expense_date) < new Date(startDate)) return false;
    if (endDate && new Date(exp.expense_date) > new Date(endDate)) return false;
    return true;
  });

  const filteredOrders = orders.filter(order => {
    const orderDate = order.created_at || order.createdAt || order.orderDate;
    if (startDate && orderDate && new Date(orderDate) < new Date(startDate)) return false;
    if (endDate && orderDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(orderDate) > adjustedEnd) return false;
    }
    return true;
  });

  // Calculate top-level metrics
  const totalRev = filteredSales.reduce((acc, s) => acc + (s.total || 0), 0);
  const totalExp = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalCOGS = filteredSales.reduce((acc, sale) => {
    let saleCOGS = 0;
    (sale.cartItems || []).forEach(item => {
      const prod = products.find(p => p.id === item.id);
      saleCOGS += (item.quantity * (prod?.costPrice || 0));
    });
    return acc + saleCOGS;
  }, 0);
  const netProfit = totalRev - totalCOGS - totalExp;

  // Sorting for previews
  const sortedProducts = [...products].sort((a, b) => (b.stockLevel || 0) * (b.sellingPrice || 0) - (a.stockLevel || 0) * (a.sellingPrice || 0));
  const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
  const sortedBatches = [...batches].sort((a, b) => new Date(b.harvest_date || 0) - new Date(a.harvest_date || 0));

  // Calculate top-selling varieties / SKUs
  const topVarietiesMap = filteredSales.reduce((acc, sale) => {
    (sale.cartItems || []).forEach(item => {
      const prodId = item.id || 'unknown';
      const prod = products.find(p => p.id === prodId);
      const name = item.name || prod?.name || prodId;
      const qty = item.quantity || 1;
      const price = item.price !== undefined ? item.price : (prod?.sellingPrice || 0);
      const cost = prod?.costPrice || 0;
      const itemRev = qty * price;
      const itemCost = qty * cost;

      if (!acc[prodId]) {
        acc[prodId] = {
          id: prodId,
          name,
          category: prod?.category || 'Raw Honey',
          spec: prod?.spec || '',
          unitsSold: 0,
          grossRevenue: 0,
          totalCost: 0,
          netProfit: 0
        };
      }
      acc[prodId].unitsSold += qty;
      acc[prodId].grossRevenue += itemRev;
      acc[prodId].totalCost += itemCost;
      acc[prodId].netProfit += (itemRev - itemCost);
    });
    return acc;
  }, {});

  const sortedVarieties = Object.values(topVarietiesMap).sort((a, b) => b.unitsSold - a.unitsSold);

  // Calculate sales by executive
  const salesByExecutive = filteredSales.reduce((acc, sale) => {
    const execName = sale.user_name || 'Unknown Executive';
    if (!acc[execName]) {
      acc[execName] = { name: execName, totalSales: 0, count: 0 };
    }
    acc[execName].totalSales += (sale.total || 0);
    acc[execName].count += 1;
    return acc;
  }, {});
  
  const sortedExecutives = Object.values(salesByExecutive).sort((a, b) => b.totalSales - a.totalSales);

  // 1. Calculate Orders by Geographic Area
  const geographicStats = filteredOrders.reduce((acc, order) => {
    const area = order.deliveryAreaName || order.deliveryArea || order.deliveryDetails?.areaName || 'Direct Pickup / Walk-in';
    if (!acc[area]) {
      acc[area] = {
        name: area,
        orderCount: 0,
        grossRevenue: 0,
        deliveryFees: 0,
        paidOrdersCount: 0
      };
    }
    acc[area].orderCount += 1;
    const isPaid = ['paid', 'completed', 'successful'].includes((order.payment_status || order.paymentStatus || '').toLowerCase());
    if (isPaid) {
      acc[area].paidOrdersCount += 1;
      acc[area].grossRevenue += (order.total || 0);
    }
    acc[area].deliveryFees += (order.deliveryFee || order.delivery_fee || 0);
    return acc;
  }, {});

  const sortedGeographicAreas = Object.values(geographicStats).sort((a, b) => b.orderCount - a.orderCount);

  // 2. Calculate Payment Summaries (Successful, Pending, Failed)
  const paymentSummaryStats = filteredOrders.reduce((acc, order) => {
    const status = (order.payment_status || order.paymentStatus || 'pending').toLowerCase();
    let key = 'pending';
    if (['paid', 'successful', 'completed'].includes(status)) {
      key = 'successful';
    } else if (['failed', 'cancelled', 'declined'].includes(status)) {
      key = 'failed';
    }
    acc[key].count += 1;
    acc[key].total += (order.total || 0);
    acc.totalOrders += 1;
    acc.totalVolume += (order.total || 0);
    return acc;
  }, {
    successful: { count: 0, total: 0 },
    pending: { count: 0, total: 0 },
    failed: { count: 0, total: 0 },
    totalOrders: 0,
    totalVolume: 0
  });

  // 3. Real-Time Paystack Reconciliation (Ghana Domestic: 1.95%)
  const PAYSTACK_FEE_RATE = 0.0195;
  const paystackOrders = filteredOrders.filter(o => 
    (o.payment_method === 'paystack' || !o.payment_method || o.paystack_reference) &&
    ['paid', 'successful', 'completed'].includes((o.payment_status || o.paymentStatus || '').toLowerCase())
  );

  const paystackGross = paystackOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const paystackFees = paystackGross * PAYSTACK_FEE_RATE;
  const paystackNetPayout = paystackGross - paystackFees;

  const settledOrders = paystackOrders.filter(o => o.settlement_status === 'settled');
  const unsettledOrders = paystackOrders.filter(o => o.settlement_status !== 'settled');
  const settledGross = settledOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const settledNet = settledGross * (1 - PAYSTACK_FEE_RATE);
  const unsettledGross = unsettledOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const unsettledNet = unsettledGross * (1 - PAYSTACK_FEE_RATE);

  // 4. Customer Privacy PII Masking Helpers
  const maskPhone = (phone, reveal = false) => {
    if (!phone) return 'N/A';
    if (reveal) return phone;
    const clean = String(phone).trim();
    if (clean.length < 6) return '••••••';
    return clean.slice(0, 4) + ' ••• •' + clean.slice(-3);
  };

  const maskEmail = (email, reveal = false) => {
    if (!email) return 'N/A';
    if (reveal) return email;
    const parts = String(email).split('@');
    if (parts.length !== 2) return '••••••';
    const user = parts[0];
    const domain = parts[1];
    return (user.length > 2 ? user[0] + '••••' + user.slice(-1) : user[0] + '••') + '@' + domain;
  };

  const maskAddress = (addr, reveal = false) => {
    if (!addr) return 'N/A';
    if (reveal) return addr;
    const parts = String(addr).split(',');
    if (parts.length > 1) {
      return `${parts[0]}, ••••••`;
    }
    return addr.length > 12 ? addr.slice(0, 10) + ' ••••••' : '••••••••';
  };

  // CSV DOWNLOAD TRIGGER
  const triggerCSVDownload = (csvContent, fileName) => {
    const encoded = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `${fileName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // DOWNLOAD STOCK CSV
  const downloadStockReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Warehouse Stock Inventory Report\n";
    csv += `Export Date: ${new Date().toLocaleDateString()}\n\n`;
    csv += "Product ID,Product Name,Category,Spec,Cost Price,Selling Price,Stock Level,Stock Value (Cost),Potential Revenue\n";
    
    products.forEach(p => {
      const value = (p.stockLevel || 0) * (p.costPrice || 0);
      const revenue = (p.stockLevel || 0) * (p.sellingPrice || 0);
      csv += `${p.id},"${p.name}",${p.category || 'N/A'},${p.spec || 'Standard'},${(p.costPrice || 0).toFixed(2)},${(p.sellingPrice || 0).toFixed(2)},${p.stockLevel || 0},${value.toFixed(2)},${revenue.toFixed(2)}\n`;
    });

    triggerCSVDownload(csv, "honey_palace_stock_report");
  };

  // DOWNLOAD FINANCIAL SUMMARY CSV
  const downloadFinancialReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Financial P&L Performance Report\n";
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n\n`;
    csv += "Financial Indicator,Value (GHS ₵)\n";
    csv += `Gross Sales Revenue,${totalRev.toFixed(2)}\n`;
    csv += `Cost of Goods Sold (COGS),${totalCOGS.toFixed(2)}\n`;
    csv += `Operating Overhead Expenses,${totalExp.toFixed(2)}\n`;
    csv += `Net Profit Margin,${netProfit.toFixed(2)}\n`;

    triggerCSVDownload(csv, "honey_palace_finance_report");
  };

  // DOWNLOAD TOP VARIETIES CSV
  const downloadTopVarietiesReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Top-Selling Honey Varieties & SKUs Report\n";
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n\n`;
    csv += "Product ID,Product Name,Category,Units Sold,Gross Revenue (₵),COGS (₵),Net Profit (₵),Margin (%)\n";

    sortedVarieties.forEach(v => {
      const margin = v.grossRevenue ? ((v.netProfit / v.grossRevenue) * 100).toFixed(1) : '0';
      csv += `${v.id},"${v.name}",${v.category},${v.unitsSold},${v.grossRevenue.toFixed(2)},${v.totalCost.toFixed(2)},${v.netProfit.toFixed(2)},${margin}%\n`;
    });

    triggerCSVDownload(csv, "honey_palace_top_varieties");
  };

  // DOWNLOAD GEOGRAPHIC ORDERS CSV
  const downloadGeographicOrdersReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Orders by Geographic Delivery Area Report\n";
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n\n`;
    csv += "Geographic Zone / Area,Total Orders,Paid Orders,Delivery Fees Collected (₵),Gross Merchandise Value (₵),Average Order Value (₵)\n";

    sortedGeographicAreas.forEach(a => {
      const aov = a.paidOrdersCount > 0 ? (a.grossRevenue / a.paidOrdersCount).toFixed(2) : '0.00';
      csv += `"${a.name}",${a.orderCount},${a.paidOrdersCount},${a.deliveryFees.toFixed(2)},${a.grossRevenue.toFixed(2)},${aov}\n`;
    });

    triggerCSVDownload(csv, "honey_palace_geographic_orders_report");
  };

  // DOWNLOAD PAYMENT SUMMARY CSV
  const downloadPaymentSummaryReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Payment Status & Gateway Conversion Summary Report\n";
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n\n`;
    csv += "Payment Status,Order Count,Total Volume (₵),Share of Orders (%),Conversion Rate (%)\n";

    const totalOrders = paymentSummaryStats.totalOrders || 1;

    const successfulRate = ((paymentSummaryStats.successful.count / totalOrders) * 100).toFixed(1);
    const pendingRate = ((paymentSummaryStats.pending.count / totalOrders) * 100).toFixed(1);
    const failedRate = ((paymentSummaryStats.failed.count / totalOrders) * 100).toFixed(1);

    csv += `Successful (Paid),${paymentSummaryStats.successful.count},${paymentSummaryStats.successful.total.toFixed(2)},${successfulRate}%,${successfulRate}%\n`;
    csv += `Pending / Awaiting,${paymentSummaryStats.pending.count},${paymentSummaryStats.pending.total.toFixed(2)},${pendingRate}%,0.0%\n`;
    csv += `Failed / Cancelled,${paymentSummaryStats.failed.count},${paymentSummaryStats.failed.total.toFixed(2)},${failedRate}%,0.0%\n`;
    csv += `Total Across All Statuses,${paymentSummaryStats.totalOrders},${paymentSummaryStats.totalVolume.toFixed(2)},100.0%,${successfulRate}%\n`;

    triggerCSVDownload(csv, "honey_palace_payment_summary_report");
  };

  // DOWNLOAD PAYSTACK RECONCILIATION CSV
  const downloadPaystackReconciliationReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Paystack Earnings & Payout Reconciliation Ledger\n";
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n`;
    csv += `Paystack Ghana Processing Fee Rate: 1.95%\n\n`;
    csv += "Order ID,Date,Customer Name,Channel,Paystack Reference,Gross Amount (₵),Paystack Fee (1.95%) (₵),Net Payout Due (₵),Settlement Status\n";

    paystackOrders.forEach(o => {
      const gross = o.total || 0;
      const fee = gross * PAYSTACK_FEE_RATE;
      const net = gross - fee;
      const dateStr = new Date(o.created_at || o.createdAt || Date.now()).toLocaleDateString();
      const channel = o.paystack_channel === 'card' ? 'Bank Card' : 'Mobile Money (MTN/Telecel/AT)';
      csv += `${o.orderNumber || o.id},"${dateStr}","${o.customer_name || 'Guest Customer'}","${channel}","${o.paystack_reference || 'N/A'}",${gross.toFixed(2)},${fee.toFixed(2)},${net.toFixed(2)},${o.settlement_status || 'settled'}\n`;
    });

    csv += `\nSUMMARY TOTALS,,,,,"${paystackGross.toFixed(2)}","${paystackFees.toFixed(2)}","${paystackNetPayout.toFixed(2)}","Settled: ₵${settledNet.toFixed(2)} | In-Transit: ₵${unsettledNet.toFixed(2)}"\n`;

    triggerCSVDownload(csv, "honey_palace_paystack_payout_reconciliation");
  };

  // DOWNLOAD FULL SALES REGISTER CSV
  const downloadSalesRegisterReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Sales Transactions Audit Register\n";
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n\n`;
    csv += "Transaction ID,Date & Time,Customer Name,Executive,Payment Method,Location/Event,Item Breakdown,Total (₵)\n";

    filteredSales.forEach(s => {
      const itemsStr = (s.cartItems || []).map(i => `${i.quantity}x ${i.name}`).join(' | ');
      csv += `${s.id},"${new Date(s.sale_date).toLocaleString()}","${s.customer_name || 'Walk-in Customer'}","${s.user_name || 'Staff'}","${s.payment_method || 'Cash'}","${s.exhibition_name || 'Store Front'}","${itemsStr}",${(s.total || 0).toFixed(2)}\n`;
    });

    triggerCSVDownload(csv, "honey_palace_sales_register");
  };

  // DOWNLOAD HARVEST BATCHES CSV
  const downloadHarvestReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Harvest Lots & Extraction Batches Report\n\n";
    csv += "Batch Number,Associated Product,Quantity Remaining,Harvest Date,Expiry Date\n";
    
    batches.forEach(b => {
      csv += `${b.batch_number},"${b.product_name}",${b.quantity_remaining || 0},${b.harvest_date || 'N/A'},${b.expiry_date || 'N/A'}\n`;
    });

    triggerCSVDownload(csv, "honey_palace_harvest_batches");
  };

  // DOWNLOAD EXPENSES LEDGER CSV
  const downloadExpensesReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Operational Expenses Audit Log\n";
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Present'}\n\n`;
    csv += "Expense ID,Category,Amount (₵),Expense Date,Description\n";

    filteredExpenses.forEach(e => {
      csv += `${e.id},${e.category},${(e.amount || 0).toFixed(2)},${e.expense_date},"${e.description}"\n`;
    });

    triggerCSVDownload(csv, "honey_palace_expenses_ledger");
  };

  // TRIGGER DATABASE BACKUP
  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/backup?download=true');
      if (!res.ok) throw new Error('Database backup endpoint returned status ' + res.status);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thehoneypalace_database_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 6000);
    } catch (err) {
      alert('Backup generation failed: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  // GENERATE & PRINT EXECUTIVE PDF REPORT
  const downloadPDFReport = () => {
    const periodText = startDate && endDate 
      ? `${startDate} to ${endDate}` 
      : startDate 
      ? `From ${startDate}` 
      : endDate 
      ? `Until ${endDate}` 
      : 'All Time';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to generate the PDF report.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sales & Financial Executive Audit Report - The Honey Palace</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; font-family: 'Poppins', sans-serif; color: #1a1a1a; font-size: 11px; }
            .no-print { display: none !important; }
          }
          body { font-family: 'Poppins', sans-serif; color: #1a1a1a; margin: 0; padding: 30px; background-color: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ffa200; padding-bottom: 20px; margin-bottom: 25px; }
          .brand { display: flex; align-items: center; gap: 15px; }
          .logo { height: 60px; }
          .title-area { text-align: right; }
          .title-area h1 { margin: 0; font-size: 20px; font-weight: 800; color: #1a1a1a; letter-spacing: 0.05em; text-transform: uppercase; }
          .title-area p { margin: 4px 0 0 0; color: #666; font-size: 11px; font-weight: 600; }
          
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
          .kpi-card { background: #fafafa; border: 1px solid #eee; border-radius: 10px; padding: 14px; }
          .kpi-title { font-size: 10px; text-transform: uppercase; color: #777; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 6px; }
          .kpi-value { font-size: 18px; font-weight: 800; color: #1a1a1a; }
          .kpi-value.gold { color: #d07b00; }
          .kpi-value.green { color: #16a34a; }
          
          .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #1a1a1a; margin: 25px 0 12px 0; border-left: 4px solid #ffa200; padding-left: 10px; letter-spacing: 0.03em; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th { background: #f4f4f5; font-weight: 700; text-transform: uppercase; font-size: 10px; color: #555; text-align: left; padding: 10px; border-bottom: 2px solid #e4e4e7; }
          td { padding: 9px 10px; border-bottom: 1px solid #f4f4f5; }
          tr:nth-child(even) td { background-color: #fafafa; }
          .text-right { text-align: right; }
          
          .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #777; }
          .signature-box { border-top: 1px dashed #aaa; width: 200px; text-align: center; padding-top: 6px; margin-top: 40px; font-weight: 600; }
          .print-btn-bar { background: #1a1a1a; color: white; padding: 12px 20px; position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; }
          .btn-print { background: #ffa200; color: #000; border: none; font-weight: 700; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="print-btn-bar no-print">
          <span style="font-weight:600; font-size:13px;">📄 Executive Financial & Inventory Report ready</span>
          <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
        </div>

        <div style="margin-top: 40px;">
          <div class="header">
            <div class="brand">
              <img src="/assets/honey-palace-logo.png" class="logo" alt="The Honey Palace" />
              <div>
                <h2 style="margin:0; font-size:16px; font-weight:800;">THE HONEY PALACE</h2>
                <p style="margin:2px 0 0 0; font-size:11px; color:#666;">Amrahia, Adentan Municipality, Greater Accra, Ghana</p>
              </div>
            </div>
            <div class="title-area">
              <h1>Executive Audit Report</h1>
              <p>Period: ${periodText}</p>
              <p>Generated: ${new Date().toLocaleString()}</p>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">Gross Sales Revenue</div>
              <div class="kpi-value gold">GHS ${totalRev.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Cost of Goods (COGS)</div>
              <div class="kpi-value">GHS ${totalCOGS.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Overhead Expenses</div>
              <div class="kpi-value">GHS ${totalExp.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Net Profit Margin</div>
              <div class="kpi-value green">GHS ${netProfit.toFixed(2)}</div>
            </div>
          </div>

          <div class="section-title">1. Top-Selling Honey Varieties & SKUs</div>
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th class="text-right">Units Sold</th>
                <th class="text-right">Revenue (GHS)</th>
                <th class="text-right">Est. COGS (GHS)</th>
                <th class="text-right">Net Profit (GHS)</th>
              </tr>
            </thead>
            <tbody>
              ${sortedVarieties.map(v => `
                <tr>
                  <td><strong>${v.name}</strong></td>
                  <td>${v.category}</td>
                  <td class="text-right">${v.unitsSold}</td>
                  <td class="text-right">GHS ${v.grossRevenue.toFixed(2)}</td>
                  <td class="text-right">GHS ${v.totalCost.toFixed(2)}</td>
                  <td class="text-right" style="font-weight:700; color:#16a34a;">GHS ${v.netProfit.toFixed(2)}</td>
                </tr>
              `).join('')}
              ${sortedVarieties.length === 0 ? '<tr><td colSpan="6" style="text-align:center;">No sales recorded in this period.</td></tr>' : ''}
            </tbody>
          </table>

          <div class="section-title">2. Staff Sales Performance Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Executive Name</th>
                <th class="text-right">Transactions Completed</th>
                <th class="text-right">Total Revenue Generated (GHS)</th>
              </tr>
            </thead>
            <tbody>
              ${sortedExecutives.map(e => `
                <tr>
                  <td><strong>${e.name}</strong></td>
                  <td class="text-right">${e.count}</td>
                  <td class="text-right" style="font-weight:700;">GHS ${e.totalSales.toFixed(2)}</td>
                </tr>
              `).join('')}
              ${sortedExecutives.length === 0 ? '<tr><td colSpan="3" style="text-align:center;">No staff transactions recorded.</td></tr>' : ''}
            </tbody>
          </table>

          <div class="section-title">3. Warehouse Stock Valuation Summary</div>
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th class="text-right">Current Stock</th>
                <th class="text-right">Cost Price (GHS)</th>
                <th class="text-right">Selling Price (GHS)</th>
                <th class="text-right">Total Potential Revenue (GHS)</th>
              </tr>
            </thead>
            <tbody>
              ${sortedProducts.slice(0, 10).map(p => `
                <tr>
                  <td><strong>${p.name}</strong></td>
                  <td>${p.category || 'Raw Honey'}</td>
                  <td class="text-right">${p.stockLevel || 0}</td>
                  <td class="text-right">GHS ${(p.costPrice || 0).toFixed(2)}</td>
                  <td class="text-right">GHS ${(p.sellingPrice || 0).toFixed(2)}</td>
                  <td class="text-right" style="font-weight:700;">GHS ${((p.stockLevel || 0) * (p.sellingPrice || 0)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">4. Geographic Orders & Delivery Distribution</div>
          <table>
            <thead>
              <tr>
                <th>Delivery Zone / Area</th>
                <th class="text-right">Order Count</th>
                <th class="text-right">Paid Volume (GHS)</th>
                <th class="text-right">Delivery Fees (GHS)</th>
              </tr>
            </thead>
            <tbody>
              ${sortedGeographicAreas.slice(0, 8).map(a => `
                <tr>
                  <td><strong>${a.name}</strong></td>
                  <td class="text-right">${a.orderCount}</td>
                  <td class="text-right" style="font-weight:700;">GHS ${a.grossRevenue.toFixed(2)}</td>
                  <td class="text-right">GHS ${a.deliveryFees.toFixed(2)}</td>
                </tr>
              `).join('')}
              ${sortedGeographicAreas.length === 0 ? '<tr><td colSpan="4" style="text-align:center;">No geographic orders recorded.</td></tr>' : ''}
            </tbody>
          </table>

          <div class="section-title">5. Paystack Financial Reconciliation & Net Payouts</div>
          <table>
            <thead>
              <tr>
                <th>Financial Metric</th>
                <th class="text-right">Value (GHS)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Gross Online Volume (Paystack)</strong></td>
                <td class="text-right" style="font-weight:700;">GHS ${paystackGross.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Paystack Processing Fees (1.95% Standard Ghana Rate)</td>
                <td class="text-right" style="color:#e11d48;">- GHS ${paystackFees.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Net Estimated Payout Due</strong></td>
                <td class="text-right" style="font-weight:700; color:#16a34a;">GHS ${paystackNetPayout.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Settled Funds (Received into Bank)</td>
                <td class="text-right">GHS ${settledNet.toFixed(2)}</td>
              </tr>
              <tr>
                <td>In-Transit / Unsettled Funds</td>
                <td class="text-right">GHS ${unsettledNet.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <div>
              <p>Report generated automatically by The Honey Palace Africa Inventory & Accounting System.</p>
              <p>Confidential — Internal Operations & Management Use Only.</p>
            </div>
            <div class="signature-box">
              Authorized Executive Signature
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <AuthShield requiredPermission="report.view">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        
        {/* Date Filter & Export Header */}
        <div className="bg-white border border-[#d07b00]/10 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-end justify-between shadow-none">
          <div className="space-y-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-xs text-text-muted-dark font-semibold">
              <Calendar className="w-4 h-4 text-[#ffa200]" /> Quick Presets:
              <div className="flex flex-wrap gap-1.5 ml-1">
                <button onClick={() => applyDatePreset('today')} className="px-2.5 py-1 bg-bg-light hover:bg-[#ffa200]/20 rounded-md text-[11px] font-bold text-black border border-black/5 transition-colors">Today</button>
                <button onClick={() => applyDatePreset('week')} className="px-2.5 py-1 bg-bg-light hover:bg-[#ffa200]/20 rounded-md text-[11px] font-bold text-black border border-black/5 transition-colors">This Week</button>
                <button onClick={() => applyDatePreset('month')} className="px-2.5 py-1 bg-bg-light hover:bg-[#ffa200]/20 rounded-md text-[11px] font-bold text-black border border-black/5 transition-colors">This Month</button>
                <button onClick={() => applyDatePreset('quarter')} className="px-2.5 py-1 bg-bg-light hover:bg-[#ffa200]/20 rounded-md text-[11px] font-bold text-black border border-black/5 transition-colors">This Quarter</button>
                <button onClick={() => applyDatePreset('year')} className="px-2.5 py-1 bg-bg-light hover:bg-[#ffa200]/20 rounded-md text-[11px] font-bold text-black border border-black/5 transition-colors">This Year</button>
                <button onClick={() => applyDatePreset('all')} className="px-2.5 py-1 bg-bg-light hover:bg-[#ffa200]/20 rounded-md text-[11px] font-bold text-black border border-black/5 transition-colors">All Time</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-end text-xs">
              <div className="flex flex-col gap-1.5">
                <span className="text-text-muted-dark font-semibold">Start Date</span>
                <input
                  type="date"
                  className="bg-bg-light border border-black/10 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black font-semibold"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <span className="text-text-muted-dark font-semibold">End Date</span>
                <input
                  type="date"
                  className="bg-bg-light border border-black/10 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black font-semibold"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
              onClick={downloadPDFReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-black/90 text-white font-bold rounded-xl transition-all duration-300 text-xs shadow-sm"
            >
              <Printer className="w-4 h-4 text-[#ffa200]" />
              Export Executive PDF Report
            </button>
            <button
              onClick={() => {
                downloadFinancialReport();
                downloadTopVarietiesReport();
                downloadGeographicOrdersReport();
                downloadPaymentSummaryReport();
                downloadPaystackReconciliationReport();
                downloadSalesRegisterReport();
                downloadExpensesReport();
                downloadStockReport();
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#ffa200] hover:bg-gold-light text-black font-bold rounded-xl transition-all duration-300 text-xs shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-black" />
              Export All CSV Datasets
            </button>
          </div>
        </div>

        {/* Security Hardening, PII Privacy & Automated Backup Controls */}
        <div className="bg-stone-50 border border-stone-200/70 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>TLS 1.3 / HSTS Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Customer PII {revealPII ? 'Revealed' : 'Masked (Protected)'}</span>
            </div>
            <button
              onClick={() => setRevealPII(!revealPII)}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-none"
            >
              {revealPII ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
              {revealPII ? 'Re-mask Sensitive PII' : 'Reveal Customer Records'}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleDownloadBackup}
              disabled={isBackingUp}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white font-bold rounded-xl transition-all duration-200 text-xs shadow-none w-full md:w-auto justify-center disabled:opacity-50"
            >
              {isBackingUp ? <RefreshCw className="w-3.5 h-3.5 text-[#ffa200] animate-spin" /> : <Database className="w-3.5 h-3.5 text-[#ffa200]" />}
              {isBackingUp ? 'Generating Backup...' : 'Download Database Snapshot (JSON)'}
            </button>
          </div>
        </div>

        {backupSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Automated Firestore database backup snapshot exported and downloaded successfully!</span>
          </div>
        )}

        {/* KPI Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-[#d07b00]/10 p-5 rounded-2xl flex items-center justify-between shadow-none">
            <div className="space-y-1">
              <span className="text-[10px] text-text-muted-dark font-bold uppercase tracking-wider">Gross Revenue</span>
              <p className="text-xl font-bold text-black font-display">₵{totalRev.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ffa200]/10 flex items-center justify-center text-[#d07b00]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white border border-[#d07b00]/10 p-5 rounded-2xl flex items-center justify-between shadow-none">
            <div className="space-y-1">
              <span className="text-[10px] text-text-muted-dark font-bold uppercase tracking-wider">COGS</span>
              <p className="text-xl font-bold text-black font-display">₵{totalCOGS.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ffa200]/10 flex items-center justify-center text-[#d07b00]">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white border border-[#d07b00]/10 p-5 rounded-2xl flex items-center justify-between shadow-none">
            <div className="space-y-1">
              <span className="text-[10px] text-text-muted-dark font-bold uppercase tracking-wider">Total Expenses</span>
              <p className="text-xl font-bold text-black font-display">₵{totalExp.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-[#ffa200] border border-[#d07b00]/25 p-5 rounded-2xl flex items-center justify-between shadow-none relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-black/5 rounded-full blur-xl group-hover:bg-black/10 transition-all duration-500" />
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] text-black/60 font-bold uppercase tracking-wider">Net Profit</span>
              <p className="text-xl font-bold text-black font-display">₵{netProfit.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center text-black relative z-10">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Top Selling Varieties & SKUs Section */}
          <div className="bg-white border border-[#d07b00]/10 rounded-2xl shadow-none flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-text-muted-dark font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-[#ffa200]" /> Product Demand
                  </span>
                  <h3 className="text-lg font-bold text-black font-display pt-1">Top-Selling Honey Varieties & SKUs</h3>
                </div>
                <button
                  onClick={downloadTopVarietiesReport}
                  className="px-3 py-2 bg-bg-light hover:bg-[#ffa200]/10 text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-colors border border-black/10 hover:border-[#ffa200]/30 shadow-none"
                >
                  <Download className="w-3.5 h-3.5 text-[#ffa200]" /> Export CSV
                </button>
              </div>
            </div>
            <div className="flex-1 p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-light border-b border-black/5 text-text-muted-dark uppercase tracking-wider">
                  <tr>
                    <th className="p-3 font-semibold">Variety / SKU</th>
                    <th className="p-3 font-semibold text-right">Units Sold</th>
                    <th className="p-3 font-semibold text-right">Gross Rev</th>
                    <th className="p-3 font-semibold text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sortedVarieties.slice(0, 5).map(v => (
                    <tr key={v.id} className="hover:bg-bg-light/50 transition-colors">
                      <td className="p-3">
                        <p className="font-semibold text-black truncate max-w-[170px]">{v.name}</p>
                        <p className="text-[10px] text-text-muted-dark truncate">{v.category}</p>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-black">
                        {v.unitsSold}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-black">
                        ₵{v.grossRevenue.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        ₵{v.netProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {sortedVarieties.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-text-muted-dark italic font-medium">No product sales in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Finances Report Section */}
          <div className="bg-white border border-[#d07b00]/10 rounded-2xl shadow-none flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-text-muted-dark font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#ffa200]" /> Financial Performance
                  </span>
                  <h3 className="text-lg font-bold text-black font-display pt-1">Profit Breakdown</h3>
                </div>
                <button
                  onClick={downloadFinancialReport}
                  className="px-3 py-2 bg-[#ffa200] hover:bg-gold-light text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-colors border border-transparent shadow-none"
                >
                  <Download className="w-3.5 h-3.5 text-black" /> Export CSV
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 flex flex-col justify-center space-y-6">
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-muted-dark">Cost of Goods (COGS)</span>
                  <span className="font-mono font-bold">₵{totalCOGS.toFixed(2)}</span>
                </div>
                <div className="w-full bg-bg-light rounded-full h-2.5 overflow-hidden">
                  <div className="bg-[#d07b00] h-2.5 rounded-full" style={{ width: `${totalRev ? Math.min(100, (totalCOGS / totalRev) * 100) : 0}%` }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-muted-dark">Overhead Expenses</span>
                  <span className="font-mono font-bold">₵{totalExp.toFixed(2)}</span>
                </div>
                <div className="w-full bg-bg-light rounded-full h-2.5 overflow-hidden">
                  <div className="bg-rose-500 h-2.5 rounded-full" style={{ width: `${totalRev ? Math.min(100, (totalExp / totalRev) * 100) : 0}%` }}></div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-emerald-600 flex items-center gap-1"><PieChart className="w-3.5 h-3.5"/> Net Profit Margin</span>
                  <span className="font-mono font-bold text-emerald-600">{totalRev ? ((netProfit / totalRev) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="w-full bg-emerald-500/10 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${totalRev ? Math.max(0, Math.min(100, (netProfit / totalRev) * 100)) : 0}%` }}></div>
                </div>
              </div>

            </div>
          </div>

          {/* Stock Report Section */}
          <div className="bg-white border border-[#d07b00]/10 rounded-2xl shadow-none flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-text-muted-dark font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-[#ffa200]" /> Stock Inventory Ledger
                  </span>
                  <h3 className="text-lg font-bold text-black font-display pt-1">Highest Value Stock</h3>
                </div>
                <button
                  onClick={downloadStockReport}
                  className="px-3 py-2 bg-bg-light hover:bg-[#ffa200]/10 text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-colors border border-black/10 hover:border-[#ffa200]/30 shadow-none"
                >
                  <Download className="w-3.5 h-3.5 text-[#ffa200]" /> Export CSV
                </button>
              </div>
            </div>
            <div className="flex-1 p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-light border-b border-black/5 text-text-muted-dark uppercase tracking-wider">
                  <tr>
                    <th className="p-3 font-semibold">Product</th>
                    <th className="p-3 font-semibold text-right">Stock</th>
                    <th className="p-3 font-semibold text-right">Potential Rev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sortedProducts.slice(0, 4).map(p => {
                    const rev = (p.stockLevel || 0) * (p.sellingPrice || 0);
                    return (
                      <tr key={p.id} className="hover:bg-bg-light/50 transition-colors">
                        <td className="p-3">
                          <p className="font-semibold text-black truncate max-w-[150px]">{p.name}</p>
                          <p className="text-[10px] text-text-muted-dark truncate">{p.category}</p>
                        </td>
                        <td className="p-3 text-right">
                          <span className="bg-black/5 px-2 py-0.5 rounded font-mono font-semibold">{p.stockLevel}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-black">
                          ₵{rev.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Report Section */}
          <div className="bg-white border border-[#d07b00]/10 rounded-2xl shadow-none flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-text-muted-dark font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-[#ffa200]" /> Operating Costs
                  </span>
                  <h3 className="text-lg font-bold text-black font-display pt-1">Recent Expenses Ledger</h3>
                </div>
                <button
                  onClick={downloadExpensesReport}
                  className="px-3 py-2 bg-bg-light hover:bg-[#ffa200]/10 text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-colors border border-black/10 hover:border-[#ffa200]/30 shadow-none"
                >
                  <Download className="w-3.5 h-3.5 text-[#ffa200]" /> Export CSV
                </button>
              </div>
            </div>
            <div className="flex-1 p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-light border-b border-black/5 text-text-muted-dark uppercase tracking-wider">
                  <tr>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Category</th>
                    <th className="p-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sortedExpenses.slice(0, 4).map(e => (
                    <tr key={e.id} className="hover:bg-bg-light/50 transition-colors">
                      <td className="p-3 text-text-muted-dark font-medium whitespace-nowrap">
                        {new Date(e.expense_date).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-black truncate max-w-[150px]">{e.category}</p>
                        <p className="text-[10px] text-text-muted-dark truncate max-w-[150px]">{e.description}</p>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-black">
                        ₵{(e.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {sortedExpenses.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-6 text-center text-text-muted-dark italic font-medium">No expenses in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales by Executive Section */}
          <div className="bg-white border border-[#d07b00]/10 rounded-2xl shadow-none flex flex-col h-full overflow-hidden lg:col-span-2">
            <div className="p-6 border-b border-black/5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-text-muted-dark font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#ffa200]" /> Staff Performance
                </span>
                <h3 className="text-lg font-bold text-black font-display pt-1">Sales by Executive</h3>
              </div>
              <button
                onClick={downloadSalesRegisterReport}
                className="px-3 py-2 bg-bg-light hover:bg-[#ffa200]/10 text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-colors border border-black/10 hover:border-[#ffa200]/30 shadow-none"
              >
                <Download className="w-3.5 h-3.5 text-[#ffa200]" /> Export Full Sales Register CSV
              </button>
            </div>
            <div className="flex-1 p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-light border-b border-black/5 text-text-muted-dark uppercase tracking-wider">
                  <tr>
                    <th className="p-3 font-semibold">Executive Name</th>
                    <th className="p-3 font-semibold text-right">Transactions</th>
                    <th className="p-3 font-semibold text-right">Total Sales Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sortedExecutives.map(exec => (
                    <tr key={exec.name} className="hover:bg-bg-light/50 transition-colors">
                      <td className="p-3">
                        <span className="font-semibold text-black">{exec.name}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="bg-black/5 px-2 py-0.5 rounded font-mono font-semibold">{exec.count}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-black">
                        ₵{(exec.totalSales || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {sortedExecutives.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-6 text-center text-text-muted-dark italic font-medium">No sales data in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Orders by Geographic Delivery Area Section */}
          <div className="bg-white border border-[#d07b00]/10 rounded-2xl shadow-none flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-text-muted-dark font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#ffa200]" /> Regional Demand
                  </span>
                  <h3 className="text-lg font-bold text-black font-display pt-1">Orders by Geographic Area</h3>
                </div>
                <button
                  onClick={downloadGeographicOrdersReport}
                  className="px-3 py-2 bg-bg-light hover:bg-[#ffa200]/10 text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-colors border border-black/10 hover:border-[#ffa200]/30 shadow-none"
                >
                  <Download className="w-3.5 h-3.5 text-[#ffa200]" /> Export CSV
                </button>
              </div>
            </div>
            <div className="flex-1 p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-light border-b border-black/5 text-text-muted-dark uppercase tracking-wider">
                  <tr>
                    <th className="p-3 font-semibold">Delivery Zone</th>
                    <th className="p-3 font-semibold text-right">Orders</th>
                    <th className="p-3 font-semibold text-right">Delivery Fees</th>
                    <th className="p-3 font-semibold text-right">Gross GMV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sortedGeographicAreas.slice(0, 5).map(area => (
                    <tr key={area.name} className="hover:bg-bg-light/50 transition-colors">
                      <td className="p-3">
                        <p className="font-semibold text-black truncate max-w-[160px]">{area.name}</p>
                        <p className="text-[10px] text-text-muted-dark font-medium">{area.paidOrdersCount} completed / paid</p>
                      </td>
                      <td className="p-3 text-right">
                        <span className="bg-black/5 px-2 py-0.5 rounded font-mono font-semibold">{area.orderCount}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-black">
                        ₵{area.deliveryFees.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        ₵{area.grossRevenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {sortedGeographicAreas.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-text-muted-dark italic font-medium">No geographic order data recorded in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summaries (Successful, Pending, Failed) Section */}
          <div className="bg-white border border-[#d07b00]/10 rounded-2xl shadow-none flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-text-muted-dark font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#ffa200]" /> Payment Gateway Audits
                  </span>
                  <h3 className="text-lg font-bold text-black font-display pt-1">Payment Summaries</h3>
                </div>
                <button
                  onClick={downloadPaymentSummaryReport}
                  className="px-3 py-2 bg-bg-light hover:bg-[#ffa200]/10 text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-colors border border-black/10 hover:border-[#ffa200]/30 shadow-none"
                >
                  <Download className="w-3.5 h-3.5 text-[#ffa200]" /> Export CSV
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200/60 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Successful
                  </div>
                  <p className="text-base font-bold font-mono text-emerald-900 mt-1">₵{paymentSummaryStats.successful.total.toFixed(2)}</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">{paymentSummaryStats.successful.count} orders ({paymentSummaryStats.totalOrders ? ((paymentSummaryStats.successful.count / paymentSummaryStats.totalOrders) * 100).toFixed(0) : 0}%)</p>
                </div>
                <div className="bg-amber-50 border border-amber-200/60 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending
                  </div>
                  <p className="text-base font-bold font-mono text-amber-900 mt-1">₵{paymentSummaryStats.pending.total.toFixed(2)}</p>
                  <p className="text-[10px] text-amber-700 font-semibold">{paymentSummaryStats.pending.count} orders ({paymentSummaryStats.totalOrders ? ((paymentSummaryStats.pending.count / paymentSummaryStats.totalOrders) * 100).toFixed(0) : 0}%)</p>
                </div>
                <div className="bg-rose-50 border border-rose-200/60 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Failed
                  </div>
                  <p className="text-base font-bold font-mono text-rose-900 mt-1">₵{paymentSummaryStats.failed.total.toFixed(2)}</p>
                  <p className="text-[10px] text-rose-700 font-semibold">{paymentSummaryStats.failed.count} orders ({paymentSummaryStats.totalOrders ? ((paymentSummaryStats.failed.count / paymentSummaryStats.totalOrders) * 100).toFixed(0) : 0}%)</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-muted-dark">Payment Conversion Rate</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {paymentSummaryStats.totalOrders ? ((paymentSummaryStats.successful.count / paymentSummaryStats.totalOrders) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="w-full bg-bg-light rounded-full h-3 overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-3" 
                    style={{ width: `${paymentSummaryStats.totalOrders ? (paymentSummaryStats.successful.count / paymentSummaryStats.totalOrders) * 100 : 0}%` }}
                    title="Successful"
                  />
                  <div 
                    className="bg-amber-400 h-3" 
                    style={{ width: `${paymentSummaryStats.totalOrders ? (paymentSummaryStats.pending.count / paymentSummaryStats.totalOrders) * 100 : 0}%` }}
                    title="Pending"
                  />
                  <div 
                    className="bg-rose-500 h-3" 
                    style={{ width: `${paymentSummaryStats.totalOrders ? (paymentSummaryStats.failed.count / paymentSummaryStats.totalOrders) * 100 : 0}%` }}
                    title="Failed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Paystack Real-Time Earnings & Payout Reconciliation Section */}
          <div className="bg-white border border-[#d07b00]/10 rounded-2xl shadow-none flex flex-col h-full overflow-hidden lg:col-span-2">
            <div className="p-6 border-b border-black/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted-dark font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#ffa200]" /> Financial Gateway Tracking
                  </span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md text-[10px] font-bold">
                    Paystack 1.95% Auto-Reconciliation
                  </span>
                </div>
                <h3 className="text-lg font-bold text-black font-display pt-1">Paystack Earnings & Bank Payout Reconciliation</h3>
              </div>
              <button
                onClick={downloadPaystackReconciliationReport}
                className="px-3 py-2 bg-[#ffa200] hover:bg-gold-light text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-colors border border-transparent shadow-none"
              >
                <Download className="w-3.5 h-3.5 text-black" /> Export Reconciliation Ledger CSV
              </button>
            </div>

            {/* Reconciliation KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-stone-50/50 border-b border-black/5">
              <div className="space-y-1">
                <span className="text-[10px] text-text-muted-dark font-bold uppercase tracking-wider">Gross Online Volume</span>
                <p className="text-xl font-bold font-mono text-black">₵{paystackGross.toFixed(2)}</p>
                <p className="text-[10px] text-text-muted-dark font-medium">{paystackOrders.length} processed orders</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Paystack Fees (1.95%)</span>
                <p className="text-xl font-bold font-mono text-rose-600">-₵{paystackFees.toFixed(2)}</p>
                <p className="text-[10px] text-text-muted-dark font-medium">Auto-deducted at source</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Net Payouts Due</span>
                <p className="text-xl font-bold font-mono text-emerald-600">₵{paystackNetPayout.toFixed(2)}</p>
                <p className="text-[10px] text-emerald-700 font-medium">98.05% of gross intake</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-text-muted-dark font-bold uppercase tracking-wider">Settlement Split</span>
                <p className="text-xs font-bold text-black flex items-center gap-1.5 mt-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> Settled: ₵{settledNet.toFixed(2)}
                </p>
                <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span> In-Transit: ₵{unsettledNet.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Reconciliation Ledger Table */}
            <div className="flex-1 p-0 overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-bg-light border-b border-black/5 text-text-muted-dark uppercase tracking-wider">
                  <tr>
                    <th className="p-3 font-semibold">Order / Ref</th>
                    <th className="p-3 font-semibold">Customer (Protected)</th>
                    <th className="p-3 font-semibold">Channel</th>
                    <th className="p-3 font-semibold text-right">Gross (₵)</th>
                    <th className="p-3 font-semibold text-right">Fee (1.95%)</th>
                    <th className="p-3 font-semibold text-right">Net Payout (₵)</th>
                    <th className="p-3 font-semibold text-center">Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {paystackOrders.map(order => {
                    const gross = order.total || 0;
                    const fee = gross * PAYSTACK_FEE_RATE;
                    const net = gross - fee;
                    const isSettled = order.settlement_status === 'settled';

                    return (
                      <tr key={order.id} className="hover:bg-bg-light/50 transition-colors">
                        <td className="p-3">
                          <p className="font-bold text-black">{order.orderNumber || order.id}</p>
                          <p className="text-[10px] font-mono text-text-muted-dark">{order.paystack_reference || 'ref_pending'}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-black">{order.customer_name || 'Guest'}</p>
                          <p className="text-[10px] font-mono text-text-muted-dark">
                            {maskPhone(order.customer_phone, revealPII)}
                          </p>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/5 text-black">
                            {order.paystack_channel === 'card' ? 'Bank Card' : 'Mobile Money'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-black">
                          ₵{gross.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600">
                          -₵{fee.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">
                          ₵{net.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isSettled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isSettled ? 'Settled to Bank' : 'In Transit'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {paystackOrders.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-text-muted-dark italic font-medium">No Paystack online transactions recorded in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </AuthShield>
  );
}
