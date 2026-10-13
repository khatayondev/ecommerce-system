'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Compass, 
  Plus, 
  X, 
  MapPin, 
  Calendar, 
  Truck, 
  CheckCircle, 
  AlertTriangle,
  RotateCcw,
  BookOpen,
  DollarSign,
  Boxes,
  QrCode,
  Printer,
  Copy,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  Share2,
  Package,
  Phone,
  Clock,
  Search,
  TrendingUp,
  Pencil,
  Trash2,
  Gift,
  Tag,
  Percent
} from 'lucide-react';

const MOCK_EXHIBITIONS = [
  { 
    id: 'ex-1', 
    name: 'Accra Food & Honey Expo 2026', 
    venue: 'Accra International Conference Centre', 
    start_date: '2026-07-10', 
    end_date: '2026-07-13', 
    status: 'active', 
    discount_percent: 10,
    target_sales: 5000.00,
    allocated_stock: [
      { product_id: 'bottle-500ml', batch_id: 'batch-1', batch_number: 'B-2026-AMR-01', product_name: '500ml Honey Bottle', quantity_allocated: 40, quantity_returned: 0 }
    ],
    sales_total: 900.00,
  },
  { 
    id: 'ex-2', 
    name: 'Ghana Trade Fair', 
    venue: 'Trade Fair Centre, La', 
    start_date: '2026-05-01', 
    end_date: '2026-05-05', 
    status: 'closed', 
    discount_percent: 5,
    target_sales: 3000.00,
    allocated_stock: [
      { product_id: 'bottle-1l', batch_id: 'batch-2', batch_number: 'B-2026-NKR-02', product_name: '1L Honey Bottle', quantity_allocated: 20, quantity_returned: 8 }
    ],
    sales_total: 960.00,
  }
];

const MOCK_BATCHES = [
  { id: 'batch-1', batch_number: 'B-2026-AMR-01', product_id: 'bottle-500ml', product_name: '500ml Honey Bottle', quantity_remaining: 85 },
  { id: 'batch-2', batch_number: 'B-2026-NKR-02', product_id: 'bottle-1l', product_name: '1L Honey Bottle', quantity_remaining: 50 },
];

export default function ExhibitionsPage() {
  const { roles } = useAuth();
  const { showConfirm } = useUI();
  const [exhibitions, setExhibitions] = useState([]);
  const [products, setProducts] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAllocateForm, setShowAllocateForm] = useState(false);
  const [showReconcileForm, setShowReconcileForm] = useState(false);
  const [selectedExhibition, setSelectedExhibition] = useState(null);
  const [showQRModal, setShowQRModal] = useState(null); // holds the exhibition object
  const [showOrdersModal, setShowOrdersModal] = useState(null); // holds exhibition for live orders & stock sold
  const [ordersModalTab, setOrdersModalTab] = useState('stock'); // 'stock' | 'orders'
  const [ordersFilterStatus, setOrdersFilterStatus] = useState('all'); // 'all' | 'pending' | 'handed_over'
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);

  // Forms Data
  const [newExhibition, setNewExhibition] = useState({
    name: '',
    venue: '',
    start_date: '',
    end_date: '',
    discount_percent: 0,
    target_sales: 0,
  });

  const [allocation, setAllocation] = useState({
    product_id: '',
    quantity: 0,
  });

  const [returnedStockInputs, setReturnedStockInputs] = useState({}); // { product_id: returned_qty }
  
  // Edit Allocated Stock State
  const [editingAllocatedItem, setEditingAllocatedItem] = useState(null); // { exhibitionId, exhibitionName, itemIndex, product_id, currentQty, product_name }
  const [editAllocatedQty, setEditAllocatedQty] = useState('');
  const [isUpdatingAllocation, setIsUpdatingAllocation] = useState(false);

  // Event Packages & Bundles State
  const [showPackagesModal, setShowPackagesModal] = useState(null); // holds exhibition object
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [deletingPackageId, setDeletingPackageId] = useState(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgBadge, setPkgBadge] = useState('');
  const [pkgItems, setPkgItems] = useState([
    { product_id: '', quantity: 1 },
    { product_id: '', quantity: 1 }
  ]);
  const [pkgPrice, setPkgPrice] = useState('');
  const [pkgDiscountPercent, setPkgDiscountPercent] = useState('');
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  const resetPackageForm = () => {
    setEditingPackageId(null);
    setDeletingPackageId(null);
    setPkgName('');
    setPkgBadge('');
    setPkgItems([
      { product_id: '', quantity: 1 },
      { product_id: '', quantity: 1 }
    ]);
    setPkgPrice('');
    setPkgDiscountPercent('');
  };

  const handleStartEditPackage = (pkg) => {
    setEditingPackageId(pkg.id);
    setPkgName(pkg.name || '');
    setPkgBadge(pkg.badge || '');
    setPkgItems((pkg.items && pkg.items.length > 0) ? pkg.items.map(it => ({
      product_id: it.product_id,
      quantity: it.quantity || 1
    })) : [
      { product_id: '', quantity: 1 },
      { product_id: '', quantity: 1 }
    ]);
    setPkgPrice(pkg.package_price ? pkg.package_price.toString() : '');
    setPkgDiscountPercent(pkg.discount_percent ? pkg.discount_percent.toString() : '');

    const formEl = document.getElementById('package-builder-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when modals are open
  const anyModalOpen = Boolean(showQRModal || showOrdersModal || showAddForm || showAllocateForm || showReconcileForm || editingAllocatedItem || showPackagesModal);

  useEffect(() => {
    if (!anyModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [anyModalOpen]);

  // Escape key handler to close any active modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowQRModal(null);
        setShowOrdersModal(null);
        setShowAddForm(false);
        setShowAllocateForm(false);
        setShowReconcileForm(false);
        setEditingAllocatedItem(null);
        setShowPackagesModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!db) {
      setExhibitions(MOCK_EXHIBITIONS);
      setIsMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Fetch Products
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setProducts(list);
    }, (err) => console.warn('[Exhibitions] Products permission warning:', err.message));

    // 2. Fetch Exhibitions
    const unsubscribeExhibitions = onSnapshot(collection(db, 'exhibitions'), 
      (snapshot) => {
        if (snapshot.empty) {
          setExhibitions([]);
          setIsMock(false);
        } else {
          const list = [];
          snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
          setExhibitions(list);
          setIsMock(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore loading error, using mock exhibitions:", err);
        setExhibitions(MOCK_EXHIBITIONS);
        setIsMock(true);
        setLoading(false);
      }
    );

    // 3. Fetch Orders for Exhibition booth pickup tracking
    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      setOrders(list);
    }, (err) => console.warn('[Exhibitions] Orders permission warning:', err.message));

    return () => {
      unsubscribeProducts();
      unsubscribeExhibitions();
      unsubscribeOrders();
    };
  }, []);

  const handleCreateExhibition = async (e) => {
    e.preventDefault();
    if (!newExhibition.name.trim() || !newExhibition.venue.trim()) return;

    const baseSlug = newExhibition.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const docId = `ex-${Date.now().toString(36)}`;
    const slug = baseSlug || docId;

    const payload = {
      name: newExhibition.name.trim(),
      slug: slug,
      venue: newExhibition.venue.trim(),
      start_date: newExhibition.start_date,
      end_date: newExhibition.end_date,
      status: 'active',
      discount_percent: parseInt(newExhibition.discount_percent) || 0,
      target_sales: parseFloat(newExhibition.target_sales) || 0,
      allocated_stock: [],
      sales_total: 0,
      created_at: new Date().toISOString()
    };

    if (isMock) {
      setExhibitions(prev => [...prev, { id: docId, ...payload }]);
      setShowAddForm(false);
      setNewExhibition({ name: '', venue: '', start_date: '', end_date: '', discount_percent: 0, target_sales: 0 });
      return;
    }

    try {
      await setDoc(doc(db, 'exhibitions', docId), payload);
      setShowAddForm(false);
      setNewExhibition({ name: '', venue: '', start_date: '', end_date: '', discount_percent: 0, target_sales: 0 });
      toast.success("Exhibition created successfully!");
    } catch (err) {
      console.error("Error creating exhibition:", err);
      toast.error("Failed to create exhibition.");
    }
  };

  const handleAllocateStock = async (e) => {
    e.preventDefault();
    const { product_id, quantity } = allocation;
    if (!product_id || quantity <= 0 || !selectedExhibition) return;

    const selectedProduct = products.find(p => p.id === product_id);
    if (!selectedProduct) return;

    if (selectedProduct.stockLevel < quantity) {
      toast.error(`Insufficient stock in selected product. Available: ${selectedProduct.stockLevel}`);
      return;
    }

    const newAllocItem = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity_allocated: parseInt(quantity),
      quantity_returned: 0
    };

    if (isMock) {
      // Simulate stock allocation (merge if product already allocated)
      setExhibitions(prev =>
        prev.map(ex => {
          if (ex.id === selectedExhibition.id) {
            const list = [...(ex.allocated_stock || [])];
            const existingIdx = list.findIndex(item => item.product_id === selectedProduct.id);
            if (existingIdx >= 0) {
              list[existingIdx] = {
                ...list[existingIdx],
                quantity_allocated: (parseInt(list[existingIdx].quantity_allocated) || 0) + parseInt(quantity),
                product_name: selectedProduct.name
              };
            } else {
              list.push(newAllocItem);
            }
            return { ...ex, allocated_stock: list };
          }
          return ex;
        })
      );
      setProducts(prev =>
        prev.map(p => p.id === product_id ? { ...p, stockLevel: p.stockLevel - quantity } : p)
      );
      setShowAllocateForm(false);
      setAllocation({ product_id: '', quantity: 0 });
      toast.success("Stock allocated successfully (Sandbox)!");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Fetch current exhibition doc
        const exRef = doc(db, 'exhibitions', selectedExhibition.id);
        const exSnap = await transaction.get(exRef);
        if (!exSnap.exists()) throw new Error("Exhibition does not exist!");

        const allocatedList = [...(exSnap.data().allocated_stock || [])];
        const existingIdx = allocatedList.findIndex(item => item.product_id === selectedProduct.id);
        if (existingIdx >= 0) {
          allocatedList[existingIdx] = {
            ...allocatedList[existingIdx],
            quantity_allocated: (parseInt(allocatedList[existingIdx].quantity_allocated) || 0) + parseInt(quantity),
            product_name: selectedProduct.name
          };
        } else {
          allocatedList.push(newAllocItem);
        }

        // 2. Fetch target product doc to deduct stock
        const productRef = doc(db, 'products', product_id);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("Product does not exist!");

        const currentQty = productSnap.data().stockLevel || 0;
        if (currentQty < quantity) throw new Error("Insufficient stock in product!");

        // 3. Perform atomic updates
        transaction.update(exRef, { allocated_stock: allocatedList });
        transaction.update(productRef, { stockLevel: currentQty - quantity });

        // 4. Log Stock Movement
        const movRef = doc(db, 'stock_movements', `mov-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`);
        transaction.set(movRef, {
          product_id: selectedProduct.id,
          movement_type: 'out',
          quantity,
          reference: `Allocated to event: ${selectedExhibition.name}`,
          moved_at: new Date().toISOString()
        });
      });

      setShowAllocateForm(false);
      setAllocation({ product_id: '', quantity: 0 });
      toast.success("Stock allocated and locked!");
    } catch (err) {
      console.error("Error allocating stock transaction:", err);
      toast.error(`Allocation failed: ${err.message}`);
    }
  };

  // Helper to check if duplicate product allocations exist
  const hasDuplicateAllocations = (stockList) => {
    if (!Array.isArray(stockList) || stockList.length <= 1) return false;
    const ids = stockList.map(i => i.product_id);
    return new Set(ids).size < ids.length;
  };

  // Consolidate duplicate products into clean, singular rows
  const handleConsolidateStock = async (exhibition) => {
    const currentList = exhibition.allocated_stock || [];
    if (currentList.length <= 1) return;

    const consolidated = [];
    const map = new Map();

    currentList.forEach(item => {
      const prodId = item.product_id;
      const sysProd = products.find(p => p.id === prodId);
      const prodName = sysProd ? sysProd.name : (item.product_name || 'Product');
      const qty = parseInt(item.quantity_allocated) || 0;
      const ret = parseInt(item.quantity_returned) || 0;

      if (map.has(prodId)) {
        const existing = map.get(prodId);
        existing.quantity_allocated += qty;
        existing.quantity_returned += ret;
        if (sysProd) existing.product_name = sysProd.name;
      } else {
        const entry = {
          product_id: prodId,
          product_name: prodName,
          quantity_allocated: qty,
          quantity_returned: ret
        };
        map.set(prodId, entry);
        consolidated.push(entry);
      }
    });

    if (isMock) {
      setExhibitions(prev => prev.map(ex => ex.id === exhibition.id ? { ...ex, allocated_stock: consolidated } : ex));
      toast.success("Consolidated duplicate stock rows!");
      return;
    }

    try {
      await updateDoc(doc(db, 'exhibitions', exhibition.id), {
        allocated_stock: consolidated
      });
      toast.success("Consolidated duplicate product rows into clean list!");
    } catch (err) {
      console.error("Error consolidating stock:", err);
      toast.error("Failed to consolidate stock rows.");
    }
  };

  // Delete / Remove an allocated product and return units to warehouse
  const handleDeleteAllocatedStock = async (exhibition, itemIndex) => {
    const stockList = [...(exhibition.allocated_stock || [])];
    const targetItem = stockList[itemIndex];
    if (!targetItem) return;

    const targetProduct = products.find(p => p.id === targetItem.product_id);
    const productName = targetProduct ? targetProduct.name : (targetItem.product_name || 'this product');
    const returnQty = parseInt(targetItem.quantity_allocated) || 0;

    const confirmed = await showConfirm({
      title: 'Remove Allocated Stock?',
      message: `Are you sure you want to remove "${productName}" from ${exhibition.name}? All ${returnQty} allocated units will be returned to warehouse inventory.`,
      confirmText: 'Return Stock & Remove',
      isDestructive: true
    });

    if (!confirmed) return;

    if (isMock) {
      stockList.splice(itemIndex, 1);
      setExhibitions(prev => prev.map(ex => ex.id === exhibition.id ? { ...ex, allocated_stock: stockList } : ex));
      if (targetItem.product_id) {
        setProducts(prev => prev.map(p => p.id === targetItem.product_id ? { ...p, stockLevel: (p.stockLevel || 0) + returnQty } : p));
      }
      toast.success(`Removed ${productName} and returned ${returnQty} units to inventory!`);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // 1. ALL READS FIRST
        const exRef = doc(db, 'exhibitions', exhibition.id);
        const exSnap = await transaction.get(exRef);
        if (!exSnap.exists()) throw new Error("Exhibition no longer exists.");

        let prodRef = null;
        let prodSnap = null;
        if (targetItem.product_id) {
          prodRef = doc(db, 'products', targetItem.product_id);
          prodSnap = await transaction.get(prodRef);
        }

        // 2. IN-MEMORY CALCULATIONS
        const currentAllocated = [...(exSnap.data().allocated_stock || [])];
        const removed = currentAllocated.splice(itemIndex, 1)[0];
        const actualReturnQty = removed ? (parseInt(removed.quantity_allocated) || 0) : returnQty;

        // 3. ALL WRITES AFTER ALL READS
        transaction.update(exRef, { allocated_stock: currentAllocated });

        if (prodRef && prodSnap && prodSnap.exists()) {
          const currentProdStock = prodSnap.data().stockLevel || 0;
          transaction.update(prodRef, { stockLevel: currentProdStock + actualReturnQty });

          // Log stock movement
          const movRef = doc(db, 'stock_movements', `mov-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`);
          transaction.set(movRef, {
            product_id: targetItem.product_id,
            movement_type: 'in',
            quantity: actualReturnQty,
            reference: `Allocation removed from event: ${exhibition.name} (stock returned to warehouse)`,
            moved_at: new Date().toISOString()
          });
        }
      });

      toast.success(`Removed ${productName} and returned ${returnQty} units to warehouse inventory!`);
    } catch (err) {
      console.error("Error removing allocated stock:", err);
      toast.error(`Failed to remove allocated stock: ${err.message}`);
    }
  };

  // Edit / Update allocated quantity
  const handleSaveEditedAllocation = async (e) => {
    e.preventDefault();
    if (!editingAllocatedItem) return;

    const { exhibitionId, exhibitionName, itemIndex, product_id, currentQty } = editingAllocatedItem;
    const newQty = parseInt(editAllocatedQty);

    if (isNaN(newQty) || newQty <= 0) {
      toast.error("Please enter a valid quantity greater than 0");
      return;
    }

    if (newQty === currentQty) {
      setEditingAllocatedItem(null);
      return;
    }

    const targetProduct = products.find(p => p.id === product_id);
    const diff = newQty - currentQty; // positive if allocating more, negative if returning

    // If increasing, ensure product has enough stock in warehouse
    if (diff > 0 && targetProduct && (targetProduct.stockLevel || 0) < diff) {
      toast.error(`Insufficient stock in warehouse. Only ${targetProduct.stockLevel || 0} additional units available.`);
      return;
    }

    setIsUpdatingAllocation(true);

    if (isMock) {
      setExhibitions(prev => prev.map(ex => {
        if (ex.id === exhibitionId) {
          const list = [...(ex.allocated_stock || [])];
          if (list[itemIndex]) {
            list[itemIndex] = { ...list[itemIndex], quantity_allocated: newQty };
          }
          return { ...ex, allocated_stock: list };
        }
        return ex;
      }));

      if (product_id) {
        setProducts(prev => prev.map(p => p.id === product_id ? { ...p, stockLevel: (p.stockLevel || 0) - diff } : p));
      }

      setIsUpdatingAllocation(false);
      setEditingAllocatedItem(null);
      toast.success(`Updated allocation to ${newQty} units!`);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const exRef = doc(db, 'exhibitions', exhibitionId);
        const exSnap = await transaction.get(exRef);
        if (!exSnap.exists()) throw new Error("Exhibition does not exist.");

        const currentAllocated = [...(exSnap.data().allocated_stock || [])];
        if (!currentAllocated[itemIndex]) throw new Error("Allocated item not found.");

        const actualCurrentQty = parseInt(currentAllocated[itemIndex].quantity_allocated) || currentQty;
        const actualDiff = newQty - actualCurrentQty;

        if (actualDiff !== 0 && product_id) {
          const prodRef = doc(db, 'products', product_id);
          const prodSnap = await transaction.get(prodRef);
          if (!prodSnap.exists()) throw new Error("Product not found.");

          const currentWarehouseStock = prodSnap.data().stockLevel || 0;

          if (actualDiff > 0 && currentWarehouseStock < actualDiff) {
            throw new Error(`Insufficient warehouse stock. Available: ${currentWarehouseStock}`);
          }

          transaction.update(prodRef, { stockLevel: currentWarehouseStock - actualDiff });

          // Log movement
          const movRef = doc(db, 'stock_movements', `mov-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`);
          transaction.set(movRef, {
            product_id,
            movement_type: actualDiff > 0 ? 'out' : 'in',
            quantity: Math.abs(actualDiff),
            reference: actualDiff > 0 
              ? `Additional stock allocated to event: ${exhibitionName}`
              : `Reduced event allocation from: ${exhibitionName} (returned to warehouse)`,
            moved_at: new Date().toISOString()
          });
        }

        currentAllocated[itemIndex] = {
          ...currentAllocated[itemIndex],
          quantity_allocated: newQty,
          product_name: targetProduct ? targetProduct.name : currentAllocated[itemIndex].product_name
        };

        transaction.update(exRef, { allocated_stock: currentAllocated });
      });

      toast.success(`Allocated stock updated to ${newQty} units!`);
      setEditingAllocatedItem(null);
    } catch (err) {
      console.error("Error updating allocated stock:", err);
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setIsUpdatingAllocation(false);
    }
  };

  const handleAddPackage = async (e) => {
    e.preventDefault();
    if (!showPackagesModal) return;

    if (!pkgName.trim()) {
      toast.error("Please enter a package name.");
      return;
    }

    const validItems = pkgItems.filter(item => item.product_id && parseInt(item.quantity) > 0);
    
    // Merge any duplicate products into a single entry with combined quantity
    const consolidatedMap = new Map();
    for (const item of validItems) {
      const q = parseInt(item.quantity) || 1;
      if (consolidatedMap.has(item.product_id)) {
        consolidatedMap.get(item.product_id).quantity += q;
      } else {
        consolidatedMap.set(item.product_id, {
          product_id: item.product_id,
          quantity: q
        });
      }
    }
    const consolidatedItems = Array.from(consolidatedMap.values());

    if (consolidatedItems.length < 2) {
      toast.error("A package bundle must contain at least 2 distinct products.");
      return;
    }

    const regularTotal = consolidatedItems.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.product_id);
      return sum + (prod ? (prod.sellingPrice || 0) * (parseInt(item.quantity) || 1) : 0);
    }, 0);

    let finalPrice = parseFloat(pkgPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      const disc = parseFloat(pkgDiscountPercent);
      if (!isNaN(disc) && disc > 0 && disc < 100) {
        finalPrice = Math.round((regularTotal * (1 - disc / 100)) * 100) / 100;
      } else {
        toast.error("Please provide either a valid package price or discount percentage.");
        return;
      }
    }

    const savings = Math.max(0, regularTotal - finalPrice);
    const discountPercentCalc = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

    const currentPackages = showPackagesModal.packages || [];
    const existingPkg = editingPackageId
      ? currentPackages.find(p => p.id === editingPackageId)
      : null;

    const newPkg = {
      id: editingPackageId || `pkg-${Date.now().toString(36)}`,
      name: pkgName.trim(),
      badge: pkgBadge.trim() || (savings > 0 ? `Save ₵${savings.toFixed(0)}` : null),
      items: consolidatedItems.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: prod ? prod.name : 'Product',
          quantity: parseInt(item.quantity) || 1,
          unit_price: prod ? (prod.sellingPrice || 0) : 0
        };
      }),
      regular_total: regularTotal,
      package_price: finalPrice,
      savings,
      discount_percent: discountPercentCalc,
      isActive: existingPkg ? existingPkg.isActive : true,
      createdAt: existingPkg ? existingPkg.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSavingPackage(true);
    try {
      const updatedPackages = editingPackageId
        ? currentPackages.map(p => p.id === editingPackageId ? newPkg : p)
        : [...currentPackages, newPkg];

      if (isMock) {
        setExhibitions(prev => prev.map(ex => ex.id === showPackagesModal.id ? { ...ex, packages: updatedPackages } : ex));
        setShowPackagesModal(prev => ({ ...prev, packages: updatedPackages }));
      } else {
        const exRef = doc(db, 'exhibitions', showPackagesModal.id);
        await updateDoc(exRef, { packages: updatedPackages });
        setShowPackagesModal(prev => ({ ...prev, packages: updatedPackages }));
      }

      toast.success(editingPackageId ? `Package "${newPkg.name}" updated successfully!` : `Package "${newPkg.name}" added successfully!`);
      resetPackageForm();
    } catch (err) {
      console.error("Failed to add package:", err);
      toast.error(`Failed to add package: ${err.message}`);
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleTogglePackageActive = async (packageId) => {
    if (!showPackagesModal) return;
    const currentPackages = showPackagesModal.packages || [];
    const updatedPackages = currentPackages.map(pkg => 
      pkg.id === packageId ? { ...pkg, isActive: !pkg.isActive } : pkg
    );

    try {
      if (isMock) {
        setExhibitions(prev => prev.map(ex => ex.id === showPackagesModal.id ? { ...ex, packages: updatedPackages } : ex));
        setShowPackagesModal(prev => ({ ...prev, packages: updatedPackages }));
      } else {
        const exRef = doc(db, 'exhibitions', showPackagesModal.id);
        await updateDoc(exRef, { packages: updatedPackages });
        setShowPackagesModal(prev => ({ ...prev, packages: updatedPackages }));
      }
      toast.success("Package status updated");
    } catch (err) {
      toast.error(`Update failed: ${err.message}`);
    }
  };

  const executeDeletePackage = async (packageId) => {
    if (!showPackagesModal) return;

    const currentPackages = showPackagesModal.packages || [];
    const updatedPackages = currentPackages.filter(pkg => pkg.id !== packageId);

    try {
      if (isMock) {
        setExhibitions(prev => prev.map(ex => ex.id === showPackagesModal.id ? { ...ex, packages: updatedPackages } : ex));
        setShowPackagesModal(prev => ({ ...prev, packages: updatedPackages }));
      } else {
        const exRef = doc(db, 'exhibitions', showPackagesModal.id);
        await updateDoc(exRef, { packages: updatedPackages });
        setShowPackagesModal(prev => ({ ...prev, packages: updatedPackages }));
      }
      toast.success("Package deleted successfully");
      setDeletingPackageId(null);
      if (editingPackageId === packageId) {
        resetPackageForm();
      }
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const handleReconcileClose = async (e) => {
    e.preventDefault();
    if (!selectedExhibition) return;

    // Validate inputs
    const updatedAllocatedStock = selectedExhibition.allocated_stock.map(item => {
      const returnedVal = returnedStockInputs[item.product_id] || 0;
      const returned = parseInt(returnedVal);
      if (returned < 0 || returned > item.quantity_allocated) {
        toast.error(`Invalid return quantity for ${item.product_name}. Must be between 0 and ${item.quantity_allocated}`);
        throw new Error("Validation failed");
      }
      return {
        ...item,
        quantity_returned: returned
      };
    });

    if (isMock) {
      // Simulate close & reconciliation
      setExhibitions(prev =>
        prev.map(ex => {
          if (ex.id === selectedExhibition.id) {
            return {
              ...ex,
              status: 'closed',
              allocated_stock: updatedAllocatedStock
            };
          }
          return ex;
        })
      );
      
      // Return stock back to mocks
      setBatches(prev =>
        prev.map(b => {
          const returnedItem = updatedAllocatedStock.find(item => item.batch_id === b.id);
          if (returnedItem) {
            return { ...b, quantity_remaining: b.quantity_remaining + returnedItem.quantity_returned };
          }
          return b;
        })
      );

      setShowReconcileForm(false);
      setReturnedStockInputs({});
      toast.success("Exhibition closed and stock returned to inventory (Sandbox)!");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const exRef = doc(db, 'exhibitions', selectedExhibition.id);

        // 1. ALL READS FIRST
        const batchSnaps = [];
        for (const item of updatedAllocatedStock) {
          if (item.quantity_returned > 0 && item.batch_id) {
            const batchRef = doc(db, 'batches', item.batch_id);
            const batchSnap = await transaction.get(batchRef);
            batchSnaps.push({ item, ref: batchRef, snap: batchSnap });
          }
        }

        // 2. ALL WRITES AFTER ALL READS
        transaction.update(exRef, {
          status: 'closed',
          allocated_stock: updatedAllocatedStock
        });

        for (const { item, ref: batchRef, snap: batchSnap } of batchSnaps) {
          if (batchSnap.exists()) {
            const currentQty = batchSnap.data().quantity_remaining || 0;
            transaction.update(batchRef, {
              quantity_remaining: currentQty + item.quantity_returned
            });

            // Log stock movement return
            const movRef = doc(db, 'stock_movements', `mov-${Date.now().toString(36)}-ret`);
            transaction.set(movRef, {
              product_id: item.product_id,
              batch_id: item.batch_id,
              movement_type: 'in',
              quantity: item.quantity_returned,
              reference: `Returned from event: ${selectedExhibition.name}`,
              moved_at: new Date().toISOString()
            });
          }
        }
      });

      setShowReconcileForm(false);
      setReturnedStockInputs({});
      toast.success("Exhibition reconciled and closed successfully!");
    } catch (err) {
      if (err.message !== "Validation failed") {
        console.error("Reconciliation failed:", err);
        toast.error("Failed to reconcile exhibition.");
      }
    }
  };

  return (
    <AuthShield requiredPermission="exhibition.manage">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-4">

          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-light text-bg-dark font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-gold/20 text-sm"
          >
            <Plus className="w-5 h-5" />
            Create Exhibition Event
          </button>
        </div>

        {/* Create Exhibition Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-amber-200 p-6 rounded-2xl w-full max-w-md space-y-6 text-gray-900 shadow-2xl">
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <h3 className="text-lg font-bold text-gray-900">Create Exhibition Event</h3>
                <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateExhibition} className="space-y-4 text-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-600 font-semibold">Exhibition/Event Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Accra Food & Honey Expo 2026"
                    className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3 py-2 rounded-lg text-gray-900 placeholder:text-gray-400"
                    value={newExhibition.name}
                    onChange={(e) => setNewExhibition({ ...newExhibition, name: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-600 font-semibold">Venue Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Accra Conference Centre"
                    className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3 py-2 rounded-lg text-gray-900 placeholder:text-gray-400"
                    value={newExhibition.venue}
                    onChange={(e) => setNewExhibition({ ...newExhibition, venue: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-600 font-semibold">Start Date</label>
                    <input
                      type="date"
                      required
                      className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3 py-2 rounded-lg text-gray-900"
                      value={newExhibition.start_date}
                      onChange={(e) => setNewExhibition({ ...newExhibition, start_date: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-600 font-semibold">End Date</label>
                    <input
                      type="date"
                      required
                      className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3 py-2 rounded-lg text-gray-900"
                      value={newExhibition.end_date}
                      onChange={(e) => setNewExhibition({ ...newExhibition, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-600 font-semibold">Event Discount (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 10"
                      className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3 py-2 rounded-lg text-gray-900 placeholder:text-gray-400 font-mono"
                      value={newExhibition.discount_percent}
                      onChange={(e) => setNewExhibition({ ...newExhibition, discount_percent: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-600 font-semibold">Target Revenue (GHS ₵)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3 py-2 rounded-lg text-gray-900 placeholder:text-gray-400 font-mono"
                      value={newExhibition.target_sales}
                      onChange={(e) => setNewExhibition({ ...newExhibition, target_sales: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-extrabold rounded-xl transition-all shadow-sm"
                  >
                    Create Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Allocate Stock Modal */}
        {showAllocateForm && selectedExhibition && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-amber-200 p-6 rounded-2xl w-full max-w-md space-y-6 text-gray-900 shadow-2xl">
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Allocate Stock</h3>
                  <p className="text-xs text-[#d07b00] font-semibold">{selectedExhibition.name}</p>
                </div>
                <button onClick={() => setShowAllocateForm(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAllocateStock} className="space-y-4 text-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-600 font-semibold">Select Product</label>
                  <select
                    required
                    className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3 py-2.5 rounded-lg text-gray-900 font-medium"
                    value={allocation.product_id}
                    onChange={(e) => setAllocation({ ...allocation, product_id: e.target.value })}
                  >
                    <option value="">-- Choose Product --</option>
                    {products.filter(p => p.stockLevel > 0).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {allocation.product_id && (() => {
                    const selProd = products.find(p => p.id === allocation.product_id);
                    if (!selProd) return null;
                    return (
                      <p className="text-[11px] text-gray-500 mt-1">
                        Available in Warehouse: <strong className="text-[#d07b00] font-mono font-bold">{selProd.stockLevel} units</strong>
                      </p>
                    );
                  })()}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-600 font-semibold">Transfer Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="20"
                    className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3 py-2 rounded-lg text-gray-900 font-mono font-bold"
                    value={allocation.quantity || ''}
                    onChange={(e) => setAllocation({ ...allocation, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAllocateForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-extrabold rounded-xl transition-all shadow-sm"
                  >
                    Allocate Custody
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Allocated Stock Modal */}
        {editingAllocatedItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-amber-200 p-6 rounded-2xl w-full max-w-md space-y-5 shadow-2xl text-gray-900">
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Edit Allocated Stock</h3>
                  <p className="text-xs text-[#d07b00] font-semibold mt-0.5">{editingAllocatedItem.exhibitionName}</p>
                </div>
                <button 
                  onClick={() => setEditingAllocatedItem(null)} 
                  className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditedAllocation} className="space-y-4 text-sm">
                <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Product</span>
                  <p className="font-bold text-gray-900 text-sm">{editingAllocatedItem.product_name}</p>
                  
                  <div className="flex justify-between text-xs pt-2 border-t border-amber-200/60 mt-2">
                    <span className="text-gray-600">Currently Allocated:</span>
                    <span className="font-bold text-[#d07b00] font-mono">{editingAllocatedItem.currentQty} units</span>
                  </div>

                  {(() => {
                    const prod = products.find(p => p.id === editingAllocatedItem.product_id);
                    return (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Available in Warehouse:</span>
                        <span className="font-bold text-gray-900 font-mono">{prod?.stockLevel ?? 0} units</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-600 font-semibold">New Allocated Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="bg-gray-50 border border-gray-300 focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-gray-900 font-mono text-base font-bold outline-none"
                    value={editAllocatedQty}
                    onChange={(e) => setEditAllocatedQty(e.target.value)}
                  />
                  {(() => {
                    const newQ = parseInt(editAllocatedQty) || 0;
                    const diff = newQ - editingAllocatedItem.currentQty;
                    if (diff > 0) {
                      return (
                        <p className="text-[11px] text-amber-700 mt-1 font-medium">
                          ⚠️ Will deduct <strong>{diff} additional units</strong> from warehouse inventory.
                        </p>
                      );
                    } else if (diff < 0) {
                      return (
                        <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                          ↩️ Will return <strong>{Math.abs(diff)} units</strong> back to warehouse inventory.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingAllocatedItem(null)}
                    disabled={isUpdatingAllocation}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingAllocation}
                    className="flex-1 px-4 py-2.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-extrabold rounded-xl transition-all shadow-sm text-xs flex items-center justify-center gap-2"
                  >
                    {isUpdatingAllocation ? 'Updating...' : 'Save Allocation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Close & Reconcile Modal */}
        {showReconcileForm && selectedExhibition && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-amber-200 p-6 rounded-2xl w-full max-w-lg space-y-6 text-gray-900 shadow-2xl">
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Reconcile & Close Event</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This will return remaining unsold stock to warehouse</p>
                </div>
                <button onClick={() => setShowReconcileForm(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReconcileClose} className="space-y-4 text-xs">
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {selectedExhibition.allocated_stock.map(item => (
                    <div key={item.product_id} className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-gray-900">{item.product_name}</p>
                        <p className="text-[10px] text-[#d07b00] font-semibold mt-1">Allocated: {item.quantity_allocated} units</p>
                      </div>
                      
                      <div className="flex flex-col gap-1 w-32">
                        <label className="text-[10px] text-gray-500 font-semibold text-right">Returned Units</label>
                        <input
                          type="number"
                          required
                          min="0"
                          max={item.quantity_allocated}
                          placeholder="e.g. 15"
                          className="w-full bg-white border border-gray-300 focus:border-[#ffa200] px-2.5 py-1.5 rounded-lg text-right text-gray-900 font-mono font-bold"
                          value={returnedStockInputs[item.product_id] ?? ''}
                          onChange={(e) => setReturnedStockInputs({
                            ...returnedStockInputs,
                            [item.product_id]: e.target.value
                          })}
                        />
                      </div>
                    </div>
                  ))}

                  {selectedExhibition.allocated_stock.length === 0 && (
                    <p className="text-center italic text-gray-500">No stock was allocated to this event. You can close it instantly.</p>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReconcileForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-300 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-extrabold rounded-xl transition-all duration-300 text-sm shadow-sm"
                  >
                    Reconcile & Close Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Exhibitions Registry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exhibitions.map((ex) => {
            const isActive = ex.status === 'active';
            
            return (
              <div 
                key={ex.id}
                className={`bg-bg-card border rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-gold/5 transition-all duration-300 ${
                  isActive ? 'border-gold/15' : 'border-gold/5 opacity-70'
                }`}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-gold/10 pb-3">
                    <div>
                      <h3 className="font-semibold text-white text-base leading-snug">{ex.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-gold font-medium mt-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{ex.venue}</span>
                      </div>
                    </div>
                    
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      isActive 
                        ? 'bg-gold/15 text-gold' 
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {ex.status}
                    </span>
                  </div>

                  {/* Date range & Target */}
                  <div className="grid grid-cols-2 gap-4 text-xs text-text-muted">
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted/60 uppercase block font-medium">Event Dates</span>
                      <p className="font-medium text-white flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gold" />
                        {ex.start_date} to {ex.end_date}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted/60 uppercase block font-medium">Event Discount</span>
                      <p className="font-semibold text-gold font-mono">{ex.discount_percent}% Off Checkout</p>
                    </div>
                  </div>

                  {/* Stock allocated display */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Boxes className="w-3.5 h-3.5 text-gold/60" /> Allocated Event Stock
                      </h4>
                      {hasDuplicateAllocations(ex.allocated_stock) && isActive && (
                        <button
                          type="button"
                          onClick={() => handleConsolidateStock(ex)}
                          className="text-[10px] text-gold hover:text-gold-dark font-semibold underline cursor-pointer"
                          title="Merge duplicate product allocations into clean single rows"
                        >
                          Consolidate Duplicates
                        </button>
                      )}
                    </div>
                    
                    <div className="bg-bg-dark/40 border border-gold/5 rounded-xl p-2.5 max-h-48 overflow-y-auto space-y-1.5">
                      {(ex.allocated_stock || []).map((item, idx) => {
                        const sysProduct = products.find(p => p.id === item.product_id);
                        const cleanName = sysProduct ? sysProduct.name : (item.product_name || 'Product');

                        return (
                          <div key={idx} className="flex justify-between items-center text-xs py-1.5 px-2 rounded-lg bg-bg-card/40 hover:bg-gold/5 border border-gold/5 transition group">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-semibold text-white text-xs truncate" title={cleanName}>
                                {cleanName}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[11px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-md">
                                {item.quantity_allocated} units
                              </span>
                              {ex.status === 'closed' && (
                                <span className="text-[10px] text-text-muted">({item.quantity_returned} ret)</span>
                              )}

                              {isActive && (
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingAllocatedItem({
                                        exhibitionId: ex.id,
                                        exhibitionName: ex.name,
                                        itemIndex: idx,
                                        product_id: item.product_id,
                                        currentQty: parseInt(item.quantity_allocated) || 0,
                                        product_name: cleanName
                                      });
                                      setEditAllocatedQty(item.quantity_allocated.toString());
                                    }}
                                    className="p-1 rounded hover:bg-gold/20 text-gold hover:text-gold-light transition"
                                    title="Edit Allocated Quantity"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAllocatedStock(ex, idx)}
                                    className="p-1 rounded hover:bg-gold/20 text-text-muted hover:text-gold transition"
                                    title="Remove from Event & Return to Stock"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {(ex.allocated_stock || []).length === 0 && (
                        <p className="text-[11px] text-text-muted italic text-center py-2">No stock allocated to custody yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Configured Packages & Bundles */}
                  {ex.packages && ex.packages.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <h4 className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-gold" /> Event Packages ({ex.packages.length})</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPackagesModal(ex);
                            resetPackageForm();
                          }}
                          className="text-gold hover:underline text-[10px] lowercase"
                        >
                          manage
                        </button>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {ex.packages.map(pkg => (
                          <span
                            key={pkg.id}
                            className={`inline-flex items-center gap-1.5 border px-2.5 py-1 rounded-lg text-xs font-medium dark-pill shadow-xs transition ${
                              pkg.isActive !== false 
                                ? 'bg-[#18181b] border-zinc-800 text-white' 
                                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 opacity-60'
                            }`}
                          >
                            <span className="font-semibold text-white truncate max-w-[130px]">{pkg.name}</span>
                            <span className="font-mono text-white font-bold">₵{Number(pkg.package_price).toFixed(2)}</span>
                            {pkg.badge && (
                              <span className="bg-white/20 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                {pkg.badge}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Operations buttons */}
                {isActive ? (
                  <div className="flex flex-wrap gap-2.5 pt-3 border-t border-gold/5">
                    <button
                      onClick={() => {
                        setSelectedExhibition(ex);
                        setShowAllocateForm(true);
                      }}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-2.5 border border-gold/10 hover:border-gold/30 rounded-xl text-xs font-semibold text-gold hover:bg-gold/5 transition-all duration-300"
                    >
                      <Truck className="w-3.5 h-3.5" /> Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPackagesModal(ex);
                        resetPackageForm();
                      }}
                      className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-400 transition cursor-pointer shadow-xs"
                      title="Manage Event Package Bundles & Discounts"
                    >
                      <Gift className="w-3.5 h-3.5 text-gold" />
                      <span>Packages ({ex.packages?.length || 0})</span>
                    </button>
                    <button
                      onClick={() => setShowQRModal(ex)}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-2.5 bg-gold/10 hover:bg-gold/20 border border-gold/30 rounded-xl text-xs font-bold text-gold transition-all duration-300 shadow-sm"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Stand Card & QR
                    </button>
                    {/* Live Booth Orders & Stock Sold Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowOrdersModal(ex);
                        setOrdersModalTab('stock');
                        setOrdersSearchQuery('');
                      }}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-400 transition cursor-pointer shadow-xs"
                      title="View Stock Sold & Live Booth Orders"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-gold" />
                      <span>Stock Sold ({orders.filter(o => o.exhibitionId === ex.id || o.exhibitionSlug === (ex.slug || ex.id) || (o.orderType === 'booth_pickup' && o.exhibitionId === ex.id)).length})</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedExhibition(ex);
                        setReturnedStockInputs({});
                        setShowReconcileForm(true);
                      }}
                      className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-2.5 bg-gold hover:bg-gold-light text-bg-dark font-bold rounded-xl text-xs transition-all duration-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reconcile
                    </button>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-gold/5 flex flex-wrap justify-between items-center gap-2 text-xs text-text-muted font-medium">
                    <span>Target Revenue: ₵{ex.target_sales.toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowOrdersModal(ex);
                          setOrdersModalTab('stock');
                          setOrdersSearchQuery('');
                        }}
                        className="flex items-center gap-1.5 py-1 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-400 transition cursor-pointer"
                        title="View Stock Sold History"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-gold" />
                        <span>Stock Sold ({orders.filter(o => o.exhibitionId === ex.id || o.exhibitionSlug === (ex.slug || ex.id) || (o.orderType === 'booth_pickup' && o.exhibitionId === ex.id)).length})</span>
                      </button>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Reconciled
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* PRINTABLE ACRYLIC TABLE STAND CARD MODAL (PORTALED TO DOCUMENT.BODY) */}
        {showQRModal && mounted && createPortal(
          <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowQRModal(null);
            }}
          >
            {/* Embedded Print CSS */}
            <style jsx global>{`
              @page {
                size: A5 portrait;
                margin: 0;
              }
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100vw !important;
                  height: 100vh !important;
                  background: #ffffff !important;
                  overflow: hidden !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #booth-stand-card-print, #booth-stand-card-print * {
                  visibility: visible !important;
                }
                #booth-stand-card-print {
                  position: fixed !important;
                  top: 0 !important;
                  bottom: 0 !important;
                  left: 0 !important;
                  right: 0 !important;
                  margin: auto !important;
                  width: 92% !important;
                  max-width: 520px !important;
                  height: fit-content !important;
                  max-height: 92vh !important;
                  padding: 28px 24px !important;
                  border: 3px solid #ffa200 !important;
                  border-radius: 24px !important;
                  box-shadow: none !important;
                  background: #ffffff !important;
                  color: #111111 !important;
                  box-sizing: border-box !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .no-print-area {
                  display: none !important;
                }
              }
            `}</style>

            <div className="max-w-xl w-full relative space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Floating Close Button directly on the top-right of the white card */}
              <button 
                type="button"
                onClick={() => setShowQRModal(null)} 
                className="absolute -top-3 -right-3 z-30 w-9 h-9 bg-black hover:bg-neutral-800 text-white hover:text-[#ffa200] border-2 border-[#ffa200] rounded-full flex items-center justify-center shadow-2xl transition hover:scale-110 cursor-pointer no-print-area"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* THE PHYSICAL TABLE STAND CARD PREVIEW (PRINT TARGET - PURE WHITE) */}
              <div 
                id="booth-stand-card-print"
                className="bg-white text-gray-900 rounded-2xl p-7 border-2 border-[#ffa200] shadow-2xl text-center space-y-4 relative overflow-hidden"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {/* Honey Palace Branding with Official Logo & Motto */}
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

                {/* Event Name & Venue (Zero cream - Pure White with Gold Border) */}
                <div className="bg-white rounded-xl p-3.5 border-2 border-[#ffa200] shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-[#d07b00] tracking-wider">Official Booth Special At</p>
                  <h1 className="text-lg font-black text-gray-900 leading-tight mt-0.5">{showQRModal.name}</h1>
                  {showQRModal.venue && (
                    <p className="text-xs text-gray-600 font-medium mt-1 flex items-center justify-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#ffa200] inline shrink-0" /> {showQRModal.venue}
                    </p>
                  )}
                </div>

                {/* The QR Code - Very Big & Prominent for Booth Scanning */}
                <div className="flex flex-col items-center justify-center my-2">
                  <div className="p-4 sm:p-5 bg-white border-4 border-[#ffa200] rounded-3xl shadow-lg inline-block">
                    <QRCodeSVG
                      value={`https://thehoneypalaceafrica.com/expo/${showQRModal.slug || showQRModal.id}`}
                      size={280}
                      bgColor="#ffffff"
                      fgColor="#111111"
                      level="Q"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-sm sm:text-base font-black text-gray-900 tracking-wide mt-2.5">
                    Scan For Special Discounts
                  </p>
                </div>

                {/* 3 Simple Customer Steps (Clean White Card) */}
                <div className="grid grid-cols-3 gap-2 text-left bg-white p-3 rounded-xl border border-gray-200 text-[10px] shadow-xs">
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#ffa200] text-white font-black flex items-center justify-center shrink-0 text-[10px]">1</span>
                    <span className="text-gray-700 leading-tight"><strong>Scan QR</strong> with your camera</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#ffa200] text-white font-black flex items-center justify-center shrink-0 text-[10px]">2</span>
                    <span className="text-gray-700 leading-tight"><strong>Pay via MoMo</strong> or Card instantly</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#ffa200] text-white font-black flex items-center justify-center shrink-0 text-[10px]">3</span>
                    <span className="text-gray-700 leading-tight"><strong>Collect Honey</strong> at our table!</span>
                  </div>
                </div>

                {/* Contact and Website in Poppins - Phone Strictly on One Single Line */}
                <div 
                  className="text-[10px] sm:text-[11px] text-gray-700 pt-2.5 border-t border-gray-100 flex flex-col sm:flex-row print:flex-row items-center justify-between gap-1.5 sm:gap-2 font-medium" 
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

              {/* Action Buttons: Single Long Card with White Background */}
              <div className="bg-white rounded-2xl p-2.5 border-2 border-[#ffa200] shadow-xl no-print-area grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-3 px-3 bg-[#ffa200] hover:bg-[#ffb020] active:scale-[0.98] text-gray-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-gray-950 shrink-0" /> 
                  <span>Print Stand (A5)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = `https://thehoneypalaceafrica.com/expo/${showQRModal.slug || showQRModal.id}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Booth Expo link copied to clipboard!");
                  }}
                  className="py-3 px-3 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] text-gray-900 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-gray-200 transition cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-[#ffa200] shrink-0" /> 
                  <span>Copy Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = `https://thehoneypalaceafrica.com/expo/${showQRModal.slug || showQRModal.id}`;
                    window.open(url, '_blank');
                  }}
                  className="py-3 px-3 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] text-gray-900 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-gray-200 transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-gray-600 shrink-0" /> 
                  <span>Open Store</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* LIVE BOOTH ORDERS & STOCK SOLD MODAL (PORTALED TO DOCUMENT.BODY) */}
        {showOrdersModal && mounted && createPortal(
          <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowOrdersModal(null);
            }}
          >
            {(() => {
              const boothOrders = orders.filter(o => 
                o.exhibitionId === showOrdersModal.id || 
                o.exhibitionSlug === (showOrdersModal.slug || showOrdersModal.id) || 
                (o.orderType === 'booth_pickup' && o.exhibitionId === showOrdersModal.id)
              );

              let totalUnitsSold = 0;
              let totalRevenue = 0;
              let pendingCount = 0;
              let handedOverCount = 0;
              const productSalesMap = {};

              boothOrders.forEach(ord => {
                const isHandedOver = ord.status === 'handed_over' || ord.status === 'fulfilled';
                if (isHandedOver) handedOverCount++;
                else pendingCount++;

                const amt = Number(ord.totalAmount || ord.subtotal || ord.total || 0);
                totalRevenue += amt;

                (ord.items || ord.cartItems || []).forEach(it => {
                  const key = it.product_id || it.id || (it.name || '').trim().toLowerCase() || 'unknown';
                  const qty = parseInt(it.quantity) || 1;
                  const prc = parseFloat(it.price || it.unitPrice || 0);
                  totalUnitsSold += qty;

                  if (!productSalesMap[key]) {
                    productSalesMap[key] = {
                      id: it.product_id || it.id,
                      name: it.name || 'Product',
                      unitsSold: 0,
                      revenue: 0,
                      unitPrice: prc
                    };
                  }
                  productSalesMap[key].unitsSold += qty;
                  productSalesMap[key].revenue += (qty * prc);
                });
              });

              // Allocated stock calculations
              const allocatedList = showOrdersModal.allocated_stock || [];
              let totalAllocatedUnits = 0;
              const matchedKeys = new Set();

              const stockBreakdown = allocatedList.map(alloc => {
                const allocated = parseInt(alloc.quantity_allocated) || 0;
                totalAllocatedUnits += allocated;

                const byId = productSalesMap[alloc.product_id];
                const byName = Object.entries(productSalesMap).find(([k, v]) => 
                  v.name.toLowerCase() === (alloc.product_name || '').toLowerCase()
                );

                let sale = { unitsSold: 0, revenue: 0 };
                if (byId) {
                  sale = byId;
                  matchedKeys.add(alloc.product_id);
                } else if (byName) {
                  sale = byName[1];
                  matchedKeys.add(byName[0]);
                }

                const sold = sale.unitsSold;
                const remaining = Math.max(0, allocated - sold);
                const percentSold = allocated > 0 ? Math.min(100, Math.round((sold / allocated) * 100)) : 0;

                return {
                  name: alloc.product_name,
                  batch: alloc.batch_number,
                  allocated,
                  sold,
                  remaining,
                  revenue: sale.revenue,
                  percentSold,
                  unallocated: false
                };
              });

              // Any items sold that were not in allocated_stock
              Object.entries(productSalesMap).forEach(([k, sale]) => {
                if (!matchedKeys.has(k)) {
                  stockBreakdown.push({
                    name: sale.name,
                    batch: null,
                    allocated: 0,
                    sold: sale.unitsSold,
                    remaining: 0,
                    revenue: sale.revenue,
                    percentSold: 100,
                    unallocated: true
                  });
                }
              });

              // Filtered list of products for Tab 1
              const filteredStock = stockBreakdown.filter(item => {
                if (!ordersSearchQuery.trim()) return true;
                return item.name.toLowerCase().includes(ordersSearchQuery.toLowerCase());
              });

              // Filtered list of orders for Tab 2
              const filteredOrders = boothOrders.filter(ord => {
                if (ordersFilterStatus === 'pending') {
                  if (ord.status === 'handed_over' || ord.status === 'fulfilled') return false;
                } else if (ordersFilterStatus === 'handed_over') {
                  if (ord.status !== 'handed_over' && ord.status !== 'fulfilled') return false;
                }
                if (ordersSearchQuery.trim()) {
                  const q = ordersSearchQuery.toLowerCase();
                  const orderNum = (ord.order_number || ord.orderId || '').toLowerCase();
                  const custName = (ord.customerName || '').toLowerCase();
                  const custPhone = (ord.customerPhone || '').toLowerCase();
                  const itemsMatch = (ord.items || ord.cartItems || []).some(it => (it.name || '').toLowerCase().includes(q));
                  if (!orderNum.includes(q) && !custName.includes(q) && !custPhone.includes(q) && !itemsMatch) {
                    return false;
                  }
                }
                return true;
              });

              const targetRevenue = Number(showOrdersModal.target_sales || 0);
              const targetProgress = targetRevenue > 0 ? Math.min(100, Math.round((totalRevenue / targetRevenue) * 100)) : 0;

              const formatOrderTime = (createdAt) => {
                if (!createdAt) return 'Live Booth Order';
                try {
                  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                } catch {
                  return 'Live Booth Order';
                }
              };

              return (
                <div className="bg-white border-2 border-amber-300 rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl space-y-5 h-[92vh] max-h-[92vh] flex flex-col text-gray-900">
                  
                  {/* Header */}
                  <div className="flex items-start justify-between pb-4 border-b border-gray-200 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#d07b00] shrink-0">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                            Booth Stock Sold & Live Pickups
                          </h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            showOrdersModal.status === 'active' 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {showOrdersModal.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#d07b00]" />
                          <span className="font-semibold text-gray-800">{showOrdersModal.name}</span>
                          <span>•</span>
                          <span className="text-gray-500">{showOrdersModal.venue || 'Exhibition Stand'}</span>
                        </p>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => setShowOrdersModal(null)} 
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 rounded-full transition cursor-pointer shrink-0"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Card 1: Total Stock Sold */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                        <span>Total Stock Sold</span>
                        <Package className="w-4 h-4 text-[#d07b00]" />
                      </div>
                      <div className="text-2xl font-black text-gray-900 font-mono">{totalUnitsSold} <span className="text-xs font-sans text-gray-500 font-normal">units</span></div>
                      <div className="text-[11px] text-amber-800 font-medium">Across {boothOrders.length} customer order{boothOrders.length === 1 ? '' : 's'}</div>
                    </div>

                    {/* Card 2: Total Revenue */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                        <span>Booth Revenue</span>
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-black text-[#d07b00] font-mono">GHS {totalRevenue.toFixed(2)}</div>
                      <div className="text-[11px] text-gray-500">Collected via Stand QR Paystack</div>
                    </div>

                    {/* Card 3: Table Handovers */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                        <span>Table Pickups</span>
                        <Truck className="w-4 h-4 text-sky-600" />
                      </div>
                      <div className="text-2xl font-black text-gray-900 font-mono">
                        {pendingCount} <span className="text-xs font-sans text-amber-600 font-bold">Pending</span>
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold">{handedOverCount} order{handedOverCount === 1 ? '' : 's'} handed over</div>
                    </div>

                    {/* Card 4: Target Progress */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                        <span>Target Progress</span>
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="text-2xl font-black text-gray-900 font-mono">{targetProgress}%</div>
                      <div className="text-[11px] text-gray-500">Target: GHS {targetRevenue.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Navigation Tabs & Search Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-b border-gray-200 pb-3">
                    <div className="flex items-center gap-1.5 p-1 bg-gray-100 border border-gray-200 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setOrdersModalTab('stock')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          ordersModalTab === 'stock'
                            ? 'bg-[#ffa200] text-black font-extrabold shadow-sm'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                        }`}
                      >
                        <Boxes className="w-4 h-4" />
                        <span>Stock Sold by Product</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${ordersModalTab === 'stock' ? 'bg-black/20 text-black' : 'bg-gray-200 text-gray-700'}`}>
                          {stockBreakdown.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrdersModalTab('orders')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          ordersModalTab === 'orders'
                            ? 'bg-[#ffa200] text-black font-extrabold shadow-sm'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Live Orders & Pickups</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${ordersModalTab === 'orders' ? 'bg-black/20 text-black' : 'bg-gray-200 text-gray-700'}`}>
                          {boothOrders.length}
                        </span>
                      </button>
                    </div>

                    {/* Search Field */}
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder={ordersModalTab === 'stock' ? 'Search product name...' : 'Search order #, client, phone...'}
                        value={ordersSearchQuery}
                        onChange={(e) => setOrdersSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-white border border-gray-300 focus:border-[#ffa200] focus:ring-2 focus:ring-[#ffa200]/20 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none"
                      />
                      {ordersSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setOrdersSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TAB 1: STOCK SOLD BY PRODUCT */}
                  {ordersModalTab === 'stock' && (
                    <div 
                      className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[260px]"
                      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255, 162, 0, 0.4) transparent' }}
                    >
                      {filteredStock.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Boxes className="w-12 h-12 text-amber-500/40 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-gray-900">No products found for this booth.</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {ordersSearchQuery ? 'Try clearing your search query.' : 'Allocate stock to this booth using the Stock button on the main card.'}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredStock.map((item, idx) => (
                            <div 
                              key={idx}
                              className="bg-white border-2 border-gray-200 hover:border-amber-300 rounded-2xl p-4 transition space-y-3 shadow-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
                                  {item.batch ? (
                                    <span className="text-[10px] font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 inline-block mt-1">
                                      Batch: {item.batch}
                                    </span>
                                  ) : item.unallocated && (
                                    <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded inline-block mt-1 font-semibold">
                                      Ad-hoc / Walk-in Sale
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold font-mono text-[#d07b00]">
                                    GHS {item.revenue.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-gray-500 block font-medium">Sales Revenue</span>
                                </div>
                              </div>

                              {/* Key Numbers Grid */}
                              <div className="grid grid-cols-3 gap-2 bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-center">
                                <div>
                                  <span className="text-[10px] text-gray-500 block font-semibold uppercase tracking-wider">Allocated</span>
                                  <span className="font-mono font-bold text-gray-800 text-xs">{item.allocated} units</span>
                                </div>
                                <div className="border-x border-gray-200">
                                  <span className="text-[10px] text-[#d07b00] block font-bold uppercase tracking-wider">Sold</span>
                                  <span className="font-mono font-extrabold text-[#d07b00] text-xs">{item.sold} units</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-emerald-700 block font-bold uppercase tracking-wider">Remaining</span>
                                  <span className="font-mono font-extrabold text-emerald-700 text-xs">{item.remaining} units</span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div>
                                <div className="flex justify-between text-[11px] font-medium mb-1">
                                  <span className="text-gray-500">Sell-through Rate</span>
                                  <span className="font-mono font-bold text-[#d07b00]">{item.percentSold}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className="bg-gradient-to-r from-amber-500 to-[#ffa200] h-full rounded-full transition-all duration-500"
                                    style={{ width: `${item.percentSold}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: LIVE ORDERS & PICKUPS */}
                  {ordersModalTab === 'orders' && (
                    <div className="flex-1 flex flex-col space-y-3 overflow-hidden min-h-[260px]">
                      {/* Filter Pills */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setOrdersFilterStatus('all')}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            ordersFilterStatus === 'all'
                              ? 'bg-gray-900 text-white font-bold'
                              : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          All ({boothOrders.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrdersFilterStatus('pending')}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            ordersFilterStatus === 'pending'
                              ? 'bg-[#ffa200] text-black font-bold'
                              : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Pending Handover ({pendingCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrdersFilterStatus('handed_over')}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            ordersFilterStatus === 'handed_over'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                              : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Handed Over ({handedOverCount})
                        </button>
                      </div>

                      {/* Orders List */}
                      <div 
                        className="flex-1 overflow-y-auto space-y-3 pr-1"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255, 162, 0, 0.4) transparent' }}
                      >
                        {filteredOrders.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <QrCode className="w-12 h-12 text-amber-500/40 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-gray-900">No orders matching your filters.</p>
                            <p className="text-xs text-gray-500 mt-1">When visitors scan your stand QR code and pay via Paystack, orders will update live here!</p>
                          </div>
                        ) : (
                          filteredOrders.map((ord) => {
                            const isHandedOver = ord.status === 'handed_over' || ord.status === 'fulfilled';
                            const orderTotal = Number(ord.totalAmount || ord.subtotal || ord.total || 0);

                            return (
                              <div 
                                key={ord.id || ord.orderId}
                                className={`p-4 rounded-2xl border transition shadow-sm space-y-3 ${
                                  isHandedOver 
                                    ? 'bg-gray-50 border-gray-200' 
                                    : 'bg-amber-50/40 border-2 border-amber-200'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-200">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-xs font-extrabold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md">
                                        #{ord.order_number || ord.orderId}
                                      </span>
                                      <span className="text-sm text-gray-900 font-bold">{ord.customerName || 'Booth Customer'}</span>
                                      {ord.customerPhone && (
                                        <a 
                                          href={`tel:${ord.customerPhone}`}
                                          className="text-[11px] text-gray-600 hover:text-amber-800 font-mono flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition"
                                        >
                                          <Phone className="w-3 h-3 text-[#d07b00]" />
                                          <span>{ord.customerPhone}</span>
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5 font-medium">
                                      <Clock className="w-3 h-3 text-gray-400" />
                                      <span>{formatOrderTime(ord.createdAt)}</span>
                                      <span>•</span>
                                      <span className="text-emerald-700 font-semibold">Paid via Paystack</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3">
                                    <span className="text-sm font-black font-mono text-gray-900 bg-white border border-gray-200 px-2.5 py-1 rounded-xl">
                                      GHS {orderTotal.toFixed(2)}
                                    </span>

                                    {isHandedOver ? (
                                      <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-emerald-200 shrink-0">
                                        <CheckCircle className="w-3.5 h-3.5" /> Handed Over
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            if (db && ord.id) {
                                              await updateDoc(doc(db, 'orders', ord.id), {
                                                status: 'handed_over',
                                                handedOverAt: new Date().toISOString()
                                              });
                                              toast.success(`Order #${ord.order_number || ord.orderId} marked as handed over!`);
                                            }
                                          } catch (err) {
                                            console.error("Failed to mark order as handed over:", err);
                                            toast.error("Could not update order status.");
                                          }
                                        }}
                                        className="text-xs bg-[#ffa200] hover:bg-[#d07b00] active:scale-95 text-black font-extrabold px-4 py-1.5 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer shrink-0"
                                      >
                                        <Package className="w-3.5 h-3.5" /> Mark Handed Over
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Items summary */}
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {(ord.items || ord.cartItems || []).map((it, idx) => (
                                    <div 
                                      key={idx} 
                                      className="flex items-center gap-2 bg-white border border-gray-200 px-2.5 py-1 rounded-xl text-xs"
                                    >
                                      <span className="font-mono font-black text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                                        {it.quantity}x
                                      </span>
                                      <span className="text-gray-800 font-medium">{it.name}</span>
                                      <span className="text-gray-500 font-mono text-[11px]">
                                        ₵{((it.price || 0) * (it.quantity || 1)).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>,
          document.body
        )}

        {/* EVENT PACKAGES & BUNDLES MODAL */}
        {showPackagesModal && mounted && createPortal(
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowPackagesModal(null);
                setDeletingPackageId(null);
              }
            }}
          >
            <div 
              className="bg-white border-2 border-amber-200 w-full max-w-4xl rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-gray-900 animate-in fade-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-4 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2.5 bg-amber-50 text-[#d07b00] rounded-xl border border-amber-200">
                      <Gift className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                        Event Packages & Bundles
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Create special multi-product bundles and package discounts for <strong className="text-[#d07b00] font-semibold">{showPackagesModal.name}</strong>
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPackagesModal(null);
                    setDeletingPackageId(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Two Columns on desktop */}
              <div className="space-y-6 pr-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left: Existing Packages List (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#ffa200]" /> Configured Packages ({showPackagesModal.packages?.length || 0})
                    </h4>
                  </div>

                  {(!showPackagesModal.packages || showPackagesModal.packages.length === 0) ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center space-y-2">
                      <Gift className="w-8 h-8 text-amber-500/60 mx-auto" />
                      <p className="text-xs font-bold text-gray-900">No Packages Created Yet</p>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Use the builder on the right to bundle 2 or more products with a special event discount.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {showPackagesModal.packages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className={`border-2 rounded-2xl p-4 space-y-3 transition ${
                            editingPackageId === pkg.id
                              ? 'bg-amber-50/30 border-[#ffa200] ring-2 ring-[#ffa200]/30 shadow-md'
                              : pkg.isActive !== false
                              ? 'bg-white border-amber-200 hover:border-[#ffa200] shadow-sm'
                              : 'bg-gray-50 border-gray-200 opacity-60'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-bold text-sm text-gray-900">{pkg.name}</h5>
                                {pkg.badge && (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                                    {pkg.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {pkg.items?.length || 0} Products Included
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditPackage(pkg)}
                                className={`p-1 rounded-lg transition cursor-pointer ${
                                  editingPackageId === pkg.id
                                    ? 'bg-[#ffa200] text-black font-bold'
                                    : 'hover:bg-amber-50 text-gray-400 hover:text-[#d07b00]'
                                }`}
                                title="Edit Package"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTogglePackageActive(pkg.id)}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                                  pkg.isActive !== false
                                    ? 'bg-[#ffa200]/15 border-[#ffa200]/40 text-[#945500]'
                                    : 'bg-gray-100 border-gray-200 text-gray-500'
                                }`}
                                title="Toggle Active Status"
                              >
                                {pkg.isActive !== false ? 'Active' : 'Paused'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingPackageId(deletingPackageId === pkg.id ? null : pkg.id)}
                                className={`p-1 rounded-lg transition cursor-pointer ${
                                  deletingPackageId === pkg.id
                                    ? 'bg-red-100 text-red-600'
                                    : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                                }`}
                                title="Delete Package"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Inline Delete Confirmation on the card */}
                          {deletingPackageId === pkg.id && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2 text-xs animate-in fade-in duration-150">
                              <div className="flex items-start gap-2">
                                <span className="p-1 bg-red-100 text-red-600 rounded-lg shrink-0 mt-0.5">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </span>
                                <div>
                                  <p className="font-bold text-red-900">Delete Package</p>
                                  <p className="text-[11px] text-red-700">Are you sure you want to remove this package bundle from the event?</p>
                                </div>
                              </div>
                              <div className="flex justify-end items-center gap-2 pt-1 border-t border-red-200/60">
                                <button
                                  type="button"
                                  onClick={() => setDeletingPackageId(null)}
                                  className="px-3 py-1 text-xs font-semibold bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => executeDeletePackage(pkg.id)}
                                  className="px-3 py-1 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition cursor-pointer shadow-sm"
                                >
                                  Delete Package
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Items included */}
                          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-2.5 space-y-1.5 text-xs">
                            {pkg.items?.map((it, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px]">
                                <span className="text-gray-800">
                                  <strong className="text-[#d07b00] font-mono">{it.quantity}x</strong> {it.product_name}
                                </span>
                                <span className="text-gray-500 font-mono">
                                  ₵{((it.unit_price || 0) * (it.quantity || 1)).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Pricing breakdown */}
                          <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                            <div>
                              <span className="text-[10px] text-gray-500 block">Regular Price</span>
                              <span className="line-through text-gray-400 font-mono text-xs">
                                ₵{Number(pkg.regular_total || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-[#945500] font-black block">
                                Save ₵{Number(pkg.savings || 0).toFixed(2)} ({pkg.discount_percent}%)
                              </span>
                              <span className="text-base font-extrabold text-[#d07b00] font-mono">
                                ₵{Number(pkg.package_price || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Add New Package Form (7 cols) */}
                <div id="package-builder-form" className="lg:col-span-7 bg-gray-50 border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-5">
                  <div className="border-b border-gray-200 pb-3 flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        {editingPackageId ? (
                          <>
                            <Pencil className="w-4 h-4 text-[#d07b00]" /> Edit Event Package
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-[#d07b00]" /> Create New Event Package
                          </>
                        )}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {editingPackageId
                          ? 'Modify bundled products and promotional package pricing.'
                          : 'Select bundled products and set your promotional package pricing.'}
                      </p>
                    </div>
                    {editingPackageId && (
                      <button
                        type="button"
                        onClick={resetPackageForm}
                        className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-lg px-2 py-1 transition cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleAddPackage} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">
                          Package Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Honey Wellness Duo"
                          value={pkgName}
                          onChange={(e) => setPkgName(e.target.value)}
                          className="w-full bg-white border border-gray-300 focus:border-[#ffa200] focus:ring-2 focus:ring-[#ffa200]/20 rounded-xl px-3 py-2 text-gray-900 outline-none font-medium placeholder:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">
                          Promotional Badge / Tag
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Save ₵20 or Expo Special"
                          value={pkgBadge}
                          onChange={(e) => setPkgBadge(e.target.value)}
                          className="w-full bg-white border border-gray-300 focus:border-[#ffa200] focus:ring-2 focus:ring-[#ffa200]/20 rounded-xl px-3 py-2 text-gray-900 outline-none font-medium placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    {/* Products in Bundle */}
                    <div className="space-y-2">
                      <label className="block text-gray-700 font-semibold">
                        Products in Package (Minimum 2) *
                      </label>
                      <div className="space-y-2">
                        {pkgItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200">
                            <select
                              required
                              value={item.product_id}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                if (!selectedId) {
                                  const updated = [...pkgItems];
                                  updated[idx].product_id = '';
                                  setPkgItems(updated);
                                  return;
                                }

                                const existingIdx = pkgItems.findIndex((p, i) => i !== idx && p.product_id === selectedId);

                                if (existingIdx !== -1) {
                                  const prodName = products.find(p => p.id === selectedId)?.name || 'Product';
                                  const newQty = (parseInt(pkgItems[existingIdx].quantity) || 1) + 1;

                                  toast.success(`${prodName} is already in the package! Increased count to ${newQty}.`, {
                                    icon: '📦',
                                    duration: 4000
                                  });

                                  const updated = [...pkgItems];
                                  updated[existingIdx].quantity = newQty;

                                  if (updated.length > 2) {
                                    updated.splice(idx, 1);
                                  } else {
                                    updated[idx].product_id = '';
                                  }

                                  setPkgItems(updated);
                                  return;
                                }

                                const updated = [...pkgItems];
                                updated[idx].product_id = selectedId;
                                setPkgItems(updated);
                              }}
                              className="flex-1 bg-gray-50 border border-gray-300 focus:border-[#ffa200] rounded-lg px-2.5 py-1.5 text-gray-900 outline-none text-xs font-medium"
                            >
                              <option value="">Select Product...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} - ₵{(p.sellingPrice || 0).toFixed(2)}
                                </option>
                              ))}
                            </select>

                            <div className="w-24 shrink-0 flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1">
                              <span className="text-[10px] text-gray-500 font-semibold">Qty:</span>
                              <input
                                type="number"
                                required
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const updated = [...pkgItems];
                                  updated[idx].quantity = e.target.value;
                                  setPkgItems(updated);
                                }}
                                className="w-full bg-transparent text-right text-gray-900 font-mono font-bold outline-none text-xs"
                              />
                            </div>

                            {pkgItems.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPkgItems(pkgItems.filter((_, i) => i !== idx));
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 transition cursor-pointer"
                                title="Remove Item"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPkgItems([...pkgItems, { product_id: '', quantity: 1 }])}
                        className="text-[#d07b00] hover:text-[#ffa200] text-xs font-bold inline-flex items-center gap-1 cursor-pointer pt-1"
                      >
                        <Plus className="w-3 h-3" /> Add Another Product
                      </button>
                    </div>

                    {/* Pricing Calculator */}
                    {(() => {
                      const regularTotal = pkgItems.reduce((sum, item) => {
                        if (!item.product_id) return sum;
                        const prod = products.find(p => p.id === item.product_id);
                        return sum + (prod ? (prod.sellingPrice || 0) * (parseInt(item.quantity) || 1) : 0);
                      }, 0);

                      let currentPrice = parseFloat(pkgPrice);
                      let savings = 0;
                      let discountPct = 0;

                      if (!isNaN(currentPrice) && currentPrice > 0) {
                        savings = Math.max(0, regularTotal - currentPrice);
                        discountPct = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;
                      }

                      return (
                        <div className="bg-white border-2 border-amber-200 rounded-xl p-3.5 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 font-medium">Combined Regular Price:</span>
                            <span className="font-mono font-bold text-gray-900 text-sm">
                              ₵{regularTotal.toFixed(2)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                            <div>
                              <label className="block text-[11px] text-gray-600 font-semibold mb-1">
                                Package Price (₵) *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={`e.g. ${(regularTotal * 0.85).toFixed(2)}`}
                                value={pkgPrice}
                                onChange={(e) => {
                                  setPkgPrice(e.target.value);
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && regularTotal > 0) {
                                    const pct = Math.round(((regularTotal - val) / regularTotal) * 100);
                                    setPkgDiscountPercent(pct > 0 ? pct.toString() : '0');
                                  } else {
                                    setPkgDiscountPercent('');
                                  }
                                }}
                                className="w-full bg-gray-50 border border-gray-300 focus:border-[#ffa200] rounded-xl px-3 py-2 text-gray-900 font-mono font-bold text-sm outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-gray-600 font-semibold mb-1">
                                Or Discount (%)
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="99"
                                placeholder="e.g. 15"
                                value={pkgDiscountPercent}
                                onChange={(e) => {
                                  setPkgDiscountPercent(e.target.value);
                                  const pct = parseFloat(e.target.value);
                                  if (!isNaN(pct) && regularTotal > 0) {
                                    const calcPrice = Math.round((regularTotal * (1 - pct / 100)) * 100) / 100;
                                    setPkgPrice(calcPrice.toString());
                                  } else {
                                    setPkgPrice('');
                                  }
                                }}
                                className="w-full bg-gray-50 border border-gray-300 focus:border-[#ffa200] rounded-xl px-3 py-2 text-gray-900 font-mono font-bold text-sm outline-none"
                              />
                            </div>
                          </div>

                          {regularTotal > 0 && savings > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex justify-between items-center text-xs text-[#945500]">
                              <span className="font-semibold">Customer Savings:</span>
                              <span className="font-bold font-mono text-[#d07b00]">
                                ₵{savings.toFixed(2)} ({discountPct}% OFF)
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={resetPackageForm}
                        className="px-4 py-2.5 border border-gray-300 hover:bg-gray-100 rounded-xl text-gray-700 transition text-xs font-semibold cursor-pointer"
                      >
                        {editingPackageId ? 'Cancel Edit' : 'Reset Form'}
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPackage}
                        className="flex-1 px-4 py-2.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-extrabold rounded-xl transition shadow-sm text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {editingPackageId ? (
                          <Pencil className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        <span>
                          {isSavingPackage
                            ? (editingPackageId ? 'Updating...' : 'Saving...')
                            : (editingPackageId ? 'Update & Save Package' : 'Save & Publish Package')}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
    </AuthShield>
  );
}

