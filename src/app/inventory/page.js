'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { hasPermission } from '@/utils/permissions';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { logAction } from '@/utils/logging';
import { removeCachedProduct } from '@/utils/offlineStore';
import { 
  Package, Plus, Minus, Edit3, Trash2, Save, X, AlertCircle, FolderOpen, Filter, EyeOff, Eye,
  ChevronDown, ChevronUp, Tag, Search, MoreVertical, SlidersHorizontal, UploadCloud, FileSpreadsheet,
  Download, Image as ImageIcon, CheckCircle, RefreshCw, Layers, DollarSign, ArrowUpDown
} from 'lucide-react';

const CATEGORIES = [
  'All Categories',
  'Multifloral (raw honey)',
  'Monofloral raw honey',
  'Comb Honey', 
  'Infused/Creamed Honey', 
  'Beeswax & Wax Products', 
  'Propolis', 
  'Royal Jelly',
  'Others'
];

const OFFICIAL_PRESETS = [
  { name: '250ml Honey Jar', spec: '250 ml', category: 'Multifloral (raw honey)', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558743/WhatsApp_Image_2024-07-02_at_09.23.56_8bdfb45a_wltxqk.jpg', sellingPrice: 25, costPrice: 13 },
  { name: '500ml Squeeze Bottle', spec: '500 ml', category: 'Multifloral (raw honey)', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558742/WhatsApp_Image_2024-07-02_at_09.23.57_d94cf352_j89um3.jpg', sellingPrice: 45, costPrice: 22.5 },
  { name: '1L Family Bottle', spec: '1000 ml', category: 'Multifloral (raw honey)', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558744/WhatsApp_Image_2024-07-02_at_09.23.56_19e9d694_wuwhfn.jpg', sellingPrice: 80, costPrice: 40 },
  { name: 'Box of 30 Sachets', spec: 'Box of 30', category: 'Multifloral (raw honey)', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558739/Sachet_j7a69r.jpg', sellingPrice: 225, costPrice: 110 },
  { name: '2.5L Bulk Gallon', spec: '2.5 Liters', category: 'Multifloral (raw honey)', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558742/WhatsApp_Image_2024-07-02_at_09.23.56_07ba9002_nw1ogm.jpg', sellingPrice: 170, costPrice: 85 },
  { name: '4.5L Bulk Gallon', spec: '4.5 Liters', category: 'Multifloral (raw honey)', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558739/WhatsApp_Image_2024-07-02_at_09.23.57_d8e90caa_hicdgu.jpg', sellingPrice: 300, costPrice: 150 },
  { name: 'Specialty Acacia Honey', spec: '500 ml', category: 'Monofloral raw honey', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558742/WhatsApp_Image_2024-07-02_at_09.23.57_d94cf352_j89um3.jpg', sellingPrice: 95, costPrice: 45 },
  { name: 'Specialty Moringa Honey', spec: '500 ml', category: 'Monofloral raw honey', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558743/WhatsApp_Image_2024-07-02_at_09.23.56_8bdfb45a_wltxqk.jpg', sellingPrice: 90, costPrice: 42 },
  { name: 'Specialty Neem Honey', spec: '500 ml', category: 'Monofloral raw honey', image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558744/WhatsApp_Image_2024-07-02_at_09.23.56_19e9d694_wuwhfn.jpg', sellingPrice: 90, costPrice: 42 }
];

const DEFAULT_DESCRIPTIONS = {
  'bottle-250ml': '100% pure, unpasteurized raw Ghanaian multifloral honey harvested from natural forest blossoms. Rich in natural enzymes, antioxidants, and minerals with a smooth, sweet finish.',
  'bottle-500ml': 'Our signature 500ml jar of 100% pure raw multifloral honey. Carefully filtered to retain natural pollen and nutrients. Perfect for daily tea sweetener, baking, or wellness routines.',
  'bottle-1l': 'Generous 1-Liter family size bottle of pure, unfiltered raw forest honey. Sustainably harvested in Ghana with zero additives or added sugars.',
  'sachet': 'Convenient single-serve box of 30 raw honey sachets. Ideal for on-the-go energy, travel, school lunches, or quick tea sweetening.',
  'gallon-2.5l': '2.5 Liter bulk gallon of pure raw Ghanaian honey. Best value for catering, juice bars, restaurants, or large households.',
  'gallon-4.5l': 'Commercial 4.5 Liter bulk container of 100% natural, unheated raw honey. Sourced directly from local Ghanaian beekeepers.',
  'acacia': 'Monofloral Acacia raw honey known for its light amber color, mild delicate floral aroma, and high fructose content that resists crystallization.',
  'neem': 'Dark, rich monofloral Neem honey with herbal medicinal undertones. High in antibacterial properties, perfect for immune support and natural remedies.',
  'baobab': 'Exotic monofloral honey harvested from wild African Baobab tree blossoms. Features a subtle tangy citrus finish and exceptionally high vitamin C content.',
  'mango': 'Single-origin raw honey harvested from blooming mango orchards. Naturally fruity, aromatic, and delicious on morning toast or porridge.',
  'cashew': 'Golden monofloral honey collected during the cashew blossom season. Mild, buttery flavor profile with a smooth, luxurious texture.',
  'moringa': 'Infused with the nectar of organic Moringa flowers. Superfood honey packed with nutrients, antioxidants, and a distinct herbal sweetness.',
};

const MOCK_PRODUCTS = [
  { id: 'bottle-250ml', name: '250ml Honey Bottle', category: 'Multifloral (raw honey)', spec: '250 ml', description: DEFAULT_DESCRIPTIONS['bottle-250ml'], stockLevel: 210, reorderLevel: 20, costPrice: 13.00, sellingPrice: 25.00, isActive: true, image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558743/WhatsApp_Image_2024-07-02_at_09.23.56_8bdfb45a_wltxqk.jpg' },
  { id: 'bottle-500ml', name: '500ml Honey Bottle', category: 'Multifloral (raw honey)', spec: '500 ml', description: DEFAULT_DESCRIPTIONS['bottle-500ml'], stockLevel: 140, reorderLevel: 15, costPrice: 22.50, sellingPrice: 45.00, isActive: true, image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558742/WhatsApp_Image_2024-07-02_at_09.23.57_d94cf352_j89um3.jpg' },
  { id: 'bottle-1l', name: '1L Honey Bottle', category: 'Multifloral (raw honey)', spec: '1000 ml', description: DEFAULT_DESCRIPTIONS['bottle-1l'], stockLevel: 85, reorderLevel: 10, costPrice: 40.00, sellingPrice: 80.00, isActive: true, image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558744/WhatsApp_Image_2024-07-02_at_09.23.56_19e9d694_wuwhfn.jpg' },
  { id: 'sachet', name: 'Honey Sachet Box', category: 'Multifloral (raw honey)', spec: 'Box of 30', description: DEFAULT_DESCRIPTIONS['sachet'], stockLevel: 99, reorderLevel: 20, costPrice: 110.00, sellingPrice: 225.00, isActive: true, image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558739/Sachet_j7a69r.jpg' },
  { id: 'gallon-2.5l', name: '2.5L Honey Gallon', category: 'Multifloral (raw honey)', spec: '2.5 Liters', description: DEFAULT_DESCRIPTIONS['gallon-2.5l'], stockLevel: 59, reorderLevel: 15, costPrice: 85.00, sellingPrice: 170.00, isActive: true, image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558742/WhatsApp_Image_2024-07-02_at_09.23.56_07ba9002_nw1ogm.jpg' },
  { id: 'gallon-4.5l', name: '4.5L Honey Gallon', category: 'Multifloral (raw honey)', spec: '4.5 Liters', description: DEFAULT_DESCRIPTIONS['gallon-4.5l'], stockLevel: 31, reorderLevel: 10, costPrice: 150.00, sellingPrice: 300.00, isActive: true, image: 'https://res.cloudinary.com/doysykrko/image/upload/v1779558739/WhatsApp_Image_2024-07-02_at_09.23.57_d8e90caa_hicdgu.jpg' },
];

const MOCK_BATCHES = [
  { id: 'batch-1', batch_number: 'B-2026-AMR-01', product_id: 'bottle-500ml', quantity_remaining: 85, expiry_date: '2029-05-10' },
  { id: 'batch-2', batch_number: 'B-2026-NKR-02', product_id: 'bottle-1l', quantity_remaining: 50, expiry_date: '2029-04-18' },
  { id: 'batch-3', batch_number: 'B-2025-AMR-09', product_id: 'acacia', quantity_remaining: 15, expiry_date: '2028-09-01' },
];

// Helper: Custom CSV Parser that handles quoted values & multi-line records
function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(currentField.trim());
      if (row.some(f => f.length > 0)) lines.push(row);
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(f => f.length > 0)) lines.push(row);
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return lines.slice(1).map(vals => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] || '';
    });
    return obj;
  });
}

export default function InventoryPage() {
  const { roles, user } = useAuth();
  const { showConfirm } = useUI();
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter & UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [expandedProductId, setExpandedProductId] = useState(null);
  
  // Modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Bulk Upload State
  const [bulkParsedProducts, setBulkParsedProducts] = useState([]);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkFileName, setBulkFileName] = useState('');
  const fileInputRef = useRef(null);

  // Permissions checks
  const canViewCost = hasPermission(roles, 'product.view_cost');

  // New Product Form Data
  const [newProduct, setNewProduct] = useState({
    id: '', name: '', category: 'Multifloral (raw honey)', spec: '', description: '', stockLevel: 0, reorderLevel: 10, costPrice: 0, sellingPrice: 0, isActive: true, image: ''
  });

  // Edit Product Form Data
  const [editProduct, setEditProduct] = useState({
    name: '', category: '', spec: '', description: '', stockLevel: 0, reorderLevel: 10, costPrice: 0, sellingPrice: 0, isActive: true, image: ''
  });

  // Hover Action Menu State
  const [activeMenuId, setActiveMenuId] = useState(null);

  useEffect(() => {
    if (!db) {
      setProducts(MOCK_PRODUCTS);
      setBatches(MOCK_BATCHES);
      setIsMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        if (snapshot.empty) {
          setProducts([]);
          setIsMock(false);
        } else {
          const list = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const prodId = docSnap.id;
            
            let description = data.description || '';
            if (!description && DEFAULT_DESCRIPTIONS[prodId]) {
              description = DEFAULT_DESCRIPTIONS[prodId];
              updateDoc(doc(db, 'products', prodId), { description }).catch(err => 
                console.warn("[Inventory] Background description sync error:", err.message)
              );
            }

            list.push({ ...data, description, id: prodId, isActive: data.isActive !== false });
          });
          setProducts(list);
          setIsMock(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore loading error:", err);
        setProducts([]);
        setIsMock(false);
        setLoading(false);
      }
    );

    const unsubscribeBatches = onSnapshot(
      collection(db, 'batches'),
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id });
        });
        setBatches(list);
      },
      (err) => {
        console.warn("[Inventory] Batches listener warning:", err.message);
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeBatches();
    };
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const prodCategory = (!p.category || p.category.toLowerCase() === 'uncategorized') ? 'Others' : p.category;
    const matchesCategory = selectedCategory === 'All Categories' || prodCategory === selectedCategory;
    
    let matchesStatus = true;
    if (statusFilter === 'In Stock') matchesStatus = p.stockLevel > p.reorderLevel;
    if (statusFilter === 'Low Stock') matchesStatus = p.stockLevel <= p.reorderLevel && p.stockLevel > 0;
    if (statusFilter === 'Out of Stock') matchesStatus = p.stockLevel <= 0;
    if (statusFilter === 'Active') matchesStatus = p.isActive !== false;
    if (statusFilter === 'Inactive') matchesStatus = p.isActive === false;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Toggle Show/Hide Product Active Status
  const handleToggleActive = async (productId, currentActiveStatus) => {
    if (isMock) {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, isActive: !currentActiveStatus } : p));
      toast.success(currentActiveStatus ? "Product hidden from store" : "Product visible on store");
      return;
    }

    try {
      const docRef = doc(db, 'products', productId);
      await updateDoc(docRef, { isActive: !currentActiveStatus, lastUpdated: new Date().toISOString() });
      toast.success(currentActiveStatus ? "Product hidden from storefront" : "Product activated on storefront");
      if (user) {
        logAction(user, 'TOGGLE_PRODUCT_VISIBILITY', `${currentActiveStatus ? 'Hid' : 'Showed'} product #${productId}`);
      }
    } catch (err) {
      toast.error("Failed to update status.");
    }
  };

  // Stock Level Quick Stepper
  const handleStockAdjust = async (productId, currentStock, amount) => {
    const targetStock = Math.max(0, currentStock + amount);
    if (isMock) {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stockLevel: targetStock } : p))
      );
      toast.success("Stock updated (Sandbox)");
      return;
    }
    try {
      const docRef = doc(db, 'products', productId);
      await updateDoc(docRef, { stockLevel: targetStock, lastUpdated: new Date().toISOString() });
      
      try {
        const movementId = `mov-adj-${Date.now().toString(36)}-${productId}`;
        await setDoc(doc(db, 'stock_movements', movementId), {
          product_id: productId,
          movement_type: amount > 0 ? 'adjustment_in' : 'adjustment_out',
          quantity: Math.abs(amount),
          previous_stock: currentStock,
          new_stock: targetStock,
          reference: `Manual adjustment (${amount > 0 ? '+' : ''}${amount})`,
          changed_by: user?.uid || 'anonymous',
          changed_by_name: user?.full_name || 'Staff',
          moved_at: new Date().toISOString()
        });

        await logAction(user, 'STOCK_ADJUSTMENT', `Adjusted stock for product #${productId} (${currentStock} -> ${targetStock}, change: ${amount > 0 ? '+' : ''}${amount})`);
      } catch (movErr) {
        console.warn('Stock movement log warning:', movErr);
      }

      toast.success("Stock updated successfully");
    } catch (err) {
      toast.error("Failed to update stock.");
    }
  };

  // Add Product Submit
  const handleAddProduct = async (e) => {
    e.preventDefault();
    
    const combinedName = `${newProduct.name.trim()} ${newProduct.spec.trim()}`;
    const generatedId = combinedName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!generatedId) {
      toast.error("Invalid product name or specification");
      return;
    }

    const payload = {
      name: newProduct.name.trim(),
      category: newProduct.category,
      spec: newProduct.spec.trim(),
      description: newProduct.description?.trim() || '',
      stockLevel: parseInt(newProduct.stockLevel) || 0,
      reorderLevel: parseInt(newProduct.reorderLevel) || 0,
      costPrice: parseFloat(newProduct.costPrice) || 0,
      sellingPrice: parseFloat(newProduct.sellingPrice) || 0,
      image: newProduct.image.trim() || '',
      isActive: newProduct.isActive !== false,
      lastUpdated: new Date().toISOString(),
    };

    if (isMock) {
      setProducts((prev) => [...prev, { id: generatedId, ...payload }]);
      setShowAddForm(false);
      setNewProduct({ id: '', name: '', category: 'Multifloral (raw honey)', spec: '', description: '', stockLevel: 0, reorderLevel: 10, costPrice: 0, sellingPrice: 0, isActive: true, image: '' });
      toast.success("Product added (Sandbox)");
      return;
    }

    try {
      await setDoc(doc(db, 'products', generatedId), payload);
      await logAction(user, 'CREATE_PRODUCT', `Added new product "${payload.name}" (${payload.spec}) with stock ${payload.stockLevel}`);
      setShowAddForm(false);
      setNewProduct({ id: '', name: '', category: 'Multifloral (raw honey)', spec: '', description: '', stockLevel: 0, reorderLevel: 10, costPrice: 0, sellingPrice: 0, isActive: true, image: '' });
      toast.success("Product added successfully");
    } catch (err) {
      toast.error("Failed to save product.");
    }
  };

  // Edit Product Submit
  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    const payload = {
      name: editProduct.name.trim(),
      category: editProduct.category,
      spec: editProduct.spec.trim(),
      description: editProduct.description?.trim() || '',
      stockLevel: parseInt(editProduct.stockLevel) || 0,
      reorderLevel: parseInt(editProduct.reorderLevel) || 0,
      costPrice: parseFloat(editProduct.costPrice) || 0,
      sellingPrice: parseFloat(editProduct.sellingPrice) || 0,
      image: editProduct.image?.trim() || '',
      isActive: editProduct.isActive !== false,
      lastUpdated: new Date().toISOString(),
    };

    if (isMock) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...payload } : p)));
      setEditingId(null);
      toast.success("Product updated (Sandbox)");
      return;
    }

    try {
      await updateDoc(doc(db, 'products', id), payload);
      await logAction(user, 'EDIT_PRODUCT', `Updated product "${payload.name}" details (Selling Price: ₵${payload.sellingPrice}, Stock: ${payload.stockLevel})`);
      setEditingId(null);
      toast.success("Product updated successfully");
    } catch (err) {
      toast.error("Failed to update product details.");
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id) => {
    setActiveMenuId(null);
    const isConfirmed = await showConfirm({
      title: 'Delete Product',
      message: 'Are you sure you want to permanently remove this product from the inventory?',
      confirmText: 'Delete',
      isDestructive: true
    });
    
    if (!isConfirmed) return;

    try {
      await fetch('/api/delete-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (db) {
        deleteDoc(doc(db, 'products', id)).catch(() => {});
      }

      setProducts((prev) => prev.filter((p) => p.id !== id));
      removeCachedProduct(id);

      await logAction(user, 'DELETE_PRODUCT', `Deleted product #${id}`);
      toast.success("Product deleted successfully");
    } catch (err) {
      console.error("Delete product error:", err);
      toast.error("Failed to delete product.");
    }
  };

  // Image File Picker Handler
  const handleImageFileChange = (e, targetForm, setTargetForm) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file is too large. Max size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setTargetForm(prev => ({ ...prev, image: event.target.result }));
      toast.success("Local image loaded!");
    };
    reader.readAsDataURL(file);
  };

  // CSV Template Downloader
  const handleDownloadTemplate = () => {
    const headers = "Name,Category,Spec,SellingPrice,CostPrice,StockLevel,ReorderLevel,Image,Description\n";
    const sampleRows = [
      '"Pure Multifloral Honey (500ml)","Multifloral (raw honey)","500 ml",45.00,22.50,150,20,"https://res.cloudinary.com/doysykrko/image/upload/v1779558742/WhatsApp_Image_2024-07-02_at_09.23.57_d94cf352_j89um3.jpg","100% pure raw Ghanaian forest honey."',
      '"Specialty Acacia Honey (500ml)","Monofloral raw honey","500 ml",95.00,45.00,60,15,"https://res.cloudinary.com/doysykrko/image/upload/v1779558742/WhatsApp_Image_2024-07-02_at_09.23.57_d94cf352_j89um3.jpg","Delicate monofloral acacia honey with light floral sweetness."',
      '"Raw Honey Sachet Box (30 sachets)","Multifloral (raw honey)","Box of 30",225.00,110.00,80,15,"https://res.cloudinary.com/doysykrko/image/upload/v1779558739/Sachet_j7a69r.jpg","Convenient single-serve box of 30 honey sachets for travel or tea."'
    ].join('\n');

    const blob = new Blob([headers + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'honeypalace_products_template.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded sample CSV template");
  };

  // Handle Uploaded CSV File
  const handleBulkFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast.error("Could not parse products from file. Please ensure it has valid headers.");
        setBulkParsedProducts([]);
        return;
      }

      // Map parsed fields to standard schema
      const mapped = parsed.map((row, i) => {
        const name = row.name || row.productname || `Imported Item ${i + 1}`;
        const spec = row.spec || row.variant || row.size || 'Standard';
        const category = row.category || 'Multifloral (raw honey)';
        const sellingPrice = parseFloat(row.sellingprice || row.price || 0) || 0;
        const costPrice = parseFloat(row.costprice || row.cost || 0) || 0;
        const stockLevel = parseInt(row.stocklevel || row.stock || row.quantity || 0) || 0;
        const reorderLevel = parseInt(row.reorderlevel || row.reorder || 10) || 10;
        const image = row.image || row.imageurl || '';
        const description = row.description || '';

        return {
          id: `${name}-${spec}`.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-'),
          name,
          spec,
          category,
          sellingPrice,
          costPrice,
          stockLevel,
          reorderLevel,
          image,
          description,
          isActive: true
        };
      });

      setBulkParsedProducts(mapped);
      toast.success(`Detected ${mapped.length} products ready for import!`);
    };
    reader.readAsText(file);
  };

  // Execute Bulk Import to Database
  const handleExecuteBulkImport = async () => {
    if (bulkParsedProducts.length === 0) {
      toast.error("No valid products loaded to import.");
      return;
    }

    setBulkImportLoading(true);
    try {
      let importedCount = 0;
      for (const prod of bulkParsedProducts) {
        const docId = prod.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const payload = {
          name: prod.name,
          category: prod.category,
          spec: prod.spec,
          sellingPrice: prod.sellingPrice,
          costPrice: prod.costPrice,
          stockLevel: prod.stockLevel,
          reorderLevel: prod.reorderLevel,
          image: prod.image,
          description: prod.description,
          isActive: true,
          lastUpdated: new Date().toISOString()
        };

        if (db && !isMock) {
          await setDoc(doc(db, 'products', docId), payload, { merge: true });
        } else {
          setProducts(prev => [...prev.filter(p => p.id !== docId), { id: docId, ...payload }]);
        }
        importedCount++;
      }

      await logAction(user, 'BULK_IMPORT_PRODUCTS', `Imported ${importedCount} products via CSV bulk upload`);
      toast.success(`Successfully imported ${importedCount} products to catalog!`);
      setShowBulkModal(false);
      setBulkParsedProducts([]);
      setBulkFileName('');
    } catch (err) {
      console.error("Bulk import error:", err);
      toast.error("Error executing bulk import: " + err.message);
    } finally {
      setBulkImportLoading(false);
    }
  };

  const startEdit = (product) => {
    setActiveMenuId(null);
    setEditingId(product.id);
    setEditProduct({ ...product, isActive: product.isActive !== false });
  };

  const totalProducts = products.length;
  const outOfStockCount = products.filter(p => p.isActive && p.stockLevel <= 0).length;
  const lowStockCount = products.filter(p => p.isActive && p.stockLevel > 0 && p.stockLevel <= p.reorderLevel).length;
  const totalValue = products.reduce((sum, p) => sum + ((p.stockLevel || 0) * (p.costPrice || 0)), 0);

  return (
    <AuthShield requiredPermission="stock.view">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-2.5 md:gap-4 min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs text-gray-500 font-medium truncate">Total SKUs</p>
              <p className="text-lg md:text-2xl font-bold text-gray-950 mt-0.5 truncate">{totalProducts}</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-2.5 md:gap-4 min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs text-gray-500 font-medium truncate">Out of Stock</p>
              <p className="text-lg md:text-2xl font-bold text-red-600 mt-0.5 truncate">{outOfStockCount}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-2.5 md:gap-4 min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs text-gray-500 font-medium truncate">Low Stock Alert</p>
              <p className="text-lg md:text-2xl font-bold text-amber-600 mt-0.5 truncate">{lowStockCount}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-2.5 md:gap-4 min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-sm md:text-lg">₵</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs text-gray-500 font-medium truncate">Stock Value (Cost)</p>
              <p className="text-lg md:text-2xl font-bold text-emerald-600 mt-0.5 truncate">
                ₵{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        
        {/* Top Control Bar: Search, Filters, Bulk CSV & Add Product */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                className="w-full bg-white border border-gray-200 focus:border-[#ffa200] focus:ring-2 focus:ring-[#ffa200]/20 pl-12 pr-4 py-2.5 rounded-xl text-sm text-gray-900 transition-all shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                title="Filter by category and stock level"
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 border rounded-xl text-sm font-medium transition-all shadow-sm whitespace-nowrap ${showFilters ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>

              {/* Bulk CSV Import Button */}
              <button
                onClick={() => setShowBulkModal(true)}
                title="Bulk import products from CSV spreadsheet"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300/80 text-emerald-800 font-bold rounded-xl transition-all shadow-sm text-sm whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Bulk CSV Import
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              title="Add a new product to your inventory catalog"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#ffa200] hover:bg-[#ffb02e] text-black font-bold rounded-xl transition-all shadow-md text-sm whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Add New Product
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filters */}
        {showFilters && (
          <div className="bg-white border border-gray-200 p-5 rounded-2xl mb-6 shadow-sm flex flex-wrap gap-6 animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</label>
              <select 
                className="bg-gray-50 border border-gray-200 text-sm text-gray-900 rounded-lg px-3 py-2 min-w-[200px]"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Status</label>
              <select 
                className="bg-gray-50 border border-gray-200 text-sm text-gray-900 rounded-lg px-3 py-2 min-w-[200px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {['All Status', 'In Stock', 'Low Stock', 'Out of Stock', 'Active', 'Inactive'].map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Product Data Table */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-visible">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6 font-bold">Product &amp; Spec</th>
                  <th className="p-4 font-bold">Category</th>
                  <th className="p-4 font-bold">Pricing (₵)</th>
                  <th className="p-4 font-bold text-center">Stock Level</th>
                  <th className="p-4 font-bold text-center">Quick Adjust</th>
                  <th className="p-4 font-bold text-center">Visibility</th>
                  <th className="p-4 font-bold text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500">
                      No products found matching your search and filter criteria.
                    </td>
                  </tr>
                ) : null}

                {filteredProducts.map((product) => {
                  const isLowStock = (product.stockLevel || 0) <= (product.reorderLevel || 0) && product.stockLevel > 0;
                  const isOut = (product.stockLevel || 0) <= 0;
                  const isActive = product.isActive !== false;
                  const profit = (product.sellingPrice || 0) - (product.costPrice || 0);

                  return (
                    <tr key={product.id} className={`hover:bg-gray-50/80 transition-all ${!isActive ? 'bg-gray-50/40 opacity-70' : ''}`}>
                      
                      {/* Product Info & Thumbnail */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-2">
                              <span>{product.name}</span>
                              {!isActive && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-200 text-gray-700">
                                  HIDDEN
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 font-medium flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[11px] text-gray-400">#{product.id}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-[#d07b00] font-semibold">{product.spec || 'Standard'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          {product.category || 'Raw Honey'}
                        </span>
                      </td>

                      {/* Pricing Configuration */}
                      <td className="p-4">
                        <div>
                          <span className="font-mono text-sm font-extrabold text-gray-900">
                            ₵{(product.sellingPrice || 0).toFixed(2)}
                          </span>
                          {canViewCost && (
                            <span className="text-[11px] text-gray-400 block font-mono">
                              Cost: ₵{(product.costPrice || 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock Level & Status Badge */}
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono text-base font-extrabold text-gray-900">
                            {product.stockLevel || 0}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                            isOut 
                              ? 'bg-rose-100 text-rose-700' 
                              : isLowStock 
                                ? 'bg-amber-100 text-amber-700 animate-pulse' 
                                : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isOut ? 'Out of Stock' : isLowStock ? `Low (${product.stockLevel} left)` : 'In Stock'}
                          </span>
                        </div>
                      </td>

                      {/* Quick Stepper Controls */}
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleStockAdjust(product.id, product.stockLevel, -10)}
                            className="px-1.5 py-1 text-[10px] font-bold text-gray-500 hover:text-black hover:bg-gray-200 rounded"
                            title="Decrease by 10"
                          >
                            -10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStockAdjust(product.id, product.stockLevel, -1)}
                            className="p-1 text-gray-700 hover:bg-gray-200 rounded"
                            title="Decrease by 1"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStockAdjust(product.id, product.stockLevel, 1)}
                            className="p-1 text-gray-700 hover:bg-gray-200 rounded"
                            title="Increase by 1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStockAdjust(product.id, product.stockLevel, 10)}
                            className="px-1.5 py-1 text-[10px] font-bold text-gray-500 hover:text-black hover:bg-gray-200 rounded"
                            title="Increase by 10"
                          >
                            +10
                          </button>
                        </div>
                      </td>

                      {/* Show / Hide Toggle Switch */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product.id, isActive)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                            isActive 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                          }`}
                          title={isActive ? 'Click to hide from store' : 'Click to make visible on store'}
                        >
                          {isActive ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                          {isActive ? 'Visible' : 'Hidden'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(product)}
                            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit product details & pricing"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 1. BULK CSV / EXCEL IMPORT MODAL */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl w-full max-w-3xl space-y-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-display font-extrabold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                    Bulk Product Catalog Upload
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Import multiple honey items, sizes, prices, and stock levels instantly via CSV spreadsheet.
                  </p>
                </div>
                <button 
                  onClick={() => { setShowBulkModal(false); setBulkParsedProducts([]); setBulkFileName(''); }}
                  className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Template Download Card */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-[#d07b00]" /> Download Ready CSV Template
                  </h4>
                  <p className="text-[11px] text-amber-700">
                    Use our pre-formatted spreadsheet with the correct column headers (Name, Category, Spec, SellingPrice, CostPrice, StockLevel, Image).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-[#ffa200] hover:bg-[#e69100] text-black font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template (.csv)
                </button>
              </div>

              {/* File Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-[#ffa200] rounded-2xl p-8 text-center cursor-pointer transition-all bg-gray-50 hover:bg-gray-50/50"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".csv,.txt" 
                  className="hidden" 
                  onChange={handleBulkFileSelect} 
                />
                <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-gray-900 mb-1">
                  {bulkFileName ? `Selected: ${bulkFileName}` : 'Click to select CSV file from your computer'}
                </h4>
                <p className="text-xs text-gray-500">
                  Accepts standard comma-separated (.csv) files up to 10MB.
                </p>
              </div>

              {/* Parsed Preview Table */}
              {bulkParsedProducts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Preview: {bulkParsedProducts.length} Products Detected
                    </h4>
                    <span className="text-[11px] text-gray-500">Review rows before executing import</span>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-100 text-gray-600 sticky top-0">
                        <tr>
                          <th className="p-2.5 font-bold">Name</th>
                          <th className="p-2.5 font-bold">Category</th>
                          <th className="p-2.5 font-bold">Spec</th>
                          <th className="p-2.5 font-bold">Price (₵)</th>
                          <th className="p-2.5 font-bold">Cost (₵)</th>
                          <th className="p-2.5 font-bold">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bulkParsedProducts.map((p, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-2.5 font-semibold text-gray-900">{p.name}</td>
                            <td className="p-2.5 text-gray-600">{p.category}</td>
                            <td className="p-2.5 font-mono text-gray-700">{p.spec}</td>
                            <td className="p-2.5 font-mono font-bold text-gray-900">₵{p.sellingPrice.toFixed(2)}</td>
                            <td className="p-2.5 font-mono text-gray-500">₵{p.costPrice.toFixed(2)}</td>
                            <td className="p-2.5 font-mono font-bold text-emerald-600">{p.stockLevel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowBulkModal(false); setBulkParsedProducts([]); setBulkFileName(''); }}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkImportLoading || bulkParsedProducts.length === 0}
                  onClick={handleExecuteBulkImport}
                  className="flex-1 py-3 px-4 bg-[#ffa200] hover:bg-[#e69100] disabled:opacity-50 text-black font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {bulkImportLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Importing to Database...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Import {bulkParsedProducts.length} Products Now
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* 2. ADD PRODUCT MODAL */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl w-full max-w-xl space-y-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <h3 className="text-xl font-display font-extrabold text-gray-900">Add New Honey Product</h3>
                <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Official Honey Palace Presets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Quick Preset Palette (Autofill Image &amp; Specs)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {OFFICIAL_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNewProduct(prev => ({
                          ...prev,
                          name: preset.name,
                          spec: preset.spec,
                          category: preset.category,
                          image: preset.image,
                          sellingPrice: preset.sellingPrice,
                          costPrice: preset.costPrice
                        }));
                        toast.success(`Preset "${preset.name}" loaded!`);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 hover:bg-[#ffa200]/20 hover:text-black rounded-lg transition-colors border border-gray-200"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-4">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase">Product Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Pure Multifloral Raw Honey" 
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-4 py-2.5 rounded-xl text-sm text-gray-900 transition-colors" 
                    value={newProduct.name} 
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Category *</label>
                    <select 
                      className="bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900 transition-colors" 
                      value={newProduct.category} 
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    >
                      {CATEGORIES.slice(1).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Size / Spec *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. 500 ml / 1 Liter / Box of 30" 
                      className="bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900 transition-colors" 
                      value={newProduct.spec} 
                      onChange={(e) => setNewProduct({ ...newProduct, spec: e.target.value })} 
                    />
                  </div>
                </div>

                {/* Pricing Configuration & Margin Calculator */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-700 uppercase">Cost Price (₵) *</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        required 
                        className="bg-white border border-gray-200 focus:border-[#ffa200] px-3 py-2 rounded-lg text-sm text-gray-900 font-mono" 
                        value={newProduct.costPrice} 
                        onChange={(e) => setNewProduct({ ...newProduct, costPrice: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-700 uppercase">Selling Price (₵) *</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        required 
                        className="bg-white border border-gray-200 focus:border-[#ffa200] px-3 py-2 rounded-lg text-sm text-gray-900 font-mono" 
                        value={newProduct.sellingPrice} 
                        onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                  </div>

                  {/* Real-time Profit Preview */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200/80 font-medium text-gray-600">
                    <span>
                      Profit: <strong className="text-emerald-700 font-mono">₵{(newProduct.sellingPrice - newProduct.costPrice).toFixed(2)}</strong>
                    </span>
                    <span>
                      Margin: <strong className="text-[#d07b00] font-mono">
                        {newProduct.sellingPrice > 0 ? (((newProduct.sellingPrice - newProduct.costPrice) / newProduct.sellingPrice) * 100).toFixed(1) : 0}%
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Stock Controls */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Initial Stock Level *</label>
                    <input 
                      type="number" 
                      required 
                      min="0" 
                      className="bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900 font-mono" 
                      value={newProduct.stockLevel} 
                      onChange={(e) => setNewProduct({ ...newProduct, stockLevel: parseInt(e.target.value) || 0 })} 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Low Stock Alert Level *</label>
                    <input 
                      type="number" 
                      required 
                      min="0" 
                      className="bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900 font-mono" 
                      value={newProduct.reorderLevel} 
                      onChange={(e) => setNewProduct({ ...newProduct, reorderLevel: parseInt(e.target.value) || 0 })} 
                    />
                  </div>
                </div>

                {/* Image Upload & URL */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Product Image (File or URL)</label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="url"
                      placeholder="Paste image URL (Cloudinary, etc.)"
                      className="flex-1 bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900"
                      value={newProduct.image}
                      onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                    />
                    <label className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
                      <ImageIcon className="w-4 h-4 text-gray-500" />
                      Browse File
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageFileChange(e, newProduct, setNewProduct)} 
                      />
                    </label>
                  </div>
                  {newProduct.image && (
                    <div className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl">
                      <img src={newProduct.image} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-gray-200" onError={(e) => { e.target.style.display = 'none'; }} />
                      <span className="text-xs text-gray-500 font-medium">Image Preview Ready</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase">Description (Storefront Detail View)</label>
                  <textarea
                    rows={2}
                    placeholder="Floral notes, harvest origin, health benefits..."
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2 rounded-xl text-sm text-gray-900"
                    value={newProduct.description || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  />
                </div>

                {/* Active Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="checkbox" 
                    id="new-active-check" 
                    checked={newProduct.isActive} 
                    onChange={(e) => setNewProduct({ ...newProduct, isActive: e.target.checked })} 
                    className="rounded border-gray-300 text-[#ffa200] focus:ring-[#ffa200]" 
                  />
                  <label htmlFor="new-active-check" className="text-xs font-bold text-gray-700 cursor-pointer">
                    Visible immediately on public storefront
                  </label>
                </div>

                <div className="pt-3 flex gap-3">
                  <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-3 px-4 bg-[#ffa200] hover:bg-[#e69100] text-black font-extrabold rounded-xl text-xs shadow-md">
                    Save Product
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* 3. EDIT PRODUCT MODAL */}
        {editingId !== null && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl w-full max-w-xl space-y-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-display font-extrabold text-gray-900">Edit Product</h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">#{editingId}</p>
                </div>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={(e) => handleEditSubmit(e, editingId)} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase">Product Name *</label>
                  <input type="text" required className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900" value={editProduct.name} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Category</label>
                    <select className="bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900" value={editProduct.category} onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}>
                      {CATEGORIES.slice(1).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Size / Spec</label>
                    <input type="text" required className="bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900" value={editProduct.spec} onChange={(e) => setEditProduct({ ...editProduct, spec: e.target.value })} />
                  </div>
                </div>

                {/* Pricing & Margin */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {canViewCost && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-700 uppercase">Cost Price (₵)</label>
                        <input type="number" step="0.01" className="bg-white border border-gray-200 focus:border-[#ffa200] px-3 py-2 rounded-lg text-sm text-gray-900 font-mono" value={editProduct.costPrice} onChange={(e) => setEditProduct({ ...editProduct, costPrice: parseFloat(e.target.value) || 0 })} />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-700 uppercase">Selling Price (₵) *</label>
                      <input type="number" step="0.01" required className="bg-white border border-gray-200 focus:border-[#ffa200] px-3 py-2 rounded-lg text-sm text-gray-900 font-mono" value={editProduct.sellingPrice} onChange={(e) => setEditProduct({ ...editProduct, sellingPrice: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200/80 font-medium text-gray-600">
                    <span>
                      Profit: <strong className="text-emerald-700 font-mono">₵{(editProduct.sellingPrice - (editProduct.costPrice || 0)).toFixed(2)}</strong>
                    </span>
                    <span>
                      Margin: <strong className="text-[#d07b00] font-mono">
                        {editProduct.sellingPrice > 0 ? (((editProduct.sellingPrice - (editProduct.costPrice || 0)) / editProduct.sellingPrice) * 100).toFixed(1) : 0}%
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Stock Level</label>
                    <input type="number" min="0" className="bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900 font-mono" value={editProduct.stockLevel} onChange={(e) => setEditProduct({ ...editProduct, stockLevel: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Min Alert Level</label>
                    <input type="number" min="0" className="bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900 font-mono" value={editProduct.reorderLevel} onChange={(e) => setEditProduct({ ...editProduct, reorderLevel: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>

                {/* Image Upload & URL */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Product Image (File or URL)</label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="url"
                      placeholder="Paste image link"
                      className="flex-1 bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2.5 rounded-xl text-sm text-gray-900"
                      value={editProduct.image || ''}
                      onChange={(e) => setEditProduct({ ...editProduct, image: e.target.value })}
                    />
                    <label className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
                      <ImageIcon className="w-4 h-4 text-gray-500" />
                      Browse
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageFileChange(e, editProduct, setEditProduct)} 
                      />
                    </label>
                  </div>
                  {editProduct.image && (
                    <div className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl">
                      <img src={editProduct.image} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-gray-200" onError={(e) => { e.target.style.display = 'none'; }} />
                      <span className="text-xs text-gray-500 font-medium">Active Thumbnail</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase">Description</label>
                  <textarea
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ffa200] px-3.5 py-2 rounded-xl text-sm text-gray-900"
                    value={editProduct.description || ''}
                    onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
                  />
                </div>

                {/* Active Toggle Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="checkbox" 
                    id="edit-active-check" 
                    checked={editProduct.isActive !== false} 
                    onChange={(e) => setEditProduct({ ...editProduct, isActive: e.target.checked })} 
                    className="rounded border-gray-300 text-[#ffa200] focus:ring-[#ffa200]" 
                  />
                  <label htmlFor="edit-active-check" className="text-xs font-bold text-gray-700 cursor-pointer">
                    Visible on public customer storefront
                  </label>
                </div>

                <div className="pt-3 flex gap-3">
                  <button type="button" onClick={() => setEditingId(null)} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-3 px-4 bg-[#ffa200] hover:bg-[#e69100] text-black font-extrabold rounded-xl text-xs shadow-md">
                    Save Changes
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
