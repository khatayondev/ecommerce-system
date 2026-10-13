'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, runTransaction, query, where, getDocs, addDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { hasPermission } from '@/utils/permissions';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { logAction } from '@/utils/logging';
import { 
  Search, 
  User, 
  Trash2, 
  Plus, 
  Minus, 
  Tag, 
  CreditCard, 
  DollarSign, 
  Smartphone, 
  Printer,
  Edit2,
  CheckCircle2,
  LayoutGrid,
  ShoppingCart,
  Droplet,
  Hexagon,
  Beaker,
  Flame,
  Sun,
  Star,
  Package as PackageIcon,
  Wifi,
  WifiOff,
  CloudOff,
  Zap,
  RefreshCw,
  X,
  AlertTriangle,
  UserCheck,
  UserPlus,
  Gift,
  Sparkles
} from 'lucide-react';
import { 
  cacheProducts, 
  getCachedProducts, 
  cacheCustomers, 
  getCachedCustomers, 
  cacheExhibitions, 
  getCachedExhibitions, 
  addOfflineSale, 
  getOfflineSalesQueue, 
  syncOfflineSales 
} from '@/utils/offlineStore';
import { triggerNewOrderNotification, requestNotificationPermission } from '@/utils/pushNotifications';

const MOCK_PRODUCTS = [
  { id: 'bottle-250ml', name: '250ml Honey Bottle', category: 'Multifloral (raw honey)', spec: '250 ml', stockLevel: 210, costPrice: 13.00, sellingPrice: 25.00 },
  { id: 'bottle-500ml', name: '500ml Honey Bottle', category: 'Multifloral (raw honey)', spec: '500 ml', stockLevel: 140, costPrice: 22.50, sellingPrice: 45.00 },
  { id: 'bottle-1l', name: '1L Honey Bottle', category: 'Multifloral (raw honey)', spec: '1000 ml', stockLevel: 85, costPrice: 40.00, sellingPrice: 80.00 },
  { id: 'sachet', name: 'Honey Sachet Box', category: 'Multifloral (raw honey)', spec: 'Box of 30', stockLevel: 99, costPrice: 110.00, sellingPrice: 225.00 },
  { id: 'gallon-2.5l', name: '2.5L Honey Gallon', category: 'Multifloral (raw honey)', spec: '2.5 Liters', stockLevel: 59, costPrice: 85.00, sellingPrice: 170.00 },
  { id: 'gallon-4.5l', name: '4.5L Honey Gallon', category: 'Multifloral (raw honey)', spec: '4.5 Liters', stockLevel: 31, costPrice: 150.00, sellingPrice: 300.00 },
];

const MOCK_CUSTOMERS = [
  { id: 'walk-in', name: 'Walk-in Customer', customer_type: 'Retail' },
  { id: 'cust-1', name: 'Alice Mensah', customer_type: 'Retail' },
  { id: 'cust-2', name: 'Kwame Owusu', customer_type: 'Wholesale' },
];

const MOCK_BATCHES = [
  { id: 'batch-1', batch_number: 'B-2026-AMR-01', product_id: 'bottle-500ml', quantity_remaining: 85, expiry_date: '2029-05-10' },
  { id: 'batch-2', batch_number: 'B-2026-NKR-02', product_id: 'bottle-1l', quantity_remaining: 50, expiry_date: '2029-04-18' },
  { id: 'batch-3', batch_number: 'B-2025-AMR-09', product_id: 'acacia', quantity_remaining: 15, expiry_date: '2028-09-01' },
];

const MOCK_EXHIBITIONS = [
  { id: 'none', name: 'None (Standard In-Shop Sale)', discount_percent: 0 },
  { id: 'ex-1', name: 'Accra Food & Honey Expo 2026', discount_percent: 10 },
];

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1587049352847-4d4b126a51ce?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";

export default function POSPage() {
  const { roles, user, sandbox } = useAuth();
  const { showConfirm } = useUI();
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [exhibitions, setExhibitions] = useState([]);
  const [promoPackages, setPromoPackages] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);

  // Offline Mode States
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // POS State
  const [cart, setCart] = useState([]);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedCustomerId, setSelectedCustomerId] = useState('walk-in');
  const [selectedExhibitionId, setSelectedExhibitionId] = useState('none');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [orderType, setOrderType] = useState('Walk-in'); // 'Walk-in' | 'Delivery' | 'Wholesale'
  
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [activePromo, setActivePromo] = useState(null);
  const { settings } = useStoreSettings();
  const taxRate = settings 
    ? (settings.vatRate || 0) + (settings.nhilRate || 0) + (settings.getfundRate || 0) + (settings.covidRate || 0) 
    : 0;

  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [posCustomerSearch, setPosCustomerSearch] = useState('');
  const [showAddPosCustomer, setShowAddPosCustomer] = useState(false);
  const [newPosCustomerName, setNewPosCustomerName] = useState('');
  const [newPosCustomerPhone, setNewPosCustomerPhone] = useState('');
  const [newPosCustomerEmail, setNewPosCustomerEmail] = useState('');
  const [newPosCustomerType, setNewPosCustomerType] = useState('Retail');
  const [isAddingPosCustomer, setIsAddingPosCustomer] = useState(false);

  const filteredPosCustomers = useMemo(() => {
    const q = posCustomerSearch.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c => {
      const nameMatch = (c.name || c.full_name || '').toLowerCase().includes(q);
      const phoneMatch = (c.phone || c.phoneNumber || '').toLowerCase().includes(q);
      const emailMatch = (c.email || '').toLowerCase().includes(q);
      const typeMatch = (c.customer_type || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch || emailMatch || typeMatch;
    });
  }, [customers, posCustomerSearch]);

  const handleCreatePosCustomer = async (e) => {
    if (e) e.preventDefault();
    if (!newPosCustomerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setIsAddingPosCustomer(true);
    try {
      const newCustData = {
        name: newPosCustomerName.trim(),
        full_name: newPosCustomerName.trim(),
        phone: newPosCustomerPhone.trim(),
        phoneNumber: newPosCustomerPhone.trim(),
        email: newPosCustomerEmail.trim(),
        customer_type: newPosCustomerType,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'customers'), newCustData);
      const createdObj = { id: docRef.id, ...newCustData };
      setCustomers(prev => [createdObj, ...prev]);
      setSelectedCustomerId(docRef.id);
      if (newPosCustomerType === 'Wholesale') {
        setDiscountPercent(15);
      } else {
        setDiscountPercent(0);
      }
      setReceiptEmail(newPosCustomerEmail.trim());
      setReceiptPhone(newPosCustomerPhone.trim());
      toast.success(`Added customer: ${newPosCustomerName}`);
      setShowAddPosCustomer(false);
      setShowCustomerSelect(false);
      setNewPosCustomerName('');
      setNewPosCustomerPhone('');
      setNewPosCustomerEmail('');
      setPosCustomerSearch('');
    } catch (err) {
      console.error('Error creating customer:', err);
      toast.error('Failed to add customer');
    } finally {
      setIsAddingPosCustomer(false);
    }
  };

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [receiptEmail, setReceiptEmail] = useState('');
  const [receiptPhone, setReceiptPhone] = useState('');
  const [sendingReceipt, setSendingReceipt] = useState(null); // null | 'email' | 'sms'

  // Permissions checks
  const canApplyDiscount = hasPermission(roles, 'sale.discount');

  // Trigger sync of queued offline sales
  const triggerAutoSync = async () => {
    if (!db || typeof window === 'undefined' || !navigator.onLine) return;
    const queue = getOfflineSalesQueue();
    if (!queue || queue.length === 0) return;

    setIsSyncingOffline(true);
    try {
      const res = await syncOfflineSales(db, (completed, total) => {
        setPendingOfflineCount(total - completed);
      });
      if (res.success && res.syncedCount > 0) {
        toast.success(`Synced ${res.syncedCount} offline sale(s) to cloud!`, { icon: '⚡' });
      }
    } catch (err) {
      console.error('[POS] Auto sync failed:', err);
    } finally {
      setIsSyncingOffline(false);
      setPendingOfflineCount(getOfflineSalesQueue().length);
    }
  };

  // Monitor Network Connectivity & Pending Queue
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection restored! Syncing offline sales...", { icon: '⚡' });
      triggerAutoSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Offline Mode Active (Pop-up Stand Mode)", { icon: '📡' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setPendingOfflineCount(getOfflineSalesQueue().length);

    // Initial check to trigger sync if online and pending items exist
    if (navigator.onLine) {
      triggerAutoSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!db) {
      setProducts(MOCK_PRODUCTS);
      setCustomers(MOCK_CUSTOMERS);
      setBatches(MOCK_BATCHES);
      setExhibitions(MOCK_EXHIBITIONS);
      setIsMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      const finalProducts = list.length > 0 ? list : MOCK_PRODUCTS;
      setProducts(finalProducts);
      cacheProducts(finalProducts);
      setLoading(false);
    }, (err) => {
      console.warn('[POS] Products permission/network warning:', err.message);
      const cached = getCachedProducts();
      if (cached && cached.length > 0) {
        setProducts(cached);
      } else {
        setProducts(MOCK_PRODUCTS);
      }
      setLoading(false);
    });

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      const finalCust = list.length > 0 ? [{ id: 'walk-in', name: 'Walk-in Customer', customer_type: 'Retail' }, ...list.filter(c => c.id !== 'walk-in')] : MOCK_CUSTOMERS;
      setCustomers(finalCust);
      cacheCustomers(finalCust);
    }, (err) => {
      console.warn('[POS] Customers permission warning:', err.message);
      const cached = getCachedCustomers();
      if (cached && cached.length > 0) {
        setCustomers(cached);
      }
    });

    const unsubscribeBatches = onSnapshot(collection(db, 'batches'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setBatches(list.length > 0 ? list : MOCK_BATCHES);
    }, (err) => console.warn('[POS] Batches permission warning:', err.message));

    const unsubscribeExhibitions = onSnapshot(collection(db, 'exhibitions'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'active') {
          list.push({ id: doc.id, ...data });
        }
      });
      const finalEx = [{ id: 'none', name: 'None (Standard In-Shop Sale)', discount_percent: 0 }, ...list];
      setExhibitions(finalEx);
      cacheExhibitions(finalEx);
    }, (err) => {
      console.warn('[POS] Exhibitions permission warning:', err.message);
      const cached = getCachedExhibitions();
      if (cached && cached.length > 0) {
        setExhibitions(cached);
      }
    });

    const unsubscribePromoPackages = onSnapshot(collection(db, 'promo_packages'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.isActive !== false) {
          list.push({ id: doc.id, ...data });
        }
      });
      setPromoPackages(list);
    }, (err) => console.warn('[POS] Promo packages permission warning:', err.message));

    return () => {
      unsubscribeProducts();
      unsubscribeCustomers();
      unsubscribeBatches();
      unsubscribeExhibitions();
      unsubscribePromoPackages();
    };
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || { name: 'Walk-in Customer', customer_type: 'Retail' };
  const isWholesale = selectedCustomer.customer_type === 'Wholesale';
  const selectedExhibition = exhibitions.find(e => e.id === selectedExhibitionId) || { id: 'none', name: 'None', discount_percent: 0 };

  // Combined available packages from current exhibition + global promo packages
  const availablePackages = useMemo(() => {
    const exPkgs = (selectedExhibition?.packages || [])
      .filter(p => p.isActive !== false)
      .map(p => ({ ...p, isExhibition: true, exhibitionName: selectedExhibition.name }));
    const promoPkgs = (promoPackages || [])
      .filter(p => p.isActive !== false)
      .map(p => ({ ...p, isExhibition: false }));
    const combined = [...exPkgs];
    promoPkgs.forEach(p => {
      if (!combined.some(cp => cp.id === p.id)) {
        combined.push(p);
      }
    });
    return combined;
  }, [selectedExhibition, promoPackages]);

  const categories = useMemo(() => {
    const activeProds = products.filter(p => p.isActive !== false && !p.deleted && !p.isDeleted);
    const catsSet = new Set(activeProds.map(p => {
      const cat = p.category;
      if (!cat || cat.toLowerCase() === 'uncategorized') return 'Others';
      return cat;
    }).filter(Boolean));
    const cats = Array.from(catsSet).sort();
    
    const hasOthers = cats.includes('Others');
    let finalCats = cats.filter(c => c !== 'Others');
    if (hasOthers) {
      finalCats.push('Others');
    }
    
    return ['All', ...finalCats];
  }, [products]);

  const handleSendReceipt = async (channel) => {
    if (!activeReceipt) {
      toast.error("No active receipt found.");
      return;
    }
    if (sendingReceipt) return;

    const email = (receiptEmail || '').trim();
    const phone = (receiptPhone || '').trim();

    if (channel === 'email' && !email) {
      toast.error("Please enter a customer email address.");
      return;
    }
    if (channel === 'sms' && !phone) {
      toast.error("Please enter a customer phone number.");
      return;
    }
    if (channel === 'both' && !email && !phone) {
      toast.error("Please enter an email address or phone number.");
      return;
    }
    
    setSendingReceipt(channel);
    try {
      const res = await fetch('/api/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: (channel === 'email' || channel === 'both') ? email : null,
          customerPhone: (channel === 'sms' || channel === 'both') ? phone : null,
          receipt: {
            id: activeReceipt.id || activeReceipt.sale_id,
            sale_id: activeReceipt.id || activeReceipt.sale_id,
            items: activeReceipt.items || activeReceipt.cartItems || [],
            cartItems: activeReceipt.items || activeReceipt.cartItems || [],
            subtotal: activeReceipt.subtotal,
            tax: activeReceipt.tax,
            total: activeReceipt.total,
            discount: activeReceipt.discount || 0,
            sale_date: activeReceipt.sale_date,
            customer_name: activeReceipt.customer_name,
            payment_method: activeReceipt.payment_method
          },
          channel
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = { success: false, error: `Server response error (${res.status})` };
      }

      if (data.success) {
        toast.success(data.message || `Receipt sent successfully via ${channel === 'both' ? 'Email & SMS' : channel === 'email' ? 'Email' : 'SMS'}!`);
      } else {
        toast.error(data.error || 'Failed to send receipt.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to send receipt due to network error.');
    } finally {
      setSendingReceipt(null);
    }
  };

  // Sync orderType if wholesale customer is selected
  useEffect(() => {
    if (isWholesale) {
      setOrderType('Wholesale');
    } else if (orderType === 'Wholesale') {
      setOrderType('Walk-in');
    }
  }, [isWholesale]);

  // Cart operations
  const addToCart = (product) => {
    if (product.stockLevel <= 0) {
      toast.error("Product is out of stock.");
      return;
    }

    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stockLevel) {
        toast.error("Cannot add more than active stock levels.");
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      const price = product.sellingPrice;
      setCart([...cart, { ...product, quantity: 1, price }]);
    }
  };

  const addPackageToCart = (pkg) => {
    // Check component stocks
    for (const comp of pkg.items || []) {
      const prod = products.find(p => p.id === comp.product_id);
      const currentInCartForProd = cart.reduce((total, item) => {
        if (item.isPackage) {
          const matchingComp = (item.items || []).find(c => c.product_id === comp.product_id);
          return total + (matchingComp ? (parseInt(matchingComp.quantity) || 1) * item.quantity : 0);
        } else if (item.id === comp.product_id) {
          return total + item.quantity;
        }
        return total;
      }, 0);

      const needed = currentInCartForProd + (parseInt(comp.quantity) || 1);
      const stock = prod ? (prod.stockLevel || 0) : 0;
      if (needed > stock) {
        toast.error(`Insufficient stock of ${comp.product_name} to add this package.`);
        return;
      }
    }

    const pkgCartId = `package-${pkg.id}`;
    const existing = cart.find(item => item.id === pkgCartId);

    if (existing) {
      setCart(cart.map(item => item.id === pkgCartId ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([
        ...cart,
        {
          id: pkgCartId,
          packageId: pkg.id,
          isPackage: true,
          name: pkg.name,
          badge: pkg.badge || null,
          items: pkg.items || [],
          price: parseFloat(pkg.package_price) || 0,
          regular_price: parseFloat(pkg.regular_total) || 0,
          quantity: 1
        }
      ]);
    }
    toast.success(`Added ${pkg.name} package to order!`);
  };

  const updateCartQty = (itemId, amount) => {
    const existing = cart.find(item => item.id === itemId);
    if (!existing) return;

    const targetQty = existing.quantity + amount;
    if (targetQty <= 0) {
      setCart(cart.filter(item => item.id !== itemId));
      return;
    }

    if (existing.isPackage) {
      for (const comp of existing.items || []) {
        const prod = products.find(p => p.id === comp.product_id);
        const availStock = prod ? prod.stockLevel : 999;
        if (targetQty * (parseInt(comp.quantity) || 1) > availStock) {
          toast.error(`Not enough stock of ${comp.product_name} for this package.`);
          return;
        }
      }
      setCart(cart.map(item => item.id === itemId ? { ...item, quantity: targetQty } : item));
      return;
    }

    const product = products.find(p => p.id === itemId);
    if (!product) return;

    if (targetQty > product.stockLevel) {
      toast.error("Cannot exceed active stock levels.");
      return;
    }

    setCart(cart.map(item => item.id === itemId ? { ...item, quantity: targetQty } : item));
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (filteredProducts.length === 1) {
        const prod = filteredProducts[0];
        if (prod.stockLevel > 0) {
          addToCart(prod);
          setSearchQuery('');
          toast.success(`Added ${prod.name} to order`);
        } else {
          toast.error(`${prod.name} is out of stock`);
        }
      }
    }
  };

  // Math Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  let activeDiscountPercent = discountPercent;
  if (isWholesale) {
    activeDiscountPercent = Math.max(15, activeDiscountPercent); // 15% flat for wholesale
  }
  if (selectedExhibitionId !== 'none') {
    activeDiscountPercent = Math.max(selectedExhibition.discount_percent || 0, activeDiscountPercent);
  }

  const discountAmountFromPercent = subtotal * (activeDiscountPercent / 100);
  
  let discountAmountFromPromo = 0;
  if (activePromo) {
    if (activePromo.type === 'percentage') {
      discountAmountFromPromo = subtotal * (activePromo.value / 100);
    } else {
      discountAmountFromPromo = activePromo.value;
    }
  }

  const discountAmount = discountAmountFromPercent + discountAmountFromPromo;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxAmount;

  // Process checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Add items to your cart first.");
      return;
    }

    const isConfirmed = await showConfirm({
      title: 'Confirm Order',
      message: `Complete ${orderType} order for ${selectedCustomer.name}?`,
      confirmText: 'Place Order',
    });

    if (!isConfirmed) return;

    setIsProcessing(true);

    try {
      const saleId = `sale-${Date.now().toString(36).toUpperCase()}`;
      const paymentId = `pay-${Date.now().toString(36)}`;
      const saleDate = new Date().toISOString();

      const salePayload = {
        id: saleId,
        sale_id: saleId,
        customer_id: selectedCustomerId,
        customer_name: selectedCustomer.name,
        user_id: user?.uid || 'anonymous',
        user_name: user?.full_name || 'Cashier',
        exhibition_id: selectedExhibitionId !== 'none' ? selectedExhibitionId : null,
        exhibition_name: selectedExhibitionId !== 'none' ? selectedExhibition.name : null,
        order_type: orderType,
        sale_date: saleDate,
        cartItems: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          isPackage: !!item.isPackage,
          packageId: item.packageId || null,
          packageItems: item.items || null,
          savings: item.isPackage ? ((item.regular_price - item.price) * item.quantity) : 0
        })),
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        payment_status: 'paid',
        payment_method: paymentMethod,
        promo_code: activePromo ? activePromo.code : null,
        createdAt: saleDate
      };

      if (isMock || sandbox) {
        setProducts(prev =>
          prev.map(p => {
            let deducted = 0;
            for (const item of cart) {
              if (item.isPackage && Array.isArray(item.items)) {
                const comp = item.items.find(c => c.product_id === p.id);
                if (comp) deducted += (parseInt(comp.quantity) || 1) * item.quantity;
              } else if (item.id === p.id) {
                deducted += item.quantity;
              }
            }
            return deducted > 0 ? { ...p, stockLevel: Math.max(0, p.stockLevel - deducted) } : p;
          })
        );
        
        setReceiptEmail(selectedCustomer.email || '');
        setReceiptPhone(selectedCustomer.phone || selectedCustomer.phoneNumber || '');
        setActiveReceipt(salePayload);
        setCart([]);
        setDiscountPercent(0);
        setPromoCode('');
        setActivePromo(null);
        setSelectedExhibitionId('none');
        toast.success("Order Placed Successfully!");
        triggerNewOrderNotification(salePayload);
        return;
      }

      let lowStockAlerts = [];
      let isOfflineCheckout = false;
      const isOnline = typeof window !== 'undefined' && navigator.onLine;

      if (isOnline) {
        lowStockAlerts = await runTransaction(db, async (transaction) => {
          // Aggregate total quantities needed per product_id across standard products and package bundles
          const requiredStockMap = {}; // { [productId]: { quantity, name } }
          for (const cartItem of cart) {
            if (cartItem.isPackage && Array.isArray(cartItem.items)) {
              for (const comp of cartItem.items) {
                const pid = comp.product_id;
                const qty = (parseInt(comp.quantity) || 1) * cartItem.quantity;
                if (!requiredStockMap[pid]) {
                  requiredStockMap[pid] = { quantity: 0, name: comp.product_name };
                }
                requiredStockMap[pid].quantity += qty;
              }
            } else {
              const pid = cartItem.id;
              if (!requiredStockMap[pid]) {
                requiredStockMap[pid] = { quantity: 0, name: cartItem.name };
              }
              requiredStockMap[pid].quantity += cartItem.quantity;
            }
          }

          const productData = [];
          for (const [productId, req] of Object.entries(requiredStockMap)) {
            const productRef = doc(db, 'products', productId);
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) {
              throw new Error(`Product ${req.name || productId} does not exist!`);
            }
            const currentTotalStock = productSnap.data().stockLevel || 0;
            if (currentTotalStock < req.quantity) {
              throw new Error(`Insufficient stock for ${req.name}! Available: ${currentTotalStock}, Needed: ${req.quantity}`);
            }
            const reorderLevel = productSnap.data().reorderLevel || 10;
            productData.push({ ref: productRef, stock: currentTotalStock, reorderLevel, req });
          }

          const alerts = [];

          let exRef = null;
          let currentSalesTotal = 0;
          if (selectedExhibitionId !== 'none') {
            exRef = doc(db, 'exhibitions', selectedExhibitionId);
            const exSnap = await transaction.get(exRef);
            if (exSnap.exists()) {
              currentSalesTotal = exSnap.data().sales_total || 0;
            } else {
              exRef = null;
            }
          }

          for (const data of productData) {
            const newStock = Math.max(0, data.stock - data.req.quantity);
            transaction.update(data.ref, {
              stockLevel: newStock
            });
            
            if (data.stock > data.reorderLevel && newStock <= data.reorderLevel) {
              alerts.push({
                productId: data.ref.id,
                productName: data.req.name,
                stockLevel: newStock,
                reorderLevel: data.reorderLevel
              });
            }
          }

          const saleRef = doc(db, 'sales', saleId);
          transaction.set(saleRef, salePayload);

          const paymentRef = doc(db, 'payments', paymentId);
          transaction.set(paymentRef, {
            sale_id: saleId,
            amount: total,
            method: paymentMethod,
            reference: `POS Order ${saleId}`,
            paid_at: saleDate
          });

          if (exRef) {
            transaction.update(exRef, { sales_total: currentSalesTotal + total });
          }

          if (activePromo) {
            const promoRef = doc(db, 'promos', activePromo.id);
            const promoSnap = await transaction.get(promoRef);
            if (promoSnap.exists()) {
              const currentUses = promoSnap.data().usesCount || 0;
              transaction.update(promoRef, { usesCount: currentUses + 1 });
            }
          }

          return alerts;
        });
      } else {
        // Explicit Offline Mode Checkout: Save to local offline queue & update local stock state instantly
        console.warn("Device is offline. Queuing sale in offlineStore local storage queue.");
        isOfflineCheckout = true;

        const customerPhone = selectedCustomer.phone || selectedCustomer.phoneNumber || '';
        
        addOfflineSale({
          ...salePayload,
          customer_phone: customerPhone
        });

        // Immediately decrement local product stock in POS component state so cashier cannot oversell
        setProducts(prevProducts => 
          prevProducts.map(p => {
            const cartItem = cart.find(ci => ci.id === p.id);
            return cartItem ? { ...p, stockLevel: Math.max(0, (p.stockLevel || 0) - cartItem.quantity) } : p;
          })
        );

        setPendingOfflineCount(getOfflineSalesQueue().length);
      }

      // Process stock alerts
      for (const alert of lowStockAlerts) {
        try {
          await addDoc(collection(db, 'notifications'), {
            title: 'Low Stock Alert',
            message: `${alert.productName} has dropped to ${alert.stockLevel} units.`,
            time: new Date().toISOString(),
            unread: true,
            link: '/inventory'
          });
          
          if (!isOfflineCheckout) {
            await fetch('/api/stock-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alert)
            });
          }
        } catch (e) {
          console.error("Failed to process low stock alert:", e);
        }
      }

      setReceiptEmail(selectedCustomer.email || '');
      setReceiptPhone(selectedCustomer.phone || selectedCustomer.phoneNumber || '');
      setActiveReceipt(salePayload);
      setCart([]);
      setDiscountPercent(0);
      setPromoCode('');
      setActivePromo(null);
      setSelectedExhibitionId('none');
      // Trigger real-time Admin notification for POS sale
      if (!isOfflineCheckout && db) {
        try {
          await addDoc(collection(db, 'notifications'), {
            title: selectedExhibitionId !== 'none' ? '🎪 New Booth Sale Completed' : '🛍️ New POS Sale Completed',
            message: `Sale #${saleId} (₵${total.toFixed(2)}) processed by ${user?.full_name || 'Cashier'} for ${selectedCustomer.name}${selectedExhibitionId !== 'none' ? ` at ${selectedExhibition.name}` : ''}`,
            time: new Date().toISOString(),
            unread: true,
            link: '/reports'
          });
        } catch (notifErr) {
          console.warn('[POS] Sale notification warning:', notifErr);
        }

        await logAction({
          module: 'POS',
          action: 'COMPLETE_SALE',
          details: `POS Sale #${saleId} (₵${total.toFixed(2)}) processed for ${selectedCustomer.name || 'Walk-in'} via ${paymentMethod}${selectedExhibitionId !== 'none' ? ` at ${selectedExhibition?.name}` : ''}`,
          targetId: saleId,
          severity: 'success',
          userEmail: user?.email,
          userName: user?.full_name || 'Cashier',
          metadata: {
            saleId,
            total,
            paymentMethod,
            customerName: selectedCustomer.name,
            itemsCount: cart.length
          }
        });
      }

      toast.success(isOfflineCheckout ? "Saved offline (will sync when online!)" : "Order Placed Successfully!");
      triggerNewOrderNotification(salePayload);
    } catch (err) {
      if (err.message && (err.message.includes('permission') || err.code === 'permission-denied')) {
        console.warn("[POS] Permission restricted. Saving order to local offline queue.", err.message);
        addOfflineSale({
          ...salePayload,
          customer_phone: selectedCustomer.phone || selectedCustomer.phoneNumber || ''
        });
        setProducts(prev =>
          prev.map(p => {
            const cartItem = cart.find(item => item.id === p.id);
            return cartItem ? { ...p, stockLevel: Math.max(0, (p.stockLevel || 0) - cartItem.quantity) } : p;
          })
        );
        setPendingOfflineCount(getOfflineSalesQueue().length);
        setReceiptEmail(selectedCustomer.email || '');
        setReceiptPhone(selectedCustomer.phone || selectedCustomer.phoneNumber || '');
        setActiveReceipt(salePayload);
        setCart([]);
        setDiscountPercent(0);
        setPromoCode('');
        setActivePromo(null);
        setSelectedExhibitionId('none');
        toast.success("Order Saved (Offline Queue)");
      } else {
        console.error("POS transaction failed:", err);
        toast.error(`Checkout failed: ${err.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (p.isActive === false || p.deleted === true || p.isDeleted === true) return false;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const prodCategory = (!p.category || p.category.toLowerCase() === 'uncategorized') ? 'Others' : p.category;
    const matchesCategory = activeCategory === 'All' || searchQuery !== '' || prodCategory === activeCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    const aIsMulti = a.name.toLowerCase().includes('multifloral') || (a.category && a.category.toLowerCase().includes('multifloral'));
    const bIsMulti = b.name.toLowerCase().includes('multifloral') || (b.category && b.category.toLowerCase().includes('multifloral'));
    if (aIsMulti && !bIsMulti) return -1;
    if (!aIsMulti && bIsMulti) return 1;
    return 0;
  });

  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const lowStockCount = products.filter(p => (p.stockLevel || 0) <= (p.reorderLevel || 10)).length;

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'All': return LayoutGrid;
      case 'Multifloral (raw honey)': return Droplet;
      case 'Monofloral raw honey': return Star;
      case 'Raw Honey': return Droplet;
      case 'Comb Honey': return Hexagon;
      case 'Infused/Creamed Honey': return Beaker;
      case 'Beeswax & Wax Products': return Flame;
      case 'Propolis': return Droplet;
      case 'Royal Jelly': return Sun;
      case 'Specialty Honey': return Star;
      default: return PackageIcon;
    }
  };

  return (
    <AuthShield requiredPermission="sale.create">
      <div className="flex flex-col lg:flex-row h-full lg:overflow-hidden bg-[#f9fafb]">
        
        {/* Left Side: Main POS Area (70%) */}
        <div className="flex-1 min-w-0 flex flex-col h-full border-r border-gray-200">
          
          {/* Top Bar: Search & Categories Inline + Network Status */}
          <div className="px-6 py-3.5 bg-white border-b border-gray-200 flex flex-col gap-3 shadow-sm z-10">
            
            {/* Pending Offline Sales Sync Banner */}
            {pendingOfflineCount > 0 && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-xs text-amber-900 font-medium">
                <div className="flex items-center gap-2">
                  <CloudOff className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />
                  <span>
                    <strong>{pendingOfflineCount} Offline Sale{pendingOfflineCount > 1 ? 's' : ''}</strong> queued locally.
                    {!isOnline && " Will auto-sync when network connection restores."}
                  </span>
                </div>
                {isOnline && (
                  <button
                    onClick={triggerAutoSync}
                    disabled={isSyncingOffline}
                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? 'animate-spin' : ''}`} />
                    {isSyncingOffline ? 'Syncing...' : 'Sync Now'}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Search Bar (Left) */}
              <div className="relative w-full md:w-72 flex-shrink-0">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products (press Enter to auto-add)..."
                  className="w-full bg-gray-55 border border-gray-200 focus:bg-white focus:border-[#ffa200] focus:ring-2 focus:ring-[#ffa200]/20 pl-10 pr-4 py-2.5 rounded-full text-xs text-gray-900 placeholder-gray-400 transition-all shadow-sm font-semibold"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>

              {/* Categories List (Right) */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar items-center w-full pb-2 md:pb-0 justify-start flex-1 min-w-0">
              {/* Event & Promo Packages Tab (when exhibition or promo packages are active) */}
              {availablePackages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory('Packages');
                    setSearchQuery('');
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all flex-shrink-0 text-xs font-bold border cursor-pointer ${
                    activeCategory === 'Packages' 
                      ? 'bg-[#ffa200] text-black border-[#ffa200] shadow-sm' 
                      : 'bg-amber-500/15 text-amber-900 border-amber-500/40 hover:bg-[#ffa200]/20'
                  }`}
                >
                  <Gift className={`w-3.5 h-3.5 ${activeCategory === 'Packages' ? 'text-black' : 'text-[#d07b00]'}`} />
                  <span>Packages</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeCategory === 'Packages' ? 'bg-black/15 text-black' : 'bg-[#ffa200] text-black'}`}>
                    {availablePackages.length}
                  </span>
                </button>
              )}

              {categories.map(cat => {
                const isActive = activeCategory === cat;
                const Icon = getCategoryIcon(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setSearchQuery(''); // Clear search when clicking category
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all flex-shrink-0 text-xs font-bold border ${
                      isActive 
                        ? 'bg-[#ffa200] text-black border-[#ffa200] shadow-sm' 
                        : 'bg-gray-55 text-gray-700 border-gray-200 hover:bg-[#ffa200]/10 hover:text-[#D07B00] hover:border-[#ffa200]/40'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-gray-400'}`} />
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-black/15 text-black' : 'bg-gray-200/60 text-gray-500'}`}>
                      {cat === 'All' ? products.length : products.filter(p => p.category === cat).length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

          {/* Product Grid Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-32 md:pb-8 bg-[#f9fafb]">
            
            {/* Stats Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
              
              {/* Active Channel Card */}
              <div className="bg-white border border-[#d07b00]/10 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:border-[#d07b00]/25 transition-all duration-300">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block truncate">Active Channel</span>
                  <p className="text-sm sm:text-base font-bold text-gray-900 truncate">{selectedExhibition.name === 'None' ? 'Standard In-Shop' : selectedExhibition.name}</p>
                  <p className="text-[10px] text-[#ffa200] font-semibold">Discount: {selectedExhibition.discount_percent}%</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#ffa200]/10 flex items-center justify-center text-[#d07b00] flex-shrink-0 ml-2 hidden sm:flex">
                  <LayoutGrid className="w-5 h-5" />
                </div>
              </div>

              {/* Cart Value Card */}
              <div className="bg-white border border-[#d07b00]/10 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:border-[#d07b00]/25 transition-all duration-300">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block truncate">Cart Subtotal</span>
                  <p className="text-sm sm:text-base font-bold text-gray-900 truncate">₵{cartSubtotal.toFixed(2)}</p>
                  <p className="text-[10px] text-[#d07b00] font-semibold">{cart.reduce((s, i) => s + i.quantity, 0)} items selected</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#ffa200]/10 flex items-center justify-center text-[#d07b00] flex-shrink-0 ml-2 hidden sm:flex">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>

              {/* Register Status Card */}
              <div className="bg-white border border-[#d07b00]/10 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:border-[#d07b00]/25 transition-all duration-300">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block truncate">Register Mode</span>
                  <p className="text-sm sm:text-base font-bold text-gray-900 truncate">{isOnline ? 'Online Sync' : 'Offline local'}</p>
                  <p className={`text-[10px] font-semibold ${isOnline ? 'text-[#d07b00]' : 'text-amber-500 animate-pulse'}`}>
                    {isOnline ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-2 hidden sm:flex ${isOnline ? 'bg-[#ffa200]/10 text-[#d07b00]' : 'bg-amber-500/10 text-amber-500'}`}>
                  {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                </div>
              </div>

              {/* Low Stock Alerts Card */}
              <div className="bg-white border border-[#d07b00]/10 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:border-[#d07b00]/25 transition-all duration-300">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block truncate">Reorder Items</span>
                  <p className="text-sm sm:text-base font-bold text-gray-900 truncate">{lowStockCount} Products</p>
                  <p className={`text-[10px] font-semibold ${lowStockCount > 0 ? 'text-amber-500 animate-pulse' : 'text-gray-500'}`}>
                    {lowStockCount > 0 ? 'Restock required' : 'Stock level safe'}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-2 hidden sm:flex ${lowStockCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-[#ffa200]/10 text-[#d07b00]'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

            </div>

            {/* If Packages category is active, render the packages grid */}
            {activeCategory === 'Packages' ? (
              <div className="space-y-4">
                {/* Package Spotlight Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-gray-950 via-gray-900 to-black text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#ffa200]/30 shadow-lg relative overflow-hidden">
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#ffa200]/10 to-transparent pointer-events-none" />
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#ffa200] to-[#d07b00] flex items-center justify-center text-black font-black shadow-md flex-shrink-0">
                      <Gift className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-white tracking-tight">Curated Packages & Bundles</h2>
                        <span className="px-2 py-0.5 rounded-full bg-[#ffa200]/20 border border-[#ffa200]/40 text-[#ffa200] text-[10px] font-black uppercase">
                          {availablePackages.length} Available
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Multi-product combos with automatic inventory deduction and bundle savings
                      </p>
                    </div>
                  </div>
                  {selectedExhibitionId !== 'none' && (
                    <div className="relative z-10 self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white/10 border border-[#ffa200]/40 text-xs font-bold text-[#ffa200] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Event: {selectedExhibition.name}</span>
                    </div>
                  )}
                </div>

                {availablePackages.length === 0 ? (
                  <div className="py-16 px-4 text-center bg-white rounded-3xl border border-dashed border-amber-200">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d07b00] mx-auto mb-3">
                      <Gift className="w-7 h-7" />
                    </div>
                    <h3 className="font-extrabold text-gray-900 text-base mb-1">No Active Packages Found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Create combo bundles on the <span className="font-bold text-[#d07b00]">Promos</span> or <span className="font-bold text-[#d07b00]">Exhibitions</span> page to sell bundled products here at the counter.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                    {availablePackages.map(pkg => {
                      const pkgCartId = `package-${pkg.id}`;
                      const cartItem = cart.find(item => item.id === pkgCartId);
                      const qtyInCart = cartItem?.quantity || 0;

                      // Resolve component products with images and stock
                      const components = (pkg.items || []).map(comp => {
                        const prod = products.find(p => p.id === comp.product_id);
                        return {
                          ...comp,
                          image: prod?.image || PLACEHOLDER_IMAGE,
                          stockLevel: prod ? (prod.stockLevel || 0) : 0,
                          spec: prod?.spec || '',
                        };
                      });

                      // Check component stock feasibility
                      let minAvail = 999;
                      for (const comp of components) {
                        const possible = Math.floor((comp.stockLevel || 0) / (parseInt(comp.quantity) || 1));
                        if (possible < minAvail) minAvail = possible;
                      }
                      const isOutOfStock = minAvail <= 0;
                      const isLowStock = minAvail > 0 && minAvail <= 5;

                      const regularTotal = Number(pkg.regular_total || 0);
                      const packagePrice = Number(pkg.package_price || 0);
                      const savings = Math.max(0, regularTotal - packagePrice);
                      const discountPercent = regularTotal > 0 && savings > 0 ? Math.round((savings / regularTotal) * 100) : 0;

                      return (
                        <div
                          key={pkg.id}
                          className={`group bg-white rounded-3xl sm:rounded-[32px] border border-amber-200/80 hover:border-[#ffa200] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 relative overflow-hidden ${
                            isOutOfStock ? 'opacity-60 grayscale' : ''
                          }`}
                        >
                          {/* Top Ambient Glow */}
                          <div className="absolute -top-16 -right-16 w-32 h-32 bg-[#ffa200]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#ffa200]/20 transition-all" />

                          {/* Top Badges Row */}
                          <div className="w-full flex items-center justify-between gap-1.5 mb-3 relative z-10">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1.5 bg-black text-[#ffa200] text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs">
                                <Gift className="w-3 h-3 text-[#ffa200]" />
                                {pkg.isExhibition ? 'Event Special' : 'Combo Pack'}
                              </span>
                              {pkg.badge && (
                                <span className="inline-flex items-center bg-[#ffa200] text-black text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs">
                                  {pkg.badge}
                                </span>
                              )}
                            </div>
                            {discountPercent > 0 && (
                              <span className="inline-flex items-center gap-1 bg-[#d07b00] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs">
                                <Sparkles className="w-3 h-3" /> -{discountPercent}%
                              </span>
                            )}
                          </div>

                          {/* Product Images Visual Montage */}
                          <div className="w-full bg-gradient-to-br from-amber-50/70 via-white to-amber-50/50 rounded-2xl p-3 mb-3 border border-amber-100 flex items-center justify-center min-h-[96px] relative overflow-hidden">
                            <div className="flex items-center justify-center gap-2 relative z-10">
                              {components.slice(0, 3).map((comp, idx) => (
                                <React.Fragment key={idx}>
                                  {idx > 0 && (
                                    <div className="w-5 h-5 rounded-full bg-[#ffa200] text-black font-black flex items-center justify-center text-[11px] shadow-xs flex-shrink-0">
                                      +
                                    </div>
                                  )}
                                  <div className="relative group/thumb">
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-amber-200/80 shadow-xs overflow-hidden flex items-center justify-center p-1">
                                      <img
                                        src={comp.image || PLACEHOLDER_IMAGE}
                                        alt={comp.product_name}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                    <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-black text-[#ffa200] text-[9px] font-black shadow-xs">
                                      {comp.quantity}x
                                    </span>
                                  </div>
                                </React.Fragment>
                              ))}
                              {components.length > 3 && (
                                <div className="w-10 h-10 rounded-2xl bg-amber-100/80 border border-amber-300 flex items-center justify-center text-xs font-black text-amber-900">
                                  +{components.length - 3}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Package Title & Savings Callout */}
                          <div className="text-left w-full mb-3">
                            <h3 className="font-extrabold text-gray-900 text-base sm:text-lg leading-tight group-hover:text-[#d07b00] transition-colors">
                              {pkg.name}
                            </h3>
                            {savings > 0 ? (
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#d07b00] mt-1">
                                <Sparkles className="w-3 h-3 text-[#ffa200]" />
                                <span>Save ₵{savings.toFixed(2)} vs individual price</span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400 mt-1 font-medium">Curated honey package</p>
                            )}
                          </div>

                          {/* Included Items Breakdown (Sleek List) */}
                          <div className="w-full bg-gray-50/70 border border-gray-100 rounded-2xl p-2.5 mb-3 text-left space-y-1.5 flex-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                              <span>Included in pack</span>
                              <span>Qty & Val</span>
                            </div>
                            <div className="space-y-1">
                              {components.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs bg-white rounded-xl px-2.5 py-1.5 border border-gray-100 shadow-2xs"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                                    <span className="w-5 h-5 rounded-md bg-[#ffa200]/20 text-amber-950 font-black text-[10px] flex items-center justify-center flex-shrink-0">
                                      {it.quantity}x
                                    </span>
                                    <span className="text-gray-800 font-semibold text-xs truncate">
                                      {it.product_name}
                                    </span>
                                  </div>
                                  <span className="text-gray-400 font-mono text-[11px] flex-shrink-0">
                                    ₵{((it.unit_price || 0) * (it.quantity || 1)).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Stock Feasibility Indicator */}
                          <div className="w-full mb-3">
                            {isOutOfStock ? (
                              <div className="w-full py-1 px-2 rounded-xl bg-gray-100 text-gray-500 text-[11px] font-bold flex items-center justify-center gap-1">
                                <X className="w-3.5 h-3.5 text-red-500" /> Component Out of Stock
                              </div>
                            ) : isLowStock ? (
                              <div className="w-full py-1 px-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold flex items-center justify-center gap-1 animate-pulse">
                                <Flame className="w-3.5 h-3.5 text-[#ffa200]" /> Only {minAvail} bundles can be assembled!
                              </div>
                            ) : (
                              <div className="w-full py-1 px-2 rounded-xl bg-amber-50/50 border border-amber-100 text-gray-600 text-[11px] font-semibold flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#d07b00]" /> {minAvail} bundles available in stock
                              </div>
                            )}
                          </div>

                          {/* Pricing Bar */}
                          <div className="w-full flex items-baseline justify-between mb-3 px-1">
                            <div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Bundle Price</span>
                              <div className="flex items-baseline gap-2">
                                <span className="font-black text-2xl sm:text-3xl text-gray-900 tracking-tight">
                                  <span className="text-sm font-bold text-[#d07b00] mr-0.5">₵</span>{packagePrice.toFixed(2)}
                                </span>
                                {regularTotal > packagePrice && (
                                  <span className="line-through text-gray-400 text-xs font-semibold">
                                    ₵{regularTotal.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {savings > 0 && (
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Savings</span>
                                <span className="text-xs font-black text-[#d07b00]">
                                  Save ₵{savings.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Button / Quantity Stepper */}
                          <div className="h-11 sm:h-12 w-full mt-auto">
                            {qtyInCart > 0 ? (
                              <div className="h-full flex items-center justify-between bg-black text-[#ffa200] rounded-xl px-2 border border-[#ffa200]/30 shadow-md">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(pkgCartId, -1)}
                                  className="w-8 h-8 rounded-lg bg-[#ffa200] hover:bg-[#d07b00] text-black flex items-center justify-center shadow-xs transition cursor-pointer active:scale-95"
                                  title="Decrease quantity"
                                >
                                  <Minus className="w-4 h-4 stroke-[3]" />
                                </button>
                                <div className="text-center">
                                  <span className="font-black text-[#ffa200] text-xs sm:text-sm block leading-none">
                                    {qtyInCart} in Order
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    ₵{(packagePrice * qtyInCart).toFixed(2)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(pkgCartId, 1)}
                                  disabled={qtyInCart >= minAvail}
                                  className="w-8 h-8 rounded-lg bg-[#ffa200] hover:bg-[#d07b00] disabled:opacity-40 disabled:cursor-not-allowed text-black flex items-center justify-center shadow-xs transition cursor-pointer active:scale-95"
                                  title="Increase quantity"
                                >
                                  <Plus className="w-4 h-4 stroke-[3]" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isOutOfStock}
                                onClick={() => addPackageToCart(pkg)}
                                className="w-full h-full bg-gradient-to-r from-[#ffa200] to-[#e69100] hover:from-[#e69100] hover:to-[#d07b00] active:scale-[0.98] text-black font-black rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-[#ffa200]/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Gift className="w-4 h-4 stroke-[2.5]" />
                                <span>{isOutOfStock ? 'Component Out of Stock' : 'Add Package to Order'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {filteredProducts.map(p => {
                const isOut = p.stockLevel <= 0;
                const cartItem = cart.find(item => item.id === p.id);
                const qtyInCart = cartItem?.quantity || 0;

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-3 sm:p-5 flex flex-col justify-between items-center text-center transition-all duration-300 hover:shadow-xl ${
                      isOut ? 'opacity-50 grayscale' : ''
                    }`}
                  >
                    {/* Product Image */}
                    <div className="w-full h-24 sm:h-40 rounded-xl sm:rounded-[20px] overflow-hidden mb-2 sm:mb-5 relative bg-white border border-gray-100 flex items-center justify-center p-1 sm:p-2">
                      <img 
                        src={p.image || PLACEHOLDER_IMAGE} 
                        alt={p.name} 
                        className="h-full object-contain mix-blend-multiply"
                      />
                    </div>

                    {/* Details */}
                    <div className="space-y-1 mb-2 flex-1 w-full">
                      <h3 className="font-bold text-gray-900 text-xs sm:text-base leading-tight line-clamp-2">{p.name}</h3>
                      <p className="text-[10px] sm:text-sm text-gray-400 line-clamp-1">{p.spec}</p>
                    </div>

                    <div className="flex items-center justify-center mb-2 w-full">
                      <span className="font-bold text-gray-900 text-sm sm:text-xl">₵{(p.sellingPrice || 0).toFixed(2)}</span>
                    </div>

                    {/* Button Container */}
                    <div className="h-9 sm:h-12 w-full mt-auto">
                      {qtyInCart > 0 ? (
                        <div className="h-full flex items-center justify-between bg-[#ffa200]/10 rounded-xl px-1.5 sm:px-2 border border-[#ffa200]/20">
                          <button 
                            onClick={() => updateCartQty(p.id, -1)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#ffa200] hover:bg-[#D07B00] text-black flex items-center justify-center shadow-sm transition"
                          >
                            <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <span className="font-bold text-[#D07B00] text-xs sm:text-sm">{qtyInCart}</span>
                          <button 
                            onClick={() => updateCartQty(p.id, 1)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#ffa200] hover:bg-[#D07B00] text-black flex items-center justify-center shadow-sm transition"
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={isOut}
                          onClick={() => addToCart(p)}
                          className="w-full h-full bg-[#ffa200]/10 hover:bg-[#ffa200]/20 text-[#D07B00] font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isOut ? 'Out of Stock' : 'Add to Order'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* Mobile Floating Cart Summary Bar */}
        {cart.length > 0 && (
          <div className="fixed bottom-16 left-3 right-3 z-30 lg:hidden animate-in slide-in-from-bottom duration-300">
            <button
              onClick={() => setShowMobileCart(true)}
              className="w-full bg-black text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 active:scale-98 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#ffa200] text-black flex items-center justify-center font-bold text-sm">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-white/60 font-medium leading-none">Cart Total</p>
                  <p className="text-base font-black text-white mt-1">₵{total.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#ffa200] bg-white/10 px-3 py-2 rounded-xl">
                <span>Review Order</span>
                <ShoppingCart className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

        {/* Mobile Backdrop Overlay */}
        {showMobileCart && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs" 
            onClick={() => setShowMobileCart(false)} 
          />
        )}

        {/* Right Side: Cart Sidebar (30% desktop column, mobile slide-up bottom sheet drawer) */}
        <div className={`fixed lg:relative inset-x-0 bottom-0 top-12 lg:top-0 w-full lg:w-[400px] bg-white flex flex-col h-[calc(100%-48px)] lg:h-full shadow-2xl z-50 lg:z-20 flex-shrink-0 border-t lg:border-t-0 rounded-t-[32px] lg:rounded-t-none transition-transform duration-300 ${
          showMobileCart ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'
        }`}>
          
          {/* Mobile Drawer Header Bar */}
          <div className="lg:hidden flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50 rounded-t-[32px]">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Review Order & Pay</span>
            <button 
              onClick={() => setShowMobileCart(false)}
              className="p-1.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Customer & Order Type Header */}
          <div className="p-6 border-b border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 font-display">{selectedCustomer.name}</h2>
                  <button 
                    onClick={() => setShowCustomerSelect(!showCustomerSelect)}
                    className="p-1.5 text-gray-400 hover:text-[#ffa200] hover:bg-[#ffa200]/10 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400">{selectedCustomer.customer_type} • Customer</p>
              </div>
            </div>

            {showCustomerSelect && (
              <div className="animate-in fade-in slide-in-from-top-2 p-3.5 bg-amber-50/50 border border-[#d07b00]/20 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-[#d07b00]" /> Search Customer Database
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPosCustomer(true);
                      setNewPosCustomerName(posCustomerSearch);
                    }}
                    className="text-[11px] text-[#d07b00] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add New Customer
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, phone, email, or customer type..."
                    value={posCustomerSearch}
                    onChange={(e) => setPosCustomerSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] outline-none font-medium"
                    autoFocus
                  />
                  {posCustomerSearch && (
                    <button
                      type="button"
                      onClick={() => setPosCustomerSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Customer Search Matches */}
                <div className="bg-white border border-gray-200 rounded-xl max-h-52 overflow-y-auto divide-y divide-gray-100 shadow-xs">
                  {filteredPosCustomers.length === 0 ? (
                    <div className="p-4 text-center space-y-2">
                      <p className="text-xs text-gray-500 font-medium">No customer matching "{posCustomerSearch}"</p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddPosCustomer(true);
                          setNewPosCustomerName(posCustomerSearch);
                        }}
                        className="px-3 py-1.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Customer "{posCustomerSearch}"
                      </button>
                    </div>
                  ) : (
                    filteredPosCustomers.map(c => {
                      const isSelected = selectedCustomerId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            if (c.customer_type === 'Wholesale') {
                              setDiscountPercent(15);
                            } else {
                              setDiscountPercent(0);
                            }
                            setReceiptEmail(c.email || '');
                            setReceiptPhone(c.phone || c.phoneNumber || '');
                            setShowCustomerSelect(false);
                          }}
                          className={`p-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-amber-100/70 border-l-4 border-[#d07b00]' : 'hover:bg-amber-50/50'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-gray-900">{c.name || c.full_name}</p>
                            <p className="text-[11px] text-gray-500 font-medium">
                              {c.phone || c.phoneNumber || 'No phone'} • {c.email || 'No email'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              c.customer_type === 'Wholesale' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-[#d07b00]'
                            }`}>
                              {c.customer_type || 'Retail'}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-[#d07b00]" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Order Type Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {['Walk-in', 'Take Away', 'Delivery'].map(type => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    orderType === type 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-3.5 group p-2 rounded-xl hover:bg-gray-50/80 transition">
                <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.isPackage ? (
                    <div className="w-full h-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-[#d07b00]">
                      <Gift className="w-6 h-6" />
                    </div>
                  ) : (
                    <img src={item.image || PLACEHOLDER_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex justify-between items-start gap-1 mb-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-gray-900 text-xs sm:text-sm leading-tight truncate">{item.name}</h4>
                        {item.isPackage && (
                          <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase px-1.5 py-0.2 rounded">
                            Bundle
                          </span>
                        )}
                      </div>
                      {item.isPackage && item.items && (
                        <p className="text-[10px] text-gray-500 mt-0.5 leading-tight line-clamp-1">
                          {item.items.map(it => `${it.quantity}x ${it.product_name}`).join(' + ')}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                      ₵{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, -1)}
                        className="w-5 h-5 rounded bg-gray-200 hover:bg-[#ffa200] hover:text-black flex items-center justify-center text-gray-600 transition text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-gray-900 px-1 text-xs">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, 1)}
                        className="w-5 h-5 rounded bg-gray-200 hover:bg-[#ffa200] hover:text-black flex items-center justify-center text-gray-600 transition text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      {item.isPackage && item.regular_price > item.price && (
                        <span className="text-[10px] text-[#d07b00] font-bold font-mono block">
                          Save ₵{((item.regular_price - item.price) * item.quantity).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Remove button appears on hover */}
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="hidden group-hover:flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-500 self-center transition-all hover:bg-red-100 cursor-pointer shrink-0"
                  title="Remove from cart"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                <ShoppingCart className="w-12 h-12 text-gray-200" />
                <p className="text-sm font-medium">No items in order</p>
              </div>
            )}
          </div>

          {/* Order Summary & Checkout */}
          <div className="p-6 bg-white border-t border-gray-100 space-y-5 rounded-t-[32px] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
            
            {/* Promo & Exhibitions */}
            <div className="space-y-3 pb-3 border-b border-gray-100">
              <select
                className="w-full bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-xs text-gray-900 font-medium"
                value={selectedExhibitionId}
                onChange={(e) => setSelectedExhibitionId(e.target.value)}
              >
                {exhibitions.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} {ex.discount_percent > 0 ? `(${ex.discount_percent}% Off)` : ''}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Promo Code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  disabled={!!activePromo}
                  className="flex-1 bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3 py-2 rounded-lg text-xs text-gray-900 uppercase font-mono disabled:opacity-50"
                />
                {activePromo ? (
                  <button
                    onClick={() => { setActivePromo(null); setPromoCode(''); }}
                    className="px-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!promoCode) { toast.error("Enter a code first"); return; }
                      toast.error("Promo code invalid or expired (Mock).");
                    }}
                    className="px-3 bg-[#ffa200]/10 hover:bg-[#ffa200]/20 text-[#ffa200] rounded-lg text-xs font-bold transition"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Sub Total</span>
                <span className="font-bold text-gray-900">₵{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify
              between text-sm">
                <span className="text-gray-500 font-medium">Tax {taxRate}%</span>
                <span className="font-bold text-gray-900">₵{taxAmount.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-[#ffa200]">
                  <span className="font-medium">Discount</span>
                  <span className="font-bold">-₵{discountAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="pt-3 border-t border-dashed border-gray-200 flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total Amount</span>
                <span className="text-2xl font-black text-gray-900">₵{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: 'Cash', icon: DollarSign },
                { name: 'Card', icon: CreditCard },
                { name: 'Momo', icon: Smartphone },
              ].map(method => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.name;
                return (
                  <button
                    key={method.name}
                    onClick={() => setPaymentMethod(method.name)}
                    className={`py-3 rounded-2xl flex flex-col items-center gap-2 transition-all border ${
                      isSelected 
                        ? 'border-[#ffa200] bg-[#ffa200] text-black shadow-md shadow-[#ffa200]/30' 
                        : 'border-gray-200 bg-white text-gray-500 hover:border-[#ffa200]/50 hover:text-[#D07B00]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-bold">{method.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Place Order CTA */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="w-full py-4 bg-[#ffa200] hover:bg-[#D07B00] disabled:bg-gray-200 disabled:text-gray-400 text-black font-bold text-lg rounded-2xl transition-all shadow-[0_8px_20px_-8px_rgba(255,162,0,0.5)] flex items-center justify-center gap-2"
            >
              {isProcessing ? "Processing..." : "Place Order"}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice / Receipt Modal Overlay */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 p-8 rounded-[32px] w-full max-w-sm space-y-6 shadow-2xl relative">
            
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#ffa200] rounded-full flex items-center justify-center shadow-lg border-4 border-white">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>

            <div className="text-center space-y-1.5 pt-4 border-b border-dashed border-gray-200 pb-6">
              <h3 className="font-black text-xl tracking-wide uppercase text-gray-900 font-display">Honey Palace</h3>
              <p className="text-xs text-gray-500 font-medium">Order Receipt</p>
              <p className="text-[10px] text-gray-400 font-mono">{new Date(activeReceipt.sale_date).toLocaleString()}</p>
            </div>

            {/* Items */}
            <div className="space-y-3 border-b border-dashed border-gray-200 pb-6 text-sm font-medium">
              {activeReceipt.cartItems.map(item => (
                <div key={item.id} className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <span className="text-gray-800 leading-tight block">{item.name}</span>
                    <span className="text-gray-400 text-xs">{item.quantity} x ₵{item.price.toFixed(2)}</span>
                  </div>
                  <span className="font-bold text-gray-900 text-right">₵{(item.quantity * item.price).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="space-y-2 text-right text-sm">
              <div className="flex justify-between text-gray-500 font-medium">
                <span>Subtotal</span>
                <span>₵{activeReceipt.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500 font-medium">
                <span>Tax</span>
                <span>₵{activeReceipt.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-lg text-gray-900 pt-2 border-t border-gray-100">
                <span>TOTAL</span>
                <span className="text-[#d07b00]">₵{activeReceipt.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Send Receipt Options */}
            <div className="border-t border-dashed border-gray-200 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider text-left">Send Receipt</h4>
              <div className="space-y-2">
                <input 
                  type="email" 
                  placeholder="Customer Email Address" 
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:border-[#ffa200] outline-none text-gray-800"
                />
                <input 
                  type="text" 
                  placeholder="Customer Phone (e.g. +233...)" 
                  value={receiptPhone}
                  onChange={(e) => setReceiptPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:border-[#ffa200] outline-none text-gray-800"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendReceipt('email')}
                    disabled={!!sendingReceipt || !receiptEmail}
                    className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-gray-800 text-xs font-bold rounded-xl transition border border-gray-100"
                  >
                    {sendingReceipt === 'email' ? 'Sending...' : 'Send Email'}
                  </button>
                  <button
                    onClick={() => handleSendReceipt('sms')}
                    disabled={!!sendingReceipt || !receiptPhone}
                    className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-gray-800 text-xs font-bold rounded-xl transition border border-gray-100"
                  >
                    {sendingReceipt === 'sms' ? 'Sending...' : 'Send SMS'}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => toast.success("Receipt sent to printer!")}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="flex-1 py-3 bg-[#ffa200] hover:bg-[#D07B00] text-black font-bold rounded-xl transition"
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal for POS */}
      {showAddPosCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 p-5 rounded-2xl w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#d07b00]" /> Quick Add POS Customer
              </h4>
              <button type="button" onClick={() => setShowAddPosCustomer(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePosCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwame Mensah"
                  value={newPosCustomerName}
                  onChange={(e) => setNewPosCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#ffa200]"
                  autoFocus
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +233 24 123 4567"
                  value={newPosCustomerPhone}
                  onChange={(e) => setNewPosCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#ffa200]"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. kwame@example.com"
                  value={newPosCustomerEmail}
                  onChange={(e) => setNewPosCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#ffa200]"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Customer Type</label>
                <select
                  value={newPosCustomerType}
                  onChange={(e) => setNewPosCustomerType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale (15% Wholesale Discount)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddPosCustomer(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingPosCustomer}
                  className="flex-1 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold text-xs rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isAddingPosCustomer ? 'Saving...' : 'Save & Select for POS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AuthShield>
  );
}
