'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  Tag, Plus, X, Percent, DollarSign, Calendar, Hash,
  ToggleLeft, ToggleRight, Trash2, Edit, Copy, Search, Gift,
  QrCode, Printer, Package, CheckCircle2, AlertCircle, Sparkles,
  ShoppingBag, Check, Layers, Scissors, ExternalLink, ArrowRight,
  Globe, Store, Flame, Clock, RefreshCw, Timer, Image as ImageIcon,
  Send, Monitor, Eye
} from 'lucide-react';

const MOCK_PRODUCTS = [
  { id: 'bottle-250ml', name: '250ml Honey Bottle', category: 'Multifloral (raw honey)', spec: '250 ml', stockLevel: 210, sellingPrice: 25.00 },
  { id: 'bottle-500ml', name: '500ml Honey Bottle', category: 'Multifloral (raw honey)', spec: '500 ml', stockLevel: 140, sellingPrice: 45.00 },
  { id: 'bottle-1l', name: '1L Honey Bottle', category: 'Multifloral (raw honey)', spec: '1000 ml', stockLevel: 85, sellingPrice: 80.00 },
  { id: 'sachet', name: 'Honey Sachet Box', category: 'Multifloral (raw honey)', spec: 'Box of 30', stockLevel: 99, sellingPrice: 225.00 },
  { id: 'gallon-2.5l', name: '2.5L Honey Gallon', category: 'Multifloral (raw honey)', spec: '2.5 Liters', stockLevel: 59, sellingPrice: 170.00 },
  { id: 'gallon-4.5l', name: '4.5L Honey Gallon', category: 'Multifloral (raw honey)', spec: '4.5 Liters', stockLevel: 31, sellingPrice: 300.00 },
];

const INITIAL_MOCK_PROMO_PACKAGES = [
  {
    id: 'pkg-promo-wellness',
    name: 'Wellness Duo Combo',
    badge: 'Save ₵20',
    description: 'Perfect natural immune booster pairing our signature raw jar with daily honey sachets.',
    items: [
      { product_id: 'bottle-500ml', product_name: '500ml Honey Bottle', quantity: 1, unit_price: 45.00 },
      { product_id: 'sachet', product_name: 'Honey Sachet Box', quantity: 1, unit_price: 225.00 }
    ],
    regular_total: 270.00,
    package_price: 250.00,
    savings: 20.00,
    discount_percent: 7,
    showOnline: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'pkg-promo-family',
    name: 'Family Honey Stock',
    badge: 'Best Value',
    description: 'High-volume family bundle designed for tea sweetening, baking, and natural remedies.',
    items: [
      { product_id: 'bottle-1l', product_name: '1L Honey Bottle', quantity: 2, unit_price: 80.00 },
      { product_id: 'bottle-250ml', product_name: '250ml Honey Bottle', quantity: 1, unit_price: 25.00 }
    ],
    regular_total: 185.00,
    package_price: 155.00,
    savings: 30.00,
    discount_percent: 16,
    showOnline: true,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

export default function PromosPage() {
  const { roles, user } = useAuth();
  const { showConfirm } = useUI();

  // Active View Tab: 'packages' | 'coupons'
  const [activeTab, setActiveTab] = useState('packages');

  // Firestore Data States
  const [promos, setPromos] = useState([]);
  const [promoPackages, setPromoPackages] = useState(INITIAL_MOCK_PROMO_PACKAGES);
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Coupon Modal Form State
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    type: 'percentage', // 'percentage' | 'fixed'
    value: '',
    minOrder: '',
    maxUses: '',
    usesCount: 0,
    validFrom: '',
    validUntil: '',
    isActive: true,
  });

  // Package Modal Form State
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgBadge, setPkgBadge] = useState('');
  const [pkgDescription, setPkgDescription] = useState('');
  const [pkgItems, setPkgItems] = useState([
    { product_id: '', quantity: 1 },
    { product_id: '', quantity: 1 }
  ]);
  const [pkgPrice, setPkgPrice] = useState('');
  const [pkgDiscountPercent, setPkgDiscountPercent] = useState('');
  const [pkgShowOnline, setPkgShowOnline] = useState(true);
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // Stand Card / Flyer QR Modal State (holds either a Package or a Coupon object)
  const [showQRModal, setShowQRModal] = useState(null);
  const [qrModalType, setQrModalType] = useState('package'); // 'package' | 'coupon'

  // Load Firestore Data
  useEffect(() => {
    if (!db) {
      return;
    }

    // 1. Promos (Coupons) listener
    const unsubPromos = onSnapshot(collection(db, 'promos'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPromos(list);
    }, (err) => {
      console.warn('[Promos] Coupons listener warning:', err.message);
    });

    // 2. Promo Packages listener
    const unsubPackages = onSnapshot(collection(db, 'promo_packages'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPromoPackages(list.length > 0 ? list : INITIAL_MOCK_PROMO_PACKAGES);
      setLoading(false);
    }, (err) => {
      console.warn('[Promos] Promo packages listener warning:', err.message);
      setPromoPackages(INITIAL_MOCK_PROMO_PACKAGES);
      setLoading(false);
    });

    // 3. Products listener (for bundling)
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setProducts(list.length > 0 ? list : MOCK_PRODUCTS);
    }, (err) => {
      console.warn('[Promos] Products listener warning:', err.message);
      setProducts(MOCK_PRODUCTS);
    });

    return () => {
      unsubPromos();
      unsubPackages();
      unsubProducts();
    };
  }, []);

  // Lock background scroll and handle Escape key
  const anyModalOpen = Boolean(showPackageForm || showCouponForm || showQRModal);

  useEffect(() => {
    if (!anyModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPackageForm(false);
        setShowCouponForm(false);
        setShowQRModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [anyModalOpen]);

  // ----------------------------------------------------
  // COUPON ACTIONS
  // ----------------------------------------------------
  const resetCouponForm = () => {
    setCouponForm({
      code: '',
      description: '',
      type: 'percentage',
      value: '',
      minOrder: '',
      maxUses: '',
      usesCount: 0,
      validFrom: '',
      validUntil: '',
      isActive: true
    });
    setEditingCoupon(null);
    setShowCouponForm(false);
  };

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    if (!couponForm.code.trim() || !couponForm.value) {
      toast.error('Code and discount value are required.');
      return;
    }

    const payload = {
      code: couponForm.code.trim().toUpperCase(),
      description: couponForm.description.trim(),
      type: couponForm.type,
      value: parseFloat(couponForm.value),
      minOrder: parseFloat(couponForm.minOrder) || 0,
      maxUses: parseInt(couponForm.maxUses) || 0,
      usesCount: editingCoupon ? (editingCoupon.usesCount || 0) : 0,
      validFrom: couponForm.validFrom || null,
      validUntil: couponForm.validUntil || null,
      isActive: couponForm.isActive,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingCoupon) {
        if (db) {
          await updateDoc(doc(db, 'promos', editingCoupon.id), payload);
        } else {
          setPromos(prev => prev.map(p => p.id === editingCoupon.id ? { ...p, ...payload } : p));
        }
        toast.success(`Coupon "${payload.code}" updated!`);
      } else {
        const docId = `promo-${Date.now().toString(36)}`;
        const newObj = {
          ...payload,
          id: docId,
          createdAt: new Date().toISOString(),
          createdBy: user?.full_name || 'System'
        };
        if (db) {
          await setDoc(doc(db, 'promos', docId), newObj);
        } else {
          setPromos(prev => [newObj, ...prev]);
        }
        toast.success(`Coupon "${payload.code}" created!`);
      }
      resetCouponForm();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save coupon.');
    }
  };

  const toggleCouponActive = async (promo) => {
    try {
      if (db) {
        await updateDoc(doc(db, 'promos', promo.id), { isActive: !promo.isActive });
      } else {
        setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, isActive: !p.isActive } : p));
      }
      toast.success(`Coupon ${!promo.isActive ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      toast.error('Failed to toggle coupon.');
    }
  };

  const handleDeleteCoupon = async (promo) => {
    const isConfirmed = await showConfirm({
      title: 'Delete Promo Coupon',
      message: `Delete coupon "${promo.code}"? This cannot be undone.`,
      confirmText: 'Delete',
      isDestructive: true,
    });

    if (isConfirmed) {
      try {
        if (db) {
          await deleteDoc(doc(db, 'promos', promo.id));
        } else {
          setPromos(prev => prev.filter(p => p.id !== promo.id));
        }
        toast.success('Coupon deleted.');
      } catch {
        toast.error('Failed to delete coupon.');
      }
    }
  };

  const startEditCoupon = (promo) => {
    setCouponForm({
      code: promo.code || '',
      description: promo.description || '',
      type: promo.type || 'percentage',
      value: promo.value?.toString() || '',
      minOrder: promo.minOrder?.toString() || '',
      maxUses: promo.maxUses?.toString() || '',
      usesCount: promo.usesCount || 0,
      validFrom: promo.validFrom || '',
      validUntil: promo.validUntil || '',
      isActive: promo.isActive !== false,
    });
    setEditingCoupon(promo);
    setShowCouponForm(true);
  };

  // ----------------------------------------------------
  // PROMO PACKAGE ACTIONS
  // ----------------------------------------------------
  const resetPackageForm = () => {
    setEditingPackageId(null);
    setPkgName('');
    setPkgBadge('');
    setPkgDescription('');
    setPkgItems([
      { product_id: '', quantity: 1 },
      { product_id: '', quantity: 1 }
    ]);
    setPkgPrice('');
    setPkgDiscountPercent('');
    setPkgShowOnline(true);
    setShowPackageForm(false);
  };

  const handleAddPkgItemRow = () => {
    setPkgItems(prev => [...prev, { product_id: '', quantity: 1 }]);
  };

  const handleRemovePkgItemRow = (idx) => {
    setPkgItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePkgItemChange = (idx, field, value) => {
    setPkgItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // Live computation of regular retail total for package items
  const computedPackageRegularTotal = useMemo(() => {
    return pkgItems.reduce((sum, item) => {
      if (!item.product_id) return sum;
      const prod = products.find(p => p.id === item.product_id);
      const unitP = prod ? (prod.sellingPrice || 0) : 0;
      const qty = parseInt(item.quantity) || 1;
      return sum + (unitP * qty);
    }, 0);
  }, [pkgItems, products]);

  const handlePackageSubmit = async (e) => {
    e.preventDefault();

    if (!pkgName.trim()) {
      toast.error('Please enter a package name.');
      return;
    }

    const validItems = pkgItems.filter(item => item.product_id && parseInt(item.quantity) > 0);

    // Consolidate duplicate products into single entry
    const map = new Map();
    for (const item of validItems) {
      const q = parseInt(item.quantity) || 1;
      if (map.has(item.product_id)) {
        map.get(item.product_id).quantity += q;
      } else {
        map.set(item.product_id, { product_id: item.product_id, quantity: q });
      }
    }
    const consolidated = Array.from(map.values());

    if (consolidated.length < 2) {
      toast.error('A promo package bundle must contain at least 2 distinct products.');
      return;
    }

    const regularTotal = consolidated.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.product_id);
      return sum + (prod ? (prod.sellingPrice || 0) * item.quantity : 0);
    }, 0);

    let finalPrice = parseFloat(pkgPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      const disc = parseFloat(pkgDiscountPercent);
      if (!isNaN(disc) && disc > 0 && disc < 100) {
        finalPrice = Math.round((regularTotal * (1 - disc / 100)) * 100) / 100;
      } else {
        toast.error('Please enter either a package price or a discount percentage.');
        return;
      }
    }

    const savings = Math.max(0, regularTotal - finalPrice);
    const discountPercentCalc = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

    const existingPkg = editingPackageId
      ? promoPackages.find(p => p.id === editingPackageId)
      : null;

    const newPkg = {
      id: editingPackageId || `pkg-promo-${Date.now().toString(36)}`,
      name: pkgName.trim(),
      description: pkgDescription.trim(),
      badge: pkgBadge.trim() || (savings > 0 ? `Save ₵${savings.toFixed(0)}` : 'Special Pack'),
      items: consolidated.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: prod ? prod.name : 'Product',
          quantity: item.quantity,
          unit_price: prod ? (prod.sellingPrice || 0) : 0
        };
      }),
      regular_total: regularTotal,
      package_price: finalPrice,
      savings,
      discount_percent: discountPercentCalc,
      showOnline: pkgShowOnline,
      isActive: existingPkg ? existingPkg.isActive : true,
      createdAt: existingPkg ? existingPkg.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setIsSavingPackage(true);
    try {
      if (db) {
        await setDoc(doc(db, 'promo_packages', newPkg.id), newPkg);
      } else {
        setPromoPackages(prev => {
          const exists = prev.some(p => p.id === newPkg.id);
          return exists ? prev.map(p => p.id === newPkg.id ? newPkg : p) : [newPkg, ...prev];
        });
      }
      toast.success(editingPackageId ? `Package "${newPkg.name}" updated!` : `Package "${newPkg.name}" created!`);
      resetPackageForm();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to save package: ${err.message}`);
    } finally {
      setIsSavingPackage(false);
    }
  };

  const startEditPackage = (pkg) => {
    setEditingPackageId(pkg.id);
    setPkgName(pkg.name || '');
    setPkgBadge(pkg.badge || '');
    setPkgDescription(pkg.description || '');
    setPkgPrice(pkg.package_price?.toString() || '');
    setPkgDiscountPercent(pkg.discount_percent?.toString() || '');
    setPkgShowOnline(pkg.showOnline !== false);
    if (pkg.items && pkg.items.length > 0) {
      setPkgItems(pkg.items.map(it => ({ product_id: it.product_id, quantity: it.quantity })));
    } else {
      setPkgItems([
        { product_id: '', quantity: 1 },
        { product_id: '', quantity: 1 }
      ]);
    }
    setShowPackageForm(true);
  };

  const togglePackageActive = async (pkg) => {
    try {
      if (db) {
        await updateDoc(doc(db, 'promo_packages', pkg.id), { isActive: !pkg.isActive });
      } else {
        setPromoPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, isActive: !p.isActive } : p));
      }
      toast.success(`Package ${!pkg.isActive ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      toast.error('Failed to toggle package.');
    }
  };

  const togglePackageOnline = async (pkg) => {
    const current = pkg.showOnline !== false;
    try {
      if (db) {
        await updateDoc(doc(db, 'promo_packages', pkg.id), { showOnline: !current });
      } else {
        setPromoPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, showOnline: !current } : p));
      }
      toast.success(`Bundle ${!current ? 'published to Online Shop' : 'set to In-Store / POS Only'}.`);
    } catch (err) {
      toast.error('Failed to update online visibility.');
    }
  };

  const handleDeletePackage = async (pkg) => {
    const isConfirmed = await showConfirm({
      title: 'Delete Promo Package',
      message: `Delete package bundle "${pkg.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      isDestructive: true,
    });

    if (isConfirmed) {
      try {
        if (db) {
          await deleteDoc(doc(db, 'promo_packages', pkg.id));
        } else {
          setPromoPackages(prev => prev.filter(p => p.id !== pkg.id));
        }
        toast.success('Promo package deleted.');
      } catch {
        toast.error('Failed to delete package.');
      }
    }
  };

  // Calculate stock feasibility for each package
  const getPackageFeasibility = (pkg) => {
    if (!pkg.items || pkg.items.length === 0) return { minPossible: 0, status: 'unknown' };
    let minPossible = 9999;
    let limitingProduct = null;

    for (const item of pkg.items) {
      const prod = products.find(p => p.id === item.product_id);
      const stock = prod ? (prod.stockLevel || 0) : 0;
      const possible = Math.floor(stock / (parseInt(item.quantity) || 1));
      if (possible < minPossible) {
        minPossible = possible;
        limitingProduct = prod ? prod.name : 'Component';
      }
    }

    if (minPossible === 0) return { minPossible: 0, status: 'out_of_stock', limitingProduct };
    if (minPossible <= 5) return { minPossible, status: 'low_stock', limitingProduct };
    return { minPossible, status: 'in_stock', limitingProduct };
  };

  // Filtered lists
  const filteredPromos = useMemo(() => {
    if (!search) return promos;
    const s = search.toLowerCase();
    return promos.filter(p => p.code?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
  }, [promos, search]);

  const filteredPackages = useMemo(() => {
    if (!search) return promoPackages;
    const s = search.toLowerCase();
    return promoPackages.filter(p =>
      p.name?.toLowerCase().includes(s) ||
      p.description?.toLowerCase().includes(s) ||
      p.badge?.toLowerCase().includes(s) ||
      p.items?.some(it => it.product_name?.toLowerCase().includes(s))
    );
  }, [promoPackages, search]);

  const isExpired = (promo) => promo.validUntil && new Date(promo.validUntil) < new Date();
  const isExhausted = (promo) => promo.maxUses > 0 && promo.usesCount >= promo.maxUses;

  return (
    <AuthShield requiredPermission="promo.manage">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-black text-black flex items-center gap-2">
              <Gift className="w-6 h-6 text-[#ffa200]" /> Promotions & Packages
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage promo bundles, discount coupons, and printable QR stand cards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'packages' ? "Search packages & items..." : "Search coupon codes..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm w-56 focus:outline-none focus:border-[#ffa200]"
              />
            </div>

            {activeTab === 'packages' ? (
              <button
                type="button"
                onClick={() => { resetPackageForm(); setShowPackageForm(true); }}
                className="px-4 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold rounded-xl text-sm flex items-center gap-2 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Package Bundle
              </button>
            ) : activeTab === 'coupons' ? (
              <button
                type="button"
                onClick={() => { resetCouponForm(); setShowCouponForm(true); }}
                className="px-4 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold rounded-xl text-sm flex items-center gap-2 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Coupon Code
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchFlyerAd}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Check Expiration & Refresh Status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFlyerAd ? 'animate-spin' : ''}`} />
                  Purge Check / Refresh
                </button>
                <a
                  href="https://thehoneypalaceafrica.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-black hover:bg-gray-900 text-[#ffa200] font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Live Site
                </a>
              </div>
            )}
          </div>
        </div>

        {/* View Segmented Tabs */}
        <div className="flex items-center gap-3 border-b border-gray-200 pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('packages')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'packages'
                ? 'bg-black text-[#ffa200] shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Promo Packages & Bundles</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
              activeTab === 'packages' ? 'bg-[#ffa200] text-black' : 'bg-gray-300 text-gray-800'
            }`}>
              {promoPackages.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('coupons')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'coupons'
                ? 'bg-black text-[#ffa200] shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Discount Coupons</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
              activeTab === 'coupons' ? 'bg-[#ffa200] text-black' : 'bg-gray-300 text-gray-800'
            }`}>
              {promos.length}
            </span>
          </button>

          </div>

        {/* ==================================================== */}
        {/* TAB 1: PROMO PACKAGES & BUNDLES                      */}
        {/* ==================================================== */}
        {activeTab === 'packages' && (
          <div className="space-y-6">
            {/* Packages Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Bundles</p>
                <p className="text-2xl font-black text-black mt-1">{promoPackages.length}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Multi-product promotions</p>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Packages</p>
                <p className="text-2xl font-black text-black mt-1">
                  {promoPackages.filter(p => p.isActive !== false).length}
                </p>
                <p className="text-[11px] text-[#d07b00] font-medium mt-0.5">Ready for POS & Web QR</p>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Max Bundle Savings</p>
                <p className="text-2xl font-black text-[#d07b00] mt-1">
                  ₵{promoPackages.length > 0 ? Math.max(...promoPackages.map(p => p.savings || 0)).toFixed(0) : '0'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Customer incentive</p>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">POS Synced</p>
                <p className="text-2xl font-black text-black mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-[#ffa200]" /> Active
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Available in POS register</p>
              </div>
            </div>

            {/* Packages List */}
            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading promotional packages...</div>
            ) : filteredPackages.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-3xl p-8">
                <Package className="w-12 h-12 text-[#ffa200]/50 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900">No promo package bundles found</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Create high-converting bundle deals combining your bottles, jars, and sachets at attractive promotional prices.
                </p>
                <button
                  type="button"
                  onClick={() => { resetPackageForm(); setShowPackageForm(true); }}
                  className="mt-4 px-4 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold rounded-xl text-xs inline-flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> Create First Package
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPackages.map((pkg) => {
                  const feasibility = getPackageFeasibility(pkg);
                  const isActive = pkg.isActive !== false;

                  return (
                    <div
                      key={pkg.id}
                      className={`bg-white rounded-3xl border-2 transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-lg ${
                        isActive ? 'border-amber-300/80 hover:border-[#ffa200]' : 'border-gray-200 opacity-65'
                      }`}
                    >
                      {/* Top Header Card */}
                      <div className="p-5 pb-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 bg-[#ffa200]/15 text-[#945500] border border-[#ffa200]/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                              <Gift className="w-3 h-3 text-[#d07b00]" /> Promo Package
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePackageOnline(pkg)}
                              title={pkg.showOnline !== false ? "Visible in Online Shop. Click to make POS-only." : "POS-only. Click to publish to Online Shop."}
                              className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                                pkg.showOnline !== false 
                                  ? 'bg-[#ffa200]/20 text-[#854d0e] border-[#ffa200]/50 hover:bg-[#ffa200]/30' 
                                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              {pkg.showOnline !== false ? (
                                <>
                                  <Globe className="w-3 h-3 text-[#d07b00]" /> Online + POS
                                </>
                              ) : (
                                <>
                                  <Store className="w-3 h-3 text-gray-500" /> POS Only
                                </>
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {pkg.badge && (
                              <span className="bg-[#ffa200]/20 text-[#945500] border border-[#ffa200]/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                {pkg.badge}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePackageActive(pkg)}
                              title={isActive ? 'Deactivate Package' : 'Activate Package'}
                              className="text-gray-400 hover:text-gray-900 transition cursor-pointer"
                            >
                              {isActive ? (
                                <ToggleRight className="w-6 h-6 text-[#ffa200]" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>

                        <h3 className="font-extrabold text-gray-900 text-lg leading-snug">
                          {pkg.name}
                        </h3>

                        {pkg.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {pkg.description}
                          </p>
                        )}

                        {/* Included Products Container */}
                        <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-3 my-3 space-y-1.5">
                          <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center justify-between">
                            <span>Included In This Pack:</span>
                            <span className="text-[10px] font-normal text-amber-800">
                              {pkg.items?.length || 0} Products
                            </span>
                          </p>

                          <div className="space-y-1">
                            {pkg.items?.map((it, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <span className="text-gray-800 font-medium">
                                  <strong className="text-[#d07b00]">{it.quantity}x</strong> {it.product_name}
                                </span>
                                <span className="text-gray-400 font-mono text-[11px]">
                                  ₵{((it.unit_price || 0) * (it.quantity || 1)).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Price & Savings Display */}
                        <div className="pt-1 flex items-baseline justify-between">
                          <div>
                            <span className="text-xs text-gray-400 line-through mr-2">
                              ₵{Number(pkg.regular_total || 0).toFixed(2)}
                            </span>
                            <span className="text-2xl font-black text-gray-900">
                              ₵{Number(pkg.package_price || 0).toFixed(2)}
                            </span>
                          </div>

                          {pkg.savings > 0 && (
                            <span className="text-xs font-black text-black bg-[#ffa200]/20 border border-[#ffa200]/40 px-2.5 py-0.5 rounded-lg">
                              Save ₵{Number(pkg.savings).toFixed(0)} ({pkg.discount_percent}%)
                            </span>
                          )}
                        </div>

                        {/* Stock Feasibility Indicator */}
                        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 font-medium">Current Stock Feasibility:</span>
                          {feasibility.status === 'out_of_stock' ? (
                            <span className="text-red-600 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Out of stock
                            </span>
                          ) : (
                            <span className="text-gray-900 font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-[#ffa200]" /> {feasibility.minPossible} bundles can be made
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="bg-gray-50/80 border-t border-gray-100 p-3 px-5 flex items-center justify-between gap-2">
                        {/* Stand Card & QR Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowQRModal(pkg);
                            setQrModalType('package');
                          }}
                          className="flex-1 py-2 px-3 bg-[#ffa200] hover:bg-[#d07b00] active:scale-[0.98] text-black font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                          title="Generate Printable Stand Card & QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Stand Card & QR</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditPackage(pkg)}
                            className="p-2 hover:bg-gray-200/70 rounded-xl text-gray-600 hover:text-black transition"
                            title="Edit Package"
                          >
                            <Edit className="w-4 h-4 text-[#d07b00]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePackage(pkg)}
                            className="p-2 hover:bg-red-100/60 rounded-xl text-red-500 transition"
                            title="Delete Package"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: COUPON CODES                                  */}
        {/* ==================================================== */}
        {activeTab === 'coupons' && (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-[#d07b00]/10 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Coupons</p>
                <p className="text-2xl font-bold text-black mt-1">{promos.length}</p>
              </div>
              <div className="bg-white border border-[#d07b00]/10 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active</p>
                <p className="text-2xl font-bold text-[#ffa200] mt-1">{promos.filter(p => p.isActive && !isExpired(p)).length}</p>
              </div>
              <div className="bg-white border border-[#d07b00]/10 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Expired</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{promos.filter(p => isExpired(p)).length}</p>
              </div>
              <div className="bg-white border border-[#d07b00]/10 rounded-2xl p-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Redemptions</p>
                <p className="text-2xl font-bold text-[#ffa200] mt-1">{promos.reduce((s, p) => s + (p.usesCount || 0), 0)}</p>
              </div>
            </div>

            {/* Coupons List */}
            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading coupons...</div>
            ) : filteredPromos.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-3xl p-8">
                <Tag className="w-12 h-12 text-[#ffa200]/50 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900">No promo coupons found</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Create your first discount coupon code for your online checkout and promotional campaigns.
                </p>
                <button
                  type="button"
                  onClick={() => { resetCouponForm(); setShowCouponForm(true); }}
                  className="mt-4 px-4 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold rounded-xl text-xs inline-flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> Create Coupon
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredPromos.map((promo) => {
                  const expired = isExpired(promo);
                  const exhausted = isExhausted(promo);
                  const active = promo.isActive && !expired && !exhausted;

                  return (
                    <div
                      key={promo.id}
                      className={`bg-white border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                        active ? 'border-[#ffa200]/50 shadow-xs' : 'border-gray-200 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Code Badge */}
                        <div className={`px-4 py-2.5 rounded-xl font-mono font-black text-sm tracking-wider border-2 border-dashed ${
                          active ? 'bg-[#ffa200]/10 border-[#ffa200] text-[#d07b00]' : 'bg-gray-100 border-gray-300 text-gray-500'
                        }`}>
                          {promo.code}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-black">
                              {promo.type === 'percentage' ? `${promo.value}% OFF` : `GHS ${promo.value} OFF`}
                            </span>
                            {expired && <span className="text-[10px] font-bold uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Expired</span>}
                            {exhausted && !expired && <span className="text-[10px] font-bold uppercase bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Limit Reached</span>}
                            {active && <span className="text-[10px] font-bold uppercase bg-[#ffa200]/15 text-[#D07B00] px-2 py-0.5 rounded-full">Active</span>}
                            {!promo.isActive && <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Disabled</span>}
                          </div>

                          <p className="text-xs text-gray-500 mt-1 truncate">{promo.description || 'General discount voucher'}</p>

                          <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-500">
                            {promo.minOrder > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Min: GHS {promo.minOrder}</span>}
                            {promo.maxUses > 0 && <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Uses: {promo.usesCount || 0}/{promo.maxUses}</span>}
                            {promo.maxUses === 0 && <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Uses: {promo.usesCount || 0}/∞</span>}
                            {promo.validFrom && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> From: {new Date(promo.validFrom).toLocaleDateString()}</span>}
                            {promo.validUntil && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Until: {new Date(promo.validUntil).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Stand Card & QR Flyer Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowQRModal(promo);
                            setQrModalType('coupon');
                          }}
                          className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-[#d07b00] border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          title="Generate Flyer & QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Flyer & QR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(promo.code);
                            toast.success(`Copied "${promo.code}" to clipboard!`);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                          title="Copy Code"
                        >
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleCouponActive(promo)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                          title={promo.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {promo.isActive ? <ToggleRight className="w-5 h-5 text-[#ffa200]" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => startEditCoupon(promo)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-[#ffa200]" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCoupon(promo)}
                          className="p-2 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: FLOATING FLYER AD (TEMPORAL AUTO-PURGING)    */}
        {/* ==================================================== */}
        {showPackageForm && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) resetPackageForm();
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden"
          >
            <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex justify-between items-center bg-gray-50/80 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#ffa200]/20 flex items-center justify-center text-[#d07b00]">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900">
                      {editingPackageId ? 'Edit Promo Package Bundle' : 'Create New Promo Package Bundle'}
                    </h3>
                    <p className="text-xs text-gray-500">Combine multiple products with a special bundle price.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetPackageForm}
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200/50 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handlePackageSubmit} className="p-6 space-y-5 text-sm overflow-y-auto min-h-0 flex-1">
                {/* Package Name & Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-700 font-bold block mb-1">
                      Package Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Wellness Duo Pack"
                      value={pkgName}
                      onChange={(e) => setPkgName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#ffa200] font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-700 font-bold block mb-1">
                      Badge Text (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Save ₵25 or Most Popular"
                      value={pkgBadge}
                      onChange={(e) => setPkgBadge(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-gray-700 font-bold block mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Short description of this promo package for customers..."
                    value={pkgDescription}
                    onChange={(e) => setPkgDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#ffa200]"
                  />
                </div>

                {/* Publish to Online Store Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${pkgShowOnline ? 'bg-[#ffa200]/25 text-[#945500]' : 'bg-gray-200 text-gray-500'}`}>
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-xs sm:text-sm">Publish to Online Shop</p>
                      <p className="text-[11px] text-gray-500">
                        {pkgShowOnline 
                          ? 'Visible in online shop (thehoneypalaceafrica.com) and counter POS' 
                          : 'POS / Exhibition Exclusive (only sold in person at counter)'}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pkgShowOnline} 
                      onChange={(e) => setPkgShowOnline(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ffa200]"></div>
                  </label>
                </div>

                {/* Included Products List */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-700 font-bold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#d07b00]" /> Included Products in Bundle (Min 2)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPkgItemRow}
                      className="text-xs font-bold text-[#d07b00] hover:text-black flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Product
                    </button>
                  </div>

                  <div className="space-y-2">
                    {pkgItems.map((item, idx) => {
                      const selectedProd = products.find(p => p.id === item.product_id);
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50/80 p-2.5 rounded-xl border border-gray-200">
                          {/* Product select */}
                          <div className="flex-1">
                            <select
                              required
                              value={item.product_id}
                              onChange={(e) => handlePkgItemChange(idx, 'product_id', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                            >
                              <option value="">-- Choose Product --</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (₵{Number(p.sellingPrice || 0).toFixed(2)} | Stock: {p.stockLevel || 0})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="w-20">
                            <input
                              type="number"
                              required
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handlePkgItemChange(idx, 'quantity', e.target.value)}
                              className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-center"
                              placeholder="Qty"
                            />
                          </div>

                          {/* Line total preview */}
                          <div className="w-24 text-right font-mono text-xs font-bold text-gray-700">
                            ₵{((selectedProd ? selectedProd.sellingPrice || 0 : 0) * (parseInt(item.quantity) || 1)).toFixed(2)}
                          </div>

                          {/* Remove button */}
                          {pkgItems.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePkgItemRow(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pricing & Savings calculation */}
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-700">Regular Retail Total:</span>
                    <span className="font-mono text-base font-black text-gray-900">
                      ₵{computedPackageRegularTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-700 font-bold block mb-1">
                        Promo Bundle Price (GHS) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="e.g. 199.00"
                        value={pkgPrice}
                        onChange={(e) => {
                          setPkgPrice(e.target.value);
                          const p = parseFloat(e.target.value);
                          if (computedPackageRegularTotal > 0 && !isNaN(p) && p > 0) {
                            const disc = Math.round(((computedPackageRegularTotal - p) / computedPackageRegularTotal) * 100);
                            setPkgDiscountPercent(disc > 0 ? disc.toString() : '0');
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-bold text-sm focus:outline-none focus:border-[#ffa200]"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-700 font-bold block mb-1">
                        OR Discount Percentage (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        placeholder="e.g. 15"
                        value={pkgDiscountPercent}
                        onChange={(e) => {
                          setPkgDiscountPercent(e.target.value);
                          const d = parseFloat(e.target.value);
                          if (computedPackageRegularTotal > 0 && !isNaN(d) && d > 0) {
                            const p = Math.round((computedPackageRegularTotal * (1 - d / 100)) * 100) / 100;
                            setPkgPrice(p.toString());
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-bold text-sm focus:outline-none focus:border-[#ffa200]"
                      />
                    </div>
                  </div>

                  {/* Savings Preview */}
                  {computedPackageRegularTotal > 0 && parseFloat(pkgPrice) > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200/80">
                      <span className="font-bold text-[#945500]">Customer Savings:</span>
                      <span className="font-black text-[#d07b00]">
                        ₵{(computedPackageRegularTotal - parseFloat(pkgPrice)).toFixed(2)} ({pkgDiscountPercent}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={resetPackageForm}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPackage}
                    className="flex-1 py-2.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-black rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSavingPackage ? 'Saving...' : editingPackageId ? 'Update Package' : 'Create Package'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* CREATE / EDIT COUPON MODAL                           */}
        {/* ==================================================== */}
        {showCouponForm && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) resetCouponForm();
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden"
          >
            <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg shadow-2xl p-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#ffa200]/20 flex items-center justify-center text-[#d07b00]">
                    <Tag className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-gray-900">
                    {editingCoupon ? 'Edit Discount Coupon' : 'Create New Discount Coupon'}
                  </h3>
                </div>
                <button onClick={resetCouponForm} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCouponSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="text-xs text-gray-700 font-bold block mb-1">
                    Coupon Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HONEY15"
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-mono uppercase tracking-wider font-bold focus:outline-none focus:border-[#ffa200]"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-700 font-bold block mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 15% off Easter special"
                    value={couponForm.description}
                    onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#ffa200]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-700 font-bold block mb-1">Discount Type</label>
                    <select
                      value={couponForm.type}
                      onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#ffa200]"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (GHS)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-bold block mb-1">Discount Value <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.01"
                      placeholder={couponForm.type === 'percentage' ? 'e.g. 15' : 'e.g. 40'}
                      value={couponForm.value}
                      onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-bold focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-700 font-bold block mb-1">Min Order Amount (GHS)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0 = No minimum"
                      value={couponForm.minOrder}
                      onChange={(e) => setCouponForm({ ...couponForm, minOrder: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-bold block mb-1">Max Redemptions</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0 = Unlimited"
                      value={couponForm.maxUses}
                      onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-700 font-bold block mb-1">Valid From</label>
                    <input
                      type="date"
                      value={couponForm.validFrom}
                      onChange={(e) => setCouponForm({ ...couponForm, validFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-bold block mb-1">Valid Until</label>
                    <input
                      type="date"
                      value={couponForm.validUntil}
                      onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={resetCouponForm}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-black rounded-xl transition shadow-md cursor-pointer"
                  >
                    {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STAND CARD / FLYER & QR MODAL (Package or Coupon)   */}
        {/* ==================================================== */}
        {showQRModal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowQRModal(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-hidden"
          >
            {/* Embedded Print Styling */}
            <style jsx global>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #promo-stand-card-print, #promo-stand-card-print * {
                  visibility: visible !important;
                }
                #promo-stand-card-print {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 24px !important;
                  border: 3px solid #ffa200 !important;
                  border-radius: 16px !important;
                  box-shadow: none !important;
                  background: #ffffff !important;
                  color: #111111 !important;
                  page-break-inside: avoid !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .no-print-area {
                  display: none !important;
                }
              }
            `}</style>

            <div className="max-w-xl w-full relative space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowQRModal(null)}
                className="absolute -top-3 -right-3 z-30 w-9 h-9 bg-black hover:bg-neutral-800 text-white hover:text-[#ffa200] border-2 border-[#ffa200] rounded-full flex items-center justify-center shadow-2xl transition hover:scale-110 cursor-pointer no-print-area"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* PRINT TARGET CARD (A5 Formatted) */}
              <div
                id="promo-stand-card-print"
                className="bg-white text-gray-900 rounded-3xl p-7 border-2 border-[#ffa200] shadow-2xl text-center space-y-4 relative overflow-hidden"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {/* Logo & Brand Motto */}
                <div className="flex flex-col items-center justify-center pb-2 border-b border-gray-100">
                  <img
                    src="/assets/honey-palace-logo.png"
                    alt="The Honey Palace"
                    className="h-12 sm:h-14 w-auto object-contain mb-1"
                  />
                  <p className="text-xs sm:text-[13px] tracking-wide text-[#d07b00] font-semibold mt-0.5">
                    The Home of Quality Honey
                  </p>
                </div>

                {/* Offer Headline Box */}
                {qrModalType === 'package' ? (
                  <div className="bg-amber-50/80 rounded-2xl p-3.5 border-2 border-[#ffa200] shadow-xs">
                    <p className="text-[10px] uppercase font-bold text-[#d07b00] tracking-wider">
                      Exclusive Promo Bundle Deal
                    </p>
                    <h2 className="text-xl font-black text-gray-900 leading-tight mt-0.5">
                      {showQRModal.name}
                    </h2>
                    {showQRModal.badge && (
                      <span className="inline-block mt-1 bg-black text-[#ffa200] border border-[#ffa200]/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                        {showQRModal.badge}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50/80 rounded-2xl p-3.5 border-2 border-[#ffa200] shadow-xs">
                    <p className="text-[10px] uppercase font-bold text-[#d07b00] tracking-wider">
                      Special Discount Voucher
                    </p>
                    <h2 className="text-2xl font-black text-[#d07b00] leading-tight mt-0.5 font-mono">
                      {showQRModal.code}
                    </h2>
                    <p className="text-xs font-bold text-gray-900 mt-1">
                      {showQRModal.type === 'percentage' ? `${showQRModal.value}% OFF YOUR ORDER` : `GHS ${showQRModal.value} OFF YOUR ORDER`}
                    </p>
                  </div>
                )}

                {/* If Package: Show Items & Price breakdown */}
                {qrModalType === 'package' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-3 text-left space-y-1.5 text-xs">
                    <p className="text-[10px] font-bold text-[#d07b00] uppercase tracking-wider">Included in this bundle:</p>
                    <div className="space-y-1">
                      {showQRModal.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-gray-800 font-semibold">
                            <strong className="text-[#d07b00]">{it.quantity}x</strong> {it.product_name}
                          </span>
                          <span className="text-gray-400 font-mono text-[11px]">
                            ₵{((it.unit_price || 0) * (it.quantity || 1)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex items-baseline justify-between">
                      <span className="text-xs text-gray-500 font-medium">Bundle Price:</span>
                      <div>
                        <span className="text-xs text-gray-400 line-through mr-1.5">
                          ₵{Number(showQRModal.regular_total || 0).toFixed(2)}
                        </span>
                        <span className="text-lg font-black text-gray-900">
                          ₵{Number(showQRModal.package_price || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Coupon: Show Conditions */}
                {qrModalType === 'coupon' && showQRModal.minOrder > 0 && (
                  <p className="text-xs text-gray-600 font-medium">
                    Valid on orders starting from <strong>GHS {showQRModal.minOrder}</strong>.
                  </p>
                )}

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center my-2">
                  <div className="p-4 sm:p-5 bg-white border-4 border-[#ffa200] rounded-3xl shadow-lg inline-block">
                    <QRCodeSVG
                      value={
                        qrModalType === 'package'
                          ? `https://thehoneypalaceafrica.com/bundles/${showQRModal.id}`
                          : `https://thehoneypalaceafrica.com/?coupon=${showQRModal.code}`
                      }
                      size={240}
                      bgColor="#ffffff"
                      fgColor="#111111"
                      level="Q"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-sm font-black text-gray-900 tracking-wide mt-2">
                    {qrModalType === 'package' ? 'Scan to Order This Bundle' : 'Scan to Auto-Apply Coupon Code'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Works directly with your phone camera or QR scanner
                  </p>
                </div>

                {/* 3 Simple Customer Steps */}
                <div className="grid grid-cols-3 gap-2 text-left bg-white p-3 rounded-xl border border-gray-200 text-[10px] shadow-xs">
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#ffa200] text-white font-black flex items-center justify-center shrink-0 text-[10px]">1</span>
                    <span className="text-gray-700 leading-tight"><strong>Scan QR</strong> with phone camera</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#ffa200] text-white font-black flex items-center justify-center shrink-0 text-[10px]">2</span>
                    <span className="text-gray-700 leading-tight"><strong>Pay via MoMo</strong> or Card instantly</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#ffa200] text-white font-black flex items-center justify-center shrink-0 text-[10px]">3</span>
                    <span className="text-gray-700 leading-tight"><strong>Delivered</strong> or collect in-shop!</span>
                  </div>
                </div>

                {/* Footer Contact Details */}
                <div
                  className="text-[10px] sm:text-[11px] text-gray-700 pt-2 border-t border-gray-100 flex flex-col sm:flex-row print:flex-row items-center justify-between gap-1.5 font-medium"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <span className="font-bold text-gray-900">Tel/MoMo:</span>
                    <span className="font-semibold whitespace-nowrap">+233 50 260 6270 / +233 53 052 4630</span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <span className="font-bold text-gray-900">Web:</span>
                    <span className="text-[#d07b00] font-bold whitespace-nowrap">thehoneypalaceafrica.com</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Excluded from Print) */}
              <div className="bg-white rounded-2xl p-2.5 border-2 border-[#ffa200] shadow-xl no-print-area grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-3 px-3 bg-[#ffa200] hover:bg-[#ffb020] active:scale-[0.98] text-gray-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-gray-950 shrink-0" />
                  <span>Print Stand / Flyer (A5)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = qrModalType === 'package'
                      ? `https://thehoneypalaceafrica.com/bundles/${showQRModal.id}`
                      : `https://thehoneypalaceafrica.com/?coupon=${showQRModal.code}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Promo link copied to clipboard!");
                  }}
                  className="py-3 px-3 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] text-gray-900 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-gray-200 transition cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-gray-700 shrink-0" />
                  <span>Copy Web Link</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthShield>
  );
}
