'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { PRESET_TAXES } from '@/utils/taxPresets';
import {
  ReceiptText, Plus, X, Search, Send, Download, Eye,
  Printer, Calendar, DollarSign, User, Hash, Mail,
  CheckCircle2, Trash2, ArrowLeft, RefreshCw,
  ChevronRight, ChevronDown, Check, Building, Smartphone, MapPin, MoreVertical, Edit, Copy, Loader2, MessageSquare,
  Package, FileText, ArrowUpRight, CreditCard, Wallet, Banknote, Sparkles, Filter, Link as LinkIcon, Unlink, UserCheck
} from 'lucide-react';

const COMPANY = {
  name: 'The Honey Palace',
  slogan: 'The Home of Quality Honey',
  address: 'Inside GreenField Estate, Amrahia - Accra, Ghana',
  phone: '+233 54 883 4874',
  email: 'purchases@thehoneypalaceafrica.com',
  website: 'thehoneypalaceafrica.com',
  logoUrl: '/assets/honey-palace-logo.png'
};

const PAYMENT_METHODS = [
  { id: 'Mobile Money', label: 'Mobile Money (MoMo)', icon: Smartphone },
  { id: 'Cash', label: 'Cash', icon: Banknote },
  { id: 'Card / POS', label: 'Card / POS Terminal', icon: CreditCard },
  { id: 'Bank Transfer', label: 'Bank Transfer', icon: Building },
  { id: 'Cheque', label: 'Cheque', icon: FileText },
  { id: 'Other', label: 'Other', icon: Wallet },
];

function ReceiptsContent() {
  const { user } = useAuth();
  const { showConfirm } = useUI();
  const { settings } = useStoreSettings();
  const searchParams = useSearchParams();

  const [receipts, setReceipts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [activeMenuReceipt, setActiveMenuReceipt] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [sending, setSending] = useState(false);

  // Email / SMS Modal States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendSmsAlso, setSendSmsAlso] = useState(false);
  const [emailPreviewReceipt, setEmailPreviewReceipt] = useState(null);

  // Quick Customer Add
  const [showQuickAddCust, setShowQuickAddCust] = useState(false);
  const [quickCust, setQuickCust] = useState({ name: '', email: '', phone: '', company: '', address: '' });
  const [addingCust, setAddingCust] = useState(false);

  // Smart Client Search in Creation Form
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef(null);

  // Smart Invoice Search in Creation Form
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const invoiceSearchRef = useRef(null);

  // Product autocompletion dropdown per line
  const [activeProductDropdownIdx, setActiveProductDropdownIdx] = useState(null);

  // Header Searchable Invoice Import Popover State
  const [headerInvoiceSearch, setHeaderInvoiceSearch] = useState('');
  const [showHeaderInvoiceDropdown, setShowHeaderInvoiceDropdown] = useState(false);
  const headerInvoiceRef = useRef(null);

  const printRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  // Form State
  const [form, setForm] = useState({
    receiptNumber: '',
    invoiceNumber: '',
    invoiceId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    customerCompany: '',
    receiptDate: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Mobile Money',
    paymentReference: '',
    notes: 'Thank you for your business! Payment received with thanks.',
    discount: '0',
    taxes: [],
    items: [{ name: '', description: '', quantity: 1, unitPrice: '' }],
    applyWht: false,
    whtRate: '0',
    whtAmount: '0',
    isCustomWhtAmount: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll and handle Escape key when modals are open
  useEffect(() => {
    if (isCreating || viewingReceipt) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setIsCreating(false);
          setViewingReceipt(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isCreating, viewingReceipt]);

  // Listen to Firestore
  useEffect(() => {
    if (!db || !user) {
      setLoading(false);
      return;
    }

    const unsubReceipts = onSnapshot(collection(db, 'receipts'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setReceipts(list);
      setLoading(false);
    }, (err) => {
      console.warn('[Receipts] Firestore notice:', err.message);
      setLoading(false);
    });

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setInvoices(list);
    }, (err) => console.warn('[Invoices for Receipts] notice:', err.message));

    const unsubProd = onSnapshot(collection(db, 'products'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setProducts(list);
    }, (err) => console.warn('[Products for Receipts] notice:', err.message));

    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setCustomers(list);
    }, (err) => console.warn('[Customers for Receipts] notice:', err.message));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setUsersList(list);
    }, (err) => console.warn('[Users for Receipts] notice:', err.message));

    return () => {
      unsubReceipts();
      unsubInvoices();
      unsubProd();
      unsubCust();
      unsubUsers();
    };
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
      if (invoiceSearchRef.current && !invoiceSearchRef.current.contains(e.target)) {
        setShowInvoiceDropdown(false);
      }
      if (headerInvoiceRef.current && !headerInvoiceRef.current.contains(e.target)) {
        setShowHeaderInvoiceDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Dynamic Floating Actions Menu positioning and listeners
  const handleOpenMenu = (e, receipt) => {
    e.stopPropagation();
    if (activeMenuReceipt?.id === receipt.id) {
      setActiveMenuReceipt(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 170;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight;

    setMenuPosition({
      top: openUpwards ? (rect.top - menuHeight + 2) : (rect.bottom + 4),
      left: Math.max(10, Math.min(window.innerWidth - menuWidth - 10, rect.right - menuWidth)),
    });
    setActiveMenuReceipt(receipt);
  };

  useEffect(() => {
    if (!activeMenuReceipt) return;
    const handleClose = () => setActiveMenuReceipt(null);
    const handleClickOutside = (e) => {
      if (!e.target.closest('#receipt-floating-menu') && !e.target.closest('.receipt-menu-btn')) {
        setActiveMenuReceipt(null);
      }
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    document.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeMenuReceipt]);

  const generateReceiptNumber = () => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `REC-${rand}`;
  };

  // Handle URL query parameters (e.g. ?invoiceId=... or ?create=true)
  useEffect(() => {
    const invId = searchParams.get('invoiceId');
    if (invId && invoices.length > 0) {
      const inv = invoices.find(i => i.id === invId || i.invoiceNumber === invId);
      if (inv) {
        importFromInvoiceData(inv);
      }
    } else if (searchParams.get('create') === 'true') {
      startNewReceipt();
    }
  }, [searchParams, invoices]);

  const startNewReceipt = () => {
    setEditingReceiptId(null);
    setForm({
      receiptNumber: generateReceiptNumber(),
      invoiceNumber: '',
      invoiceId: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      customerCompany: '',
      receiptDate: new Date().toISOString().split('T')[0],
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Mobile Money',
      paymentReference: '',
      notes: 'Thank you for your business! Payment received with thanks.',
      discount: '0',
      taxes: [],
      items: [{ name: '', description: '', quantity: 1, unitPrice: '' }],
      applyWht: false,
      whtRate: '0',
      whtAmount: '0',
      isCustomWhtAmount: false,
    });
    setIsCreating(true);
    setViewingReceipt(null);
    setOpenMenuId(null);
    setClientSearchQuery('');
    setShowClientDropdown(false);
    setInvoiceSearchQuery('');
    setShowInvoiceDropdown(false);
    setSelectedInvoiceForImport('');
  };

  // Featured Invoice Import: populates EVERYTHING from selected invoice
  const importFromInvoiceData = (inv) => {
    setEditingReceiptId(null);
    let initialTaxes = [];
    if (Array.isArray(inv.taxes) && inv.taxes.length > 0) {
      initialTaxes = inv.taxes.map(t => ({
        name: t.name || 'VAT (Standard)',
        rate: t.rate !== undefined ? t.rate.toString() : '0',
        isDeduction: Boolean(t.isDeduction || (t.name && (t.name.toLowerCase().includes('withholding') || t.name.toLowerCase().includes('wht')))),
        isCustom: Boolean(t.isCustom)
      }));
    } else if (inv.vat && inv.subtotal) {
      const approxRate = ((inv.vat / Math.max(1, inv.subtotal - (inv.discount || 0))) * 100).toFixed(1);
      initialTaxes = [{ name: 'VAT (Standard)', rate: approxRate, isDeduction: false }];
    }

    const newItems = (inv.items && inv.items.length > 0) ? inv.items.map(i => ({
      name: i.name || '',
      description: i.description || '',
      quantity: i.quantity || 1,
      unitPrice: (i.unitPrice !== undefined ? i.unitPrice : (i.price || 0)).toString()
    })) : [{ name: '', description: '', quantity: 1, unitPrice: '' }];

    setForm({
      receiptNumber: generateReceiptNumber(),
      invoiceNumber: inv.invoiceNumber || '',
      invoiceId: inv.id || '',
      customerName: inv.customerName || '',
      customerEmail: inv.customerEmail || '',
      customerPhone: inv.customerPhone || '',
      customerAddress: inv.customerAddress || '',
      customerCompany: inv.customerCompany || '',
      receiptDate: new Date().toISOString().split('T')[0],
      paymentDate: inv.paidAt ? new Date(inv.paidAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      paymentMethod: inv.paymentMethod || 'Mobile Money',
      paymentReference: inv.paymentReference || '',
      notes: inv.notes || `Official Receipt issued for Invoice #${inv.invoiceNumber || ''}. Payment received in full with thanks.`,
      discount: (inv.discount || 0).toString(),
      taxes: initialTaxes,
      items: newItems,
      applyWht: false,
      whtRate: '0',
      whtAmount: '0',
      isCustomWhtAmount: false,
    });

    setIsCreating(true);
    setViewingReceipt(null);
    setShowInvoiceDropdown(false);
    setInvoiceSearchQuery('');
    toast.success(`Featured and loaded all data from Invoice #${inv.invoiceNumber}`);
  };

  const unlinkInvoice = () => {
    setForm(prev => ({
      ...prev,
      invoiceNumber: '',
      invoiceId: ''
    }));
    toast.info('Detached linked invoice reference.');
  };

  const startEditReceipt = (receipt) => {
    setOpenMenuId(null);
    setEditingReceiptId(receipt.id);

    let initialTaxes = [];
    if (Array.isArray(receipt.taxes) && receipt.taxes.length > 0) {
      initialTaxes = receipt.taxes.map(t => ({
        name: t.name || 'VAT (Standard)',
        rate: t.rate !== undefined ? t.rate.toString() : '0',
        isDeduction: Boolean(t.isDeduction || (t.name && (t.name.toLowerCase().includes('withholding') || t.name.toLowerCase().includes('wht')))),
        isCustom: Boolean(t.isCustom)
      }));
    }

    setForm({
      receiptNumber: receipt.receiptNumber || generateReceiptNumber(),
      invoiceNumber: receipt.invoiceNumber || '',
      invoiceId: receipt.invoiceId || '',
      customerName: receipt.customerName || '',
      customerEmail: receipt.customerEmail || '',
      customerPhone: receipt.customerPhone || '',
      customerAddress: receipt.customerAddress || '',
      customerCompany: receipt.customerCompany || '',
      receiptDate: receipt.receiptDate || new Date().toISOString().split('T')[0],
      paymentDate: receipt.paymentDate || new Date().toISOString().split('T')[0],
      paymentMethod: receipt.paymentMethod || 'Mobile Money',
      paymentReference: receipt.paymentReference || '',
      notes: receipt.notes || 'Thank you for your business!',
      discount: (receipt.discount || 0).toString(),
      taxes: initialTaxes,
      items: (receipt.items || []).map(i => ({
        name: i.name || '',
        description: i.description || '',
        quantity: i.quantity || 1,
        unitPrice: (i.unitPrice || 0).toString()
      })),
      applyWht: Boolean(receipt.applyWht || (receipt.whtAmount && Number(receipt.whtAmount) > 0)),
      whtRate: receipt.whtRate !== undefined ? receipt.whtRate.toString() : (receipt.whtAmount && Number(receipt.whtAmount) > 0 ? ((Number(receipt.whtAmount) / (Number(receipt.invoiceValue || receipt.total) || 1)) * 100).toFixed(1) : '0'),
      whtAmount: receipt.whtAmount !== undefined && Number(receipt.whtAmount) > 0 ? Number(receipt.whtAmount).toFixed(2) : '0',
      isCustomWhtAmount: Boolean(receipt.whtAmount && Number(receipt.whtAmount) > 0),
    });
    setIsCreating(true);
    setViewingReceipt(null);
  };

  const handleSoftDelete = async (receipt) => {
    setOpenMenuId(null);
    const confirmed = await showConfirm({
      title: 'Delete Receipt',
      message: `Are you sure you want to delete receipt ${receipt.receiptNumber}? This record will be archived.`,
      confirmText: 'Delete Receipt',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'receipts', receipt.id), {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: user?.full_name || 'System'
      });
      toast.success(`Receipt ${receipt.receiptNumber} deleted.`);
      if (viewingReceipt?.id === receipt.id) setViewingReceipt(null);
    } catch (err) {
      console.warn('Firestore delete notice, applying local state fallback:', err.message);
      setReceipts(prev => prev.map(r => r.id === receipt.id ? { ...r, isDeleted: true } : r));
      toast.success(`Receipt ${receipt.receiptNumber} deleted.`);
      if (viewingReceipt?.id === receipt.id) setViewingReceipt(null);
    }
  };

  // Line Items Calculation
  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { name: '', description: '', quantity: 1, unitPrice: '' }]
    }));
  };

  const removeLineItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const updateLineItem = (idx, field, value) => {
    setForm(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const updateLineItemMultiple = (idx, updates) => {
    setForm(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], ...updates };
      return { ...prev, items: updated };
    });
  };

  const addTaxRow = () => {
    setForm(prev => ({
      ...prev,
      taxes: [...(prev.taxes || []), { name: 'VAT (Standard)', rate: '15', isDeduction: false }]
    }));
  };

  const removeTaxRow = (idx) => {
    setForm(prev => ({
      ...prev,
      taxes: (prev.taxes || []).filter((_, i) => i !== idx)
    }));
  };

  const updateTaxRow = (idx, fieldOrUpdates, value) => {
    setForm(prev => {
      const updated = [...(prev.taxes || [])];
      if (typeof fieldOrUpdates === 'object' && fieldOrUpdates !== null) {
        updated[idx] = { ...updated[idx], ...fieldOrUpdates };
      } else {
        updated[idx] = { ...updated[idx], [fieldOrUpdates]: value };
      }
      return { ...prev, taxes: updated };
    });
  };

  const calcSubtotal = (items) => (items || []).reduce((s, i) => s + ((parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 0)), 0);

  const calcTaxes = (sub, discount, taxList) => {
    const net = Math.max(0, sub - (parseFloat(discount) || 0));
    return (taxList || []).map(t => {
      const rate = parseFloat(t.rate) || 0;
      const amount = net * (rate / 100);
      const isDeduction = Boolean(t.isDeduction || (t.name && (t.name.toLowerCase().includes('withholding') || t.name.toLowerCase().includes('wht'))));
      return { name: t.name || 'Tax', rate, amount, isDeduction, isCustom: t.isCustom };
    });
  };

  const calcTotalTaxAmount = (taxCalculatedList) => {
    return (taxCalculatedList || []).reduce((sum, t) => {
      return sum + (t.isDeduction ? 0 : (t.amount || 0));
    }, 0);
  };

  const calculateInvoiceValue = (items = form.items, discount = form.discount, taxes = form.taxes) => {
    const sub = calcSubtotal(items);
    const net = Math.max(0, sub - (parseFloat(discount) || 0));
    const computedTaxes = calcTaxes(sub, discount, taxes);
    const additions = computedTaxes.filter(t => !t.isDeduction).reduce((sum, t) => sum + (t.amount || 0), 0);
    return net + additions;
  };

  const calculateWhtAmount = (invoiceValue, applyWht = form.applyWht, whtRate = form.whtRate, customWhtAmount = form.whtAmount) => {
    const computedTaxes = calcTaxes(calcSubtotal(form.items), form.discount, form.taxes);
    const taxDeductions = computedTaxes.filter(t => t.isDeduction).reduce((sum, t) => sum + (t.amount || 0), 0);
    if (taxDeductions > 0) return taxDeductions;
    if (customWhtAmount && Number(customWhtAmount) > 0) return Number(customWhtAmount);
    const rate = parseFloat(whtRate) || 0;
    if (rate > 0) return invoiceValue * (rate / 100);
    return 0;
  };

  const calculateActualAmountPaid = (items = form.items, discount = form.discount, taxes = form.taxes) => {
    const invValue = calculateInvoiceValue(items, discount, taxes);
    const computedTaxes = calcTaxes(calcSubtotal(items), discount, taxes);
    const deductions = computedTaxes.filter(t => t.isDeduction).reduce((sum, t) => sum + (t.amount || 0), 0);
    return Math.max(0, invValue - deductions);
  };

  const calculateTotal = (items = form.items, discount = form.discount, taxes = form.taxes) => {
    return calculateActualAmountPaid(items, discount, taxes);
  };

  const buildWhtDescription = (invNumber, invValue, withheldVal) => {
    const invLabel = invNumber ? ` #${invNumber}` : '';
    const invAmountFormatted = Number(invValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const withheldFormatted = Number(withheldVal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `Being Payment for invoice${invLabel} (GHS ${invAmountFormatted}), with Ghc ${withheldFormatted} withheld as WHT pending receipt of GRA withholding certificate`;
  };

  // Save / Submit
  const handleSaveReceipt = async (e) => {
    if (e) e.preventDefault();
    if (!form.customerName.trim()) {
      toast.error('Please select or fill in client details.');
      return;
    }
    if (form.items.some(i => !i.name.trim() || !i.unitPrice)) {
      toast.error('Please enter description and unit price for all items.');
      return;
    }

    const subtotal = calcSubtotal(form.items);
    const discountVal = parseFloat(form.discount) || 0;
    const discountedSubtotal = Math.max(0, subtotal - discountVal);
    const computedTaxes = calcTaxes(subtotal, form.discount, form.taxes);
    const additions = computedTaxes.filter(t => !t.isDeduction).reduce((sum, t) => sum + (t.amount || 0), 0);
    const deductions = computedTaxes.filter(t => t.isDeduction).reduce((sum, t) => sum + (t.amount || 0), 0);
    const invoiceValue = discountedSubtotal + additions;
    const totalTaxVal = additions;
    const actualAmountPaid = Math.max(0, invoiceValue - deductions);

    const firstWht = computedTaxes.find(t => t.isDeduction && t.amount > 0);
    const applyWht = Boolean(firstWht && deductions > 0);
    const whtRate = firstWht ? firstWht.rate : 0;
    const whtAmount = deductions;

    const payload = {
      receiptNumber: form.receiptNumber.trim() || generateReceiptNumber(),
      invoiceNumber: form.invoiceNumber.trim() || null,
      invoiceId: form.invoiceId || null,
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim(),
      customerPhone: form.customerPhone.trim(),
      customerAddress: form.customerAddress.trim(),
      customerCompany: form.customerCompany.trim(),
      receiptDate: form.receiptDate,
      paymentDate: form.paymentDate,
      paymentMethod: form.paymentMethod,
      paymentReference: form.paymentReference.trim(),
      notes: form.notes.trim(),
      discount: discountVal,
      taxes: computedTaxes,
      vat: totalTaxVal,
      invoiceValue,
      applyWht,
      whtRate: applyWht ? Number(Number(whtRate).toFixed(2)) : 0,
      whtAmount: applyWht ? Number(Number(whtAmount).toFixed(2)) : 0,
      actualAmountPaid,
      items: form.items.map(i => ({
        name: i.name,
        description: i.description || '',
        quantity: parseInt(i.quantity) || 1,
        unitPrice: parseFloat(i.unitPrice) || 0,
        total: (parseInt(i.quantity) || 1) * (parseFloat(i.unitPrice) || 0)
      })),
      subtotal,
      total: actualAmountPaid,
      status: 'issued',
      updatedAt: new Date().toISOString(),
      ...(editingReceiptId ? {} : { createdAt: new Date().toISOString(), createdBy: user?.full_name || 'Staff' }),
    };

    setIsSaving(true);
    try {
      let targetId = editingReceiptId;
      if (editingReceiptId) {
        await updateDoc(doc(db, 'receipts', editingReceiptId), payload);
        setReceipts(prev => prev.map(r => r.id === editingReceiptId ? { ...payload, id: editingReceiptId } : r));
      } else {
        const docRef = await addDoc(collection(db, 'receipts'), payload);
        targetId = docRef.id;
        setReceipts(prev => [{ ...payload, id: targetId }, ...prev]);
      }

      toast.success(editingReceiptId ? `Receipt ${form.receiptNumber} updated!` : `Receipt ${form.receiptNumber} generated!`);
      setIsCreating(false);
      setEditingReceiptId(null);
      setViewingReceipt({ ...payload, id: targetId });
    } catch (err) {
      console.warn('Firestore notice (Sandbox/Auth fallback):', err.message);
      const targetId = editingReceiptId || `rec-${Date.now()}`;
      const savedObj = { ...payload, id: targetId };

      setReceipts(prev => {
        const idx = prev.findIndex(x => x.id === targetId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedObj;
          return next;
        }
        return [savedObj, ...prev];
      });

      toast.success(editingReceiptId ? `Receipt ${form.receiptNumber} updated!` : `Receipt ${form.receiptNumber} generated!`);
      setIsCreating(false);
      setEditingReceiptId(null);
      setViewingReceipt(savedObj);
    } finally {
      setIsSaving(false);
    }
  };

  // Consolidated System Contacts (Customers + Users)
  const allSystemContacts = useMemo(() => {
    const map = new Map();

    // 1. Add customers
    (customers || []).forEach(c => {
      const key = (c.email || c.phone || c.name || c.id || '').toLowerCase();
      map.set(key, {
        id: c.id,
        name: c.name || c.full_name || 'Customer',
        email: c.email || '',
        phone: c.phone || c.phoneNumber || '',
        company: c.company || c.businessName || '',
        address: c.address || c.location || '',
        category: c.customer_type || 'Customer',
        isUser: false
      });
    });

    // 2. Add system users (if not already mapped)
    (usersList || []).forEach(u => {
      const key = (u.email || u.phone || u.full_name || u.id || '').toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: u.id,
          name: u.full_name || u.name || u.email || 'System User',
          email: u.email || '',
          phone: u.phone || '',
          company: u.company || '',
          address: u.address || '',
          category: u.roles ? u.roles.join(', ') : 'Staff',
          isUser: true
        });
      }
    });

    return Array.from(map.values());
  }, [customers, usersList]);

  // Smart Client Search filtering across ANY attribute
  const filteredSystemContacts = useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return allSystemContacts;
    return allSystemContacts.filter(c => {
      const name = (c.name || '').toLowerCase();
      const company = (c.company || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const address = (c.address || '').toLowerCase();
      const category = (c.category || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      return name.includes(q) || company.includes(q) || email.includes(q) || phone.includes(q) || address.includes(q) || category.includes(q) || id.includes(q);
    });
  }, [allSystemContacts, clientSearchQuery]);

  const selectCustomer = (contact) => {
    if (contact) {
      setForm(prev => ({
        ...prev,
        customerName: contact.name || '',
        customerEmail: contact.email || '',
        customerPhone: contact.phone || '',
        customerAddress: contact.address || '',
        customerCompany: contact.company || '',
      }));
      setClientSearchQuery('');
      setShowClientDropdown(false);
      toast.success(`Selected ${contact.name}`);
    }
  };

  const clearSelectedCustomer = () => {
    setForm(prev => ({
      ...prev,
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      customerCompany: '',
    }));
    setClientSearchQuery('');
    setShowClientDropdown(false);
  };

  // Smart Invoice Search filtering across ANY attribute
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearchQuery.trim().toLowerCase();
    const activeInvoices = invoices.filter(i => !i.isDeleted);
    if (!q) return activeInvoices;
    return activeInvoices.filter(inv => {
      const invNum = (inv.invoiceNumber || '').toLowerCase();
      const custName = (inv.customerName || '').toLowerCase();
      const company = (inv.customerCompany || '').toLowerCase();
      const email = (inv.customerEmail || '').toLowerCase();
      const phone = (inv.customerPhone || '').toLowerCase();
      const poNum = (inv.poNumber || '').toLowerCase();
      const status = (inv.status || '').toLowerCase();
      const totalStr = (inv.total || '').toString();
      const itemsMatch = (inv.items || []).some(item => 
        (item.name || '').toLowerCase().includes(q) || 
        (item.description || '').toLowerCase().includes(q)
      );
      return invNum.includes(q) || custName.includes(q) || company.includes(q) || email.includes(q) || phone.includes(q) || poNum.includes(q) || status.includes(q) || totalStr.includes(q) || itemsMatch;
    });
  }, [invoices, invoiceSearchQuery]);

  const handleQuickAddCust = async (e) => {
    e.preventDefault();
    if (!quickCust.name.trim()) {
      toast.error('Customer name is required.');
      return;
    }
    setAddingCust(true);
    const custData = {
      name: quickCust.name.trim(),
      email: quickCust.email.trim(),
      phone: quickCust.phone.trim(),
      company: quickCust.company.trim(),
      address: quickCust.address.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user?.full_name || 'Staff'
    };

    try {
      const docRef = await addDoc(collection(db, 'customers'), custData);
      setCustomers(prev => [{ ...custData, id: docRef.id }, ...prev]);
      setForm(prev => ({
        ...prev,
        customerName: custData.name,
        customerEmail: custData.email,
        customerPhone: custData.phone,
        customerCompany: custData.company,
        customerAddress: custData.address,
      }));
      toast.success(`Client ${custData.name} saved and selected!`);
      setShowQuickAddCust(false);
      setQuickCust({ name: '', email: '', phone: '', company: '', address: '' });
    } catch (err) {
      console.warn('Firestore customer notice, using local state:', err.message);
      const newCust = { ...custData, id: `cust-${Date.now()}` };
      setCustomers(prev => [newCust, ...prev]);
      setForm(prev => ({
        ...prev,
        customerName: custData.name,
        customerEmail: custData.email,
        customerPhone: custData.phone,
        customerCompany: custData.company,
        customerAddress: custData.address,
      }));
      toast.success(`Client ${custData.name} saved and selected!`);
      setShowQuickAddCust(false);
      setQuickCust({ name: '', email: '', phone: '', company: '', address: '' });
    } finally {
      setAddingCust(false);
    }
  };

  // Print & PDF Export
  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${viewingReceipt?.receiptNumber || 'Official Receipt'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          html, body {
            min-height: 100vh;
            margin: 0;
            padding: 24px 16px;
            font-family: 'Poppins', sans-serif;
            background-color: #f1f5f9;
            color: #111;
            display: flex;
            justify-content: center;
          }
          .receipt-print-wrapper {
            background-color: #ffffff;
            padding: 40px;
            margin: 0 auto;
            max-width: 800px;
            width: 100%;
            min-height: 1050px;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box;
          }
          .receipt-body {
            flex: 1 0 auto !important;
          }
          .receipt-footer {
            margin-top: auto !important;
            padding-top: 16px !important;
            border-top: 1px solid #e5e7eb !important;
            flex-shrink: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @media print {
            html, body {
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: #ffffff !important;
              display: block !important;
            }
            .receipt-print-wrapper {
              background-color: #ffffff !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
              min-height: 270mm !important;
              height: 100% !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
            }
            .receipt-body {
              flex: 1 0 auto !important;
            }
            .receipt-footer {
              margin-top: auto !important;
              padding-top: 16px !important;
              border-top: 1px solid #e5e7eb !important;
              flex-shrink: 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-print-wrapper">
          ${printRef.current.innerHTML}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onafterprint = () => {
      try {
        printWindow.close();
      } catch (e) {}
    };
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  // Email / SMS Dispatch
  const handleOpenEmailModal = (receipt) => {
    setEmailPreviewReceipt(receipt);
    setEmailRecipient(receipt.customerEmail || '');
    setSendSmsAlso(Boolean(receipt.customerPhone));
    setShowEmailModal(true);
  };

  const handleSendReceiptEmailAndSMS = async () => {
    if (!emailPreviewReceipt) return;
    if (!emailRecipient.trim() && !sendSmsAlso) {
      toast.error('Please specify an email address or enable SMS dispatch.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: emailRecipient.trim(),
          customerPhone: emailPreviewReceipt.customerPhone,
          channel: sendSmsAlso && emailRecipient.trim() ? 'both' : (emailRecipient.trim() ? 'email' : 'sms'),
          receipt: {
            id: emailPreviewReceipt.receiptNumber,
            total: Number(emailPreviewReceipt.total || 0),
            subtotal: Number(emailPreviewReceipt.subtotal || 0),
            discount: Number(emailPreviewReceipt.discount || 0),
            tax: Number(emailPreviewReceipt.vat || 0),
            cartItems: emailPreviewReceipt.items || [],
            paidAt: emailPreviewReceipt.paymentDate || emailPreviewReceipt.receiptDate || new Date().toISOString(),
            sale_date: emailPreviewReceipt.receiptDate
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch receipt');
      }

      toast.success(`Receipt successfully sent to customer!`);
      setShowEmailModal(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to send receipt.');
    } finally {
      setSending(false);
    }
  };

  // Filtered List
  const activeReceipts = useMemo(() => {
    return receipts.filter(r => !r.isDeleted);
  }, [receipts]);

  const filteredReceipts = useMemo(() => {
    return activeReceipts.filter(r => {
      const matchesSearch = 
        (r.receiptNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.customerPhone || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.customerEmail || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.paymentReference || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.invoiceNumber || '').toLowerCase().includes(search.toLowerCase());

      const matchesMethod = methodFilter === 'all' || r.paymentMethod === methodFilter;

      return matchesSearch && matchesMethod;
    });
  }, [activeReceipts, search, methodFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalCollected = activeReceipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const count = activeReceipts.length;
    const avg = count > 0 ? totalCollected / count : 0;

    const currentMonth = new Date().toISOString().substring(0, 7);
    const thisMonthReceipts = activeReceipts.filter(r => (r.receiptDate || r.createdAt || '').startsWith(currentMonth));
    const thisMonthTotal = thisMonthReceipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

    const momoCount = activeReceipts.filter(r => r.paymentMethod === 'Mobile Money').length;
    const cashCount = activeReceipts.filter(r => r.paymentMethod === 'Cash').length;
    const cardCount = activeReceipts.filter(r => r.paymentMethod === 'Card / POS').length;
    const bankCount = activeReceipts.filter(r => r.paymentMethod === 'Bank Transfer').length;

    return {
      totalCollected,
      count,
      avg,
      thisMonthCount: thisMonthReceipts.length,
      thisMonthTotal,
      momoCount,
      cashCount,
      cardCount,
      bankCount
    };
  }, [activeReceipts]);

  // Filtered Header Invoices for Searchable Popover
  const filteredHeaderInvoices = useMemo(() => {
    const q = headerInvoiceSearch.trim().toLowerCase();
    const activeInvs = invoices.filter(i => !i.isDeleted);
    if (!q) return activeInvs;

    return activeInvs.filter(inv => {
      const invNum = (inv.invoiceNumber || '').toLowerCase();
      const custName = (inv.customerName || '').toLowerCase();
      const custPhone = (inv.customerPhone || '').toLowerCase();
      const custEmail = (inv.customerEmail || '').toLowerCase();
      const custCompany = (inv.customerCompany || '').toLowerCase();
      const totalStr = String(inv.total || '');
      const notes = (inv.notes || '').toLowerCase();
      const status = (inv.status || '').toLowerCase();
      const itemsMatch = (inv.items || []).some(item => 
        (item.name || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );

      return invNum.includes(q) ||
        custName.includes(q) ||
        custPhone.includes(q) ||
        custEmail.includes(q) ||
        custCompany.includes(q) ||
        totalStr.includes(q) ||
        notes.includes(q) ||
        status.includes(q) ||
        itemsMatch;
    });
  }, [invoices, headerInvoiceSearch]);

  if (!mounted) return null;

  return (
    <AuthShield requiredPermission="sale.view" alternativePermission="sale.create">
      <div className="min-h-screen bg-[#f8fafc] text-gray-900 pb-20">
        
        {/* Top Sticky Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#ffa200]/15 text-[#D07B00]">
                    <ReceiptText className="w-5 h-5" />
                  </div>
                  <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Official Receipts</h1>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Generate, manage, and print corporate receipts for customer settlements & invoices.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Searchable Import from Invoice Popover */}
                <div className="relative" ref={headerInvoiceRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHeaderInvoiceDropdown(!showHeaderInvoiceDropdown);
                      setHeaderInvoiceSearch('');
                    }}
                    className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-semibold py-2.5 px-3 rounded-xl shadow-xs cursor-pointer flex items-center gap-2 hover:bg-gray-50 transition"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-[#D07B00]" />
                    <span>Import from Invoice...</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showHeaderInvoiceDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showHeaderInvoiceDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="text-[11px] font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Search className="w-3.5 h-3.5 text-[#D07B00]" /> Search Invoice
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold">
                          {invoices.filter(i => !i.isDeleted).length} Invoices
                        </span>
                      </div>

                      {/* Small Search Bar at the Top */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search by #, client, phone, amount, item..."
                          value={headerInvoiceSearch}
                          onChange={(e) => setHeaderInvoiceSearch(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-7 py-2 text-xs font-medium focus:ring-2 focus:ring-[#ffa200] focus:bg-white focus:outline-hidden"
                        />
                        {headerInvoiceSearch && (
                          <button
                            type="button"
                            onClick={() => setHeaderInvoiceSearch('')}
                            className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Invoice List Results */}
                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-xl">
                        {filteredHeaderInvoices.length === 0 ? (
                          <div className="p-4 text-center text-gray-400 text-xs">
                            No invoices matched "{headerInvoiceSearch}"
                          </div>
                        ) : (
                          filteredHeaderInvoices.map((inv) => (
                            <button
                              key={inv.id}
                              type="button"
                              onClick={() => {
                                importFromInvoiceData(inv);
                                setShowHeaderInvoiceDropdown(false);
                                setHeaderInvoiceSearch('');
                              }}
                              className="w-full text-left p-2.5 hover:bg-amber-50/70 transition flex items-center justify-between gap-3 group cursor-pointer"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-gray-900 text-xs font-mono">
                                    #{inv.invoiceNumber}
                                  </span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                                    inv.status === 'paid' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {inv.status || 'draft'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-700 font-semibold truncate mt-0.5">
                                  {inv.customerName || 'Walk-in Client'}
                                </div>
                                {inv.customerPhone && (
                                  <div className="text-[10px] text-gray-400">
                                    {inv.customerPhone}
                                  </div>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <div className="font-black text-gray-900 text-xs">
                                  GHS {Number(inv.total || 0).toFixed(2)}
                                </div>
                                <div className="text-[10px] text-[#D07B00] group-hover:underline font-bold flex items-center justify-end gap-0.5">
                                  Import <ArrowUpRight className="w-3 h-3" />
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={startNewReceipt}
                  className="bg-[#ffa200] hover:bg-[#ff9100] text-black font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Issue New Receipt
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Body */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-1">
                <span>Total Receipts Issued</span>
                <ReceiptText className="w-4 h-4 text-[#D07B00]" />
              </div>
              <div className="text-2xl font-black text-gray-900">{stats.count}</div>
              <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                <span className="font-semibold text-[#D07B00]">{stats.thisMonthCount}</span> this month
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-1">
                <span>Total Value Collected</span>
                <DollarSign className="w-4 h-4 text-[#D07B00]" />
              </div>
              <div className="text-2xl font-black text-gray-900">
                GHS {stats.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                GHS {stats.thisMonthTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this month
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-1">
                <span>Average Receipt Value</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-gray-900">
                GHS {stats.avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">Across all transactions</div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-1">
                <span>Top Channel</span>
                <Smartphone className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
                <span>MoMo ({stats.momoCount})</span>
                <span className="text-xs font-normal text-gray-400">&bull; Cash ({stats.cashCount})</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1">POS Card ({stats.cardCount}) &bull; Bank ({stats.bankCount})</div>
            </div>
          </div>

          {/* Search & Filter Strip */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search receipts by receipt #, client, phone, reference, or invoice #..."
                className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#ffa200]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Payment Method Filters */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
              {['all', 'Mobile Money', 'Cash', 'Card / POS', 'Bank Transfer'].map(method => (
                <button
                  key={method}
                  onClick={() => setMethodFilter(method)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    methodFilter === method 
                      ? 'bg-black text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {method === 'all' ? 'All Methods' : method}
                </button>
              ))}
            </div>
          </div>

          {/* Receipts Table Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#ffa200] mb-2" />
                <p className="text-xs">Loading official receipts...</p>
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                  <ReceiptText className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-gray-800">No Receipts Found</h3>
                <p className="text-xs text-gray-500 max-w-sm mt-1 mb-4">
                  {search || methodFilter !== 'all' 
                    ? 'No receipts matched your search or filters.' 
                    : 'Issue your first official receipt from scratch or import from an existing customer invoice.'}
                </p>
                <button
                  onClick={startNewReceipt}
                  className="bg-[#ffa200] hover:bg-[#ff9100] text-black font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
                >
                  Issue New Receipt
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto min-h-[160px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4">Receipt #</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Payment Method</th>
                      <th className="py-3.5 px-4">Items</th>
                      <th className="py-3.5 px-4 text-right">Total Paid</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredReceipts.map((r) => {
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/70 transition">
                          {/* Receipt Number */}
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-gray-900 font-mono flex items-center gap-1.5">
                              <span>#{r.receiptNumber}</span>
                              {r.invoiceNumber && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-200">
                                  Inv #{r.invoiceNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">By {r.createdBy || 'Staff'}</div>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                            <div className="font-semibold text-gray-800">
                              {new Date(r.receiptDate || r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            {r.paymentDate && r.paymentDate !== r.receiptDate && (
                              <div className="text-[10px] text-gray-400">Paid: {new Date(r.paymentDate).toLocaleDateString('en-GB')}</div>
                            )}
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">{r.customerName || 'Walk-in Client'}</div>
                            <div className="text-[11px] text-gray-500 truncate max-w-[200px]">
                              {r.customerCompany || r.customerPhone || r.customerEmail || 'No contact specified'}
                            </div>
                          </td>

                          {/* Payment Method */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                              {r.paymentMethod === 'Mobile Money' && <Smartphone className="w-3 h-3 text-sky-600" />}
                              {r.paymentMethod === 'Cash' && <Banknote className="w-3 h-3 text-[#D07B00]" />}
                              {r.paymentMethod === 'Card / POS' && <CreditCard className="w-3 h-3 text-purple-600" />}
                              {r.paymentMethod === 'Bank Transfer' && <Building className="w-3 h-3 text-amber-600" />}
                              {r.paymentMethod || 'Paid'}
                            </span>
                            {r.paymentReference && (
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">Ref: {r.paymentReference}</div>
                            )}
                          </td>

                          {/* Items */}
                          <td className="py-3.5 px-4 text-gray-600">
                            <div className="font-semibold">{(r.items || []).length} item{(r.items || []).length === 1 ? '' : 's'}</div>
                            <div className="text-[11px] text-gray-400 truncate max-w-[180px]">
                              {(r.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                            </div>
                          </td>

                          {/* Total Paid */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="text-sm font-black text-gray-900 font-mono">
                              GHS {Number(r.actualAmountPaid || r.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {(r.applyWht || Number(r.whtAmount || 0) > 0) ? (
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                  WHT {r.whtRate || 3}% (-GHS {Number(r.whtAmount || 0).toFixed(2)})
                                </span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-800 font-bold flex items-center justify-end gap-1">
                                <Check className="w-3 h-3" /> Fully Paid
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setViewingReceipt(r)}
                                title="View & Print Receipt"
                                className="p-1.5 rounded-lg text-gray-600 hover:text-black hover:bg-gray-100 transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleOpenEmailModal(r)}
                                title="Email & SMS Receipt"
                                className="p-1.5 rounded-lg text-gray-600 hover:text-[#D07B00] hover:bg-amber-50 transition cursor-pointer"
                              >
                                <Send className="w-4 h-4" />
                              </button>

                              {/* 3-Dot Menu Button */}
                              <button
                                type="button"
                                onClick={(e) => handleOpenMenu(e, r)}
                                className={`p-1.5 rounded-lg text-gray-600 hover:text-black hover:bg-gray-100 transition cursor-pointer receipt-menu-btn ${
                                  activeMenuReceipt?.id === r.id ? 'bg-gray-100 text-black' : ''
                                }`}
                                title="Receipt Actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
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
        </div>

        {/* =========================================================================
            CREATE / EDIT RECEIPT MODAL (With Smart System Contact & Invoice Search)
           ========================================================================= */}
        {mounted && isCreating && typeof document !== 'undefined' && createPortal(
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCreating(false);
            }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-xs overflow-hidden"
          >
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-[94vh] max-h-[94vh]">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#ffa200]/20 text-[#D07B00]">
                    <ReceiptText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black text-gray-900 leading-tight">
                      {editingReceiptId ? 'Edit Receipt #' + form.receiptNumber : 'Issue Official Receipt'}
                    </h2>
                    <p className="text-xs text-gray-500">Pick user details from system or feature an invoice</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveReceipt} className="p-6 overflow-y-auto min-h-0 space-y-6 flex-1 text-xs">
                
                {/* 0. SMART INVOICE LINKING BAR */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 relative" ref={invoiceSearchRef}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-[#D07B00]" />
                      <span className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">
                        Feature & Link Invoice Data
                      </span>
                    </div>
                    {form.invoiceNumber && (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3 text-[#D07B00]" /> Linked to #{form.invoiceNumber}
                        </span>
                        <button
                          type="button"
                          onClick={unlinkInvoice}
                          className="text-[10px] text-gray-500 hover:text-red-600 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Unlink className="w-3 h-3" /> Unlink
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Smart Search across any invoice attribute */}
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="Search invoice by #, client name, phone, company, amount, or product name..."
                        value={invoiceSearchQuery}
                        onChange={(e) => {
                          setInvoiceSearchQuery(e.target.value);
                          setShowInvoiceDropdown(true);
                        }}
                        onFocus={() => setShowInvoiceDropdown(true)}
                        className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-8 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#ffa200] shadow-xs"
                      />
                      {invoiceSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setInvoiceSearchQuery('')}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Invoices Dropdown */}
                    {showInvoiceDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-gray-100 animate-in fade-in duration-150">
                        <div className="p-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                          <span>{filteredInvoices.length} Invoices Found</span>
                          <span>Click to auto-populate receipt</span>
                        </div>

                        {filteredInvoices.length === 0 ? (
                          <div className="p-4 text-center text-gray-400">
                            No invoices matched "{invoiceSearchQuery}"
                          </div>
                        ) : (
                          filteredInvoices.slice(0, 10).map(inv => (
                            <button
                              key={inv.id}
                              type="button"
                              onClick={() => importFromInvoiceData(inv)}
                              className="w-full text-left p-3 hover:bg-amber-50/70 transition flex items-center justify-between cursor-pointer"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-extrabold text-gray-900 text-xs">#{inv.invoiceNumber}</span>
                                  <span className="font-bold text-gray-800">&bull; {inv.customerName || 'Valued Client'}</span>
                                  {inv.customerCompany && (
                                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                      {inv.customerCompany}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-400">
                                  {(inv.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ') || 'No line items'}
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0 ml-3">
                                <div className="font-black text-gray-900 text-xs">GHS {Number(inv.total || 0).toFixed(2)}</div>
                                <div className="text-[10px] text-gray-400 capitalize">{inv.status || 'Invoice'}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 1. Header Grid: Receipt #, Dates, Payment Method */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-200/70">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Receipt No.</label>
                    <input
                      type="text"
                      value={form.receiptNumber}
                      onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-[#ffa200]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Receipt Date</label>
                    <input
                      type="date"
                      value={form.receiptDate}
                      onChange={(e) => setForm({ ...form, receiptDate: e.target.value })}
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#ffa200]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#ffa200]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Payment Method</label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-[#ffa200]"
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. SMART SYSTEM USER / CUSTOMER PICKER & TRANSACTION DETAILS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Smart System Contact Selector */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/70 relative" ref={clientSearchRef}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-[#D07B00]" />
                        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                          System User / Customer Details
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddCust(true)}
                        className="text-[11px] text-[#D07B00] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Quick Add New
                      </button>
                    </div>

                    {/* Selected Contact Card if already picked */}
                    {form.customerName && (
                      <div className="p-3 mb-2 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#ffa200] text-black font-extrabold flex items-center justify-center text-xs">
                            {(form.customerName || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-xs">{form.customerName}</div>
                            <div className="text-[10px] text-gray-500">
                              {form.customerCompany ? `${form.customerCompany} &bull; ` : ''}
                              {form.customerPhone || form.customerEmail || 'No contact specified'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={clearSelectedCustomer}
                          className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                          title="Clear or search another user"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Smart Search Input across all user/customer attributes */}
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search system by name, company, phone, email, or role..."
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-[#ffa200]"
                      />
                      
                      {/* Autocomplete Dropdown */}
                      {showClientDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-56 overflow-y-auto z-50 divide-y divide-gray-100 animate-in fade-in duration-150">
                          <div className="p-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                            <span>{filteredSystemContacts.length} Contacts in System</span>
                            <span>Click to Autofill</span>
                          </div>

                          {filteredSystemContacts.length === 0 ? (
                            <div className="p-4 text-center space-y-2">
                              <p className="text-xs text-gray-500">No contact matching "{clientSearchQuery}"</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickCust(prev => ({ ...prev, name: clientSearchQuery }));
                                  setShowQuickAddCust(true);
                                  setShowClientDropdown(false);
                                }}
                                className="px-3 py-1.5 bg-[#ffa200] text-black font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Quick Add "{clientSearchQuery}"
                              </button>
                            </div>
                          ) : (
                            filteredSystemContacts.slice(0, 10).map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => selectCustomer(c)}
                                className="w-full text-left p-2.5 hover:bg-amber-50/80 transition flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                    {(c.name || 'C').substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                                      <span>{c.name}</span>
                                      {c.category && (
                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                          {c.category}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-gray-400 truncate max-w-[240px]">
                                      {c.company ? `${c.company} &bull; ` : ''}{c.phone || c.email || c.address || 'In System'}
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Manual / Autofilled Contact Fields */}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Customer Full Name *"
                        value={form.customerName}
                        onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                        required
                        className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={form.customerPhone}
                        onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={form.customerEmail}
                        onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Company Name (optional)"
                        value={form.customerCompany}
                        onChange={(e) => setForm({ ...form, customerCompany: e.target.value })}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Delivery / Postal Address"
                        value={form.customerAddress}
                        onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                        className="col-span-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Payment Reference & Linked Reference Details */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/70 space-y-3">
                    <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      Transaction & Settlement Details
                    </span>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Transaction Ref / Cheque No / MoMo ID</label>
                      <input
                        type="text"
                        placeholder="e.g. TXN-94829104, MoMo Ref #84920, or Check #00482"
                        value={form.paymentReference}
                        onChange={(e) => setForm({ ...form, paymentReference: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Linked Invoice #</label>
                        <input
                          type="text"
                          placeholder="e.g. MGL849201"
                          value={form.invoiceNumber}
                          onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Quick Select Invoice</label>
                        <select
                          value={form.invoiceId}
                          onChange={(e) => {
                            const id = e.target.value;
                            if (id) {
                              const inv = invoices.find(x => x.id === id);
                              if (inv) importFromInvoiceData(inv);
                            }
                          }}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs cursor-pointer font-medium"
                        >
                          <option value="">Choose Invoice...</option>
                          {invoices.filter(i => !i.isDeleted).map(inv => (
                            <option key={inv.id} value={inv.id}>
                              #{inv.invoiceNumber} ({inv.customerName || 'Client'}) - GHS {Number(inv.total || 0).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Itemized Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Itemized Products / Services</span>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="bg-black hover:bg-gray-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {form.items.map((item, idx) => {
                      const itemTotal = ((parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 0));
                      return (
                        <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-2xl relative space-y-2">
                          <div className="grid grid-cols-12 gap-2 items-center">
                            {/* Product Name Autocomplete */}
                            <div className="col-span-12 md:col-span-6 relative">
                              <input
                                type="text"
                                placeholder="Product or Service Name *"
                                value={item.name}
                                onChange={(e) => {
                                  updateLineItem(idx, 'name', e.target.value);
                                  setActiveProductDropdownIdx(idx);
                                }}
                                onFocus={() => setActiveProductDropdownIdx(idx)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-[#ffa200]"
                                required
                              />

                              {/* Products Dropdown */}
                              {activeProductDropdownIdx === idx && products.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-40 divide-y divide-gray-100">
                                  {products
                                    .filter(p => (p.name || '').toLowerCase().includes((item.name || '').toLowerCase()))
                                    .slice(0, 6)
                                    .map(prod => (
                                      <button
                                        key={prod.id}
                                        type="button"
                                        onClick={() => {
                                          updateLineItemMultiple(idx, {
                                            name: prod.name,
                                            unitPrice: prod.price || prod.sellingPrice || '',
                                            description: prod.category ? `Category: ${prod.category}` : ''
                                          });
                                          setActiveProductDropdownIdx(null);
                                        }}
                                        className="w-full text-left p-2 hover:bg-amber-50/80 transition flex items-center justify-between cursor-pointer"
                                      >
                                        <span className="font-bold text-gray-900">{prod.name}</span>
                                        <span className="text-[#D07B00] font-extrabold">GHS {Number(prod.price || prod.sellingPrice || 0).toFixed(2)}</span>
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>

                            {/* Unit Price */}
                            <div className="col-span-5 md:col-span-2">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Unit Price (GHS) *"
                                value={item.unitPrice}
                                onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-right"
                                required
                              />
                            </div>

                            {/* Quantity */}
                            <div className="col-span-3 md:col-span-1">
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-center"
                                required
                              />
                            </div>

                            {/* Row Total */}
                            <div className="col-span-3 md:col-span-2 text-right font-black text-gray-900">
                              GHS {itemTotal.toFixed(2)}
                            </div>

                            {/* Delete line item */}
                            <div className="col-span-1 md:col-span-1 flex justify-end">
                              {form.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLineItem(idx)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Optional Line Description */}
                          <input
                            type="text"
                            placeholder="Add brief details / batch notes (optional)..."
                            value={item.description}
                            onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                            className="w-full bg-white/60 border border-gray-200/80 rounded-lg px-2.5 py-1 text-[11px] text-gray-600"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Taxes, Discounts, Notes, Withholding Tax & Live Totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Notes & Tax Management */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                          Receipt Description / Terms
                        </label>
                        {calcTaxes(calcSubtotal(form.items), form.discount, form.taxes).some(t => t.isDeduction && t.amount > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              const invVal = calculateInvoiceValue();
                              const computed = calcTaxes(calcSubtotal(form.items), form.discount, form.taxes);
                              const whtAmt = computed.filter(t => t.isDeduction).reduce((sum, t) => sum + t.amount, 0);
                              setForm(prev => ({
                                ...prev,
                                notes: buildWhtDescription(prev.invoiceNumber, invVal, whtAmt)
                              }));
                              toast.success('Inserted standard GRA WHT clause');
                            }}
                            className="text-[10px] font-bold text-[#D07B00] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" /> Auto-Fill WHT Clause
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="e.g. Being Payment for invoice (GHS ...), with Ghc ... withheld as WHT pending receipt of GRA withholding certificate"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs leading-relaxed focus:bg-white focus:ring-2 focus:ring-[#ffa200]"
                      />
                    </div>

                    {/* Tax Settings */}
                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Applicable Taxes</span>
                          <span className="text-[9px] text-gray-400 font-semibold">(Standard & Withholding)</span>
                        </div>
                        <button
                          type="button"
                          onClick={addTaxRow}
                          className="text-[11px] font-bold text-[#D07B00] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Add Tax Rate
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(form.taxes || []).map((t, idx) => {
                          const matchedPreset = PRESET_TAXES.find(p => p.name && p.name === t.name);
                          const isCustom = !matchedPreset || t.isCustom;
                          const selectVal = matchedPreset && !t.isCustom ? matchedPreset.name : '__custom__';

                          return (
                            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-2 shadow-2xs">
                              <div className="flex items-center gap-2">
                                {/* Tax Preset Dropdown */}
                                <select
                                  value={selectVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '__custom__') {
                                      updateTaxRow(idx, { name: '', rate: '0', isCustom: true, isDeduction: false });
                                    } else {
                                      const preset = PRESET_TAXES.find(p => p.name === val);
                                      if (preset) {
                                        updateTaxRow(idx, {
                                          name: preset.name,
                                          rate: preset.defaultRate,
                                          isDeduction: preset.isDeduction,
                                          isCustom: false
                                        });
                                      }
                                    }
                                  }}
                                  className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:border-[#ffa200] truncate"
                                >
                                  {/* Custom option at the top as requested */}
                                  <option value="__custom__">-- Custom Tax (Type name & rate) --</option>
                                  <optgroup label="Standard Indirect Taxes (Added)">
                                    {PRESET_TAXES.filter(p => !p.isDeduction && p.name).map(p => (
                                      <option key={p.name} value={p.name}>{p.label}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Withholding Taxes (Deducted)">
                                    {PRESET_TAXES.filter(p => p.isDeduction).map(p => (
                                      <option key={p.name} value={p.name}>{p.label}</option>
                                    ))}
                                  </optgroup>
                                </select>

                                {/* Rate Input */}
                                <div className="relative w-20 shrink-0">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    placeholder="Rate"
                                    value={t.rate}
                                    onChange={(e) => updateTaxRow(idx, { rate: e.target.value })}
                                    className="w-full pl-2 pr-5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-right text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-[#ffa200]"
                                  />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">%</span>
                                </div>

                                {/* Delete button */}
                                <button
                                  type="button"
                                  onClick={() => removeTaxRow(idx)}
                                  className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-100 hover:border-red-100 transition cursor-pointer"
                                  title="Delete this tax rate"
                                  aria-label="Delete this tax rate"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Custom Tax Name and Deduction toggle if custom */}
                              {isCustom && (
                                <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
                                  <input
                                    type="text"
                                    placeholder="Enter tax name (e.g. Municipal Levy, State Duty...)"
                                    value={t.name}
                                    onChange={(e) => updateTaxRow(idx, { name: e.target.value, isCustom: true })}
                                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#ffa200]"
                                  />
                                  <label className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 cursor-pointer select-none bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(t.isDeduction)}
                                      onChange={(e) => updateTaxRow(idx, { isDeduction: e.target.checked })}
                                      className="rounded text-[#ffa200] focus:ring-[#ffa200] cursor-pointer"
                                    />
                                    <span>Withheld / Deducted</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {(!form.taxes || form.taxes.length === 0) && (
                          <div className="text-center py-4 px-3 border border-dashed border-gray-200 rounded-xl bg-white/70 text-xs text-gray-400">
                            No taxes applied. Click <button type="button" onClick={addTaxRow} className="font-bold text-[#D07B00] hover:underline cursor-pointer inline">+ Add Tax Rate</button> to add one.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Totals Breakdown */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2.5">
                    <div className="flex justify-between font-semibold text-gray-600 text-xs">
                      <span>Sub Total:</span>
                      <span className="text-gray-900 font-bold">GHS {calcSubtotal(form.items).toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between font-semibold text-gray-600 text-xs">
                      <span>Discount (GHS):</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.discount}
                        onChange={(e) => setForm({ ...form, discount: e.target.value })}
                        className="w-28 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-right font-bold text-[#D07B00] focus:outline-none focus:border-[#ffa200]"
                      />
                    </div>

                    {/* Tax Breakdown */}
                    {calcTaxes(calcSubtotal(form.items), form.discount, form.taxes)
                      .filter(t => (t.amount > 0 || (t.name && parseFloat(t.rate) > 0)) && t.name.trim() !== '')
                      .map((t, idx) => (
                      <div key={idx} className="flex justify-between font-semibold text-xs">
                        <span className={t.isDeduction ? 'text-amber-900 font-bold' : 'text-gray-600'}>
                          {t.isDeduction ? 'Less ' : ''}{t.name || 'Tax'} ({t.rate}%):
                        </span>
                        <span className={`font-bold ${t.isDeduction ? 'text-[#D07B00]' : 'text-gray-900'}`}>
                          {t.isDeduction ? '-GHS ' : 'GHS '}{t.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {/* If any withholding tax / deduction is applied, display Invoice Value */}
                    {calcTaxes(calcSubtotal(form.items), form.discount, form.taxes).some(t => t.isDeduction && t.amount > 0) && (
                      <div className="flex justify-between items-center py-1.5 border-t border-dashed border-gray-300 text-xs">
                        <span className="font-extrabold text-gray-800">Invoice Value:</span>
                        <span className="font-black text-gray-900 font-mono">
                          GHS {calculateInvoiceValue().toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="border-t border-gray-200 pt-1" />

                    {/* Total Paid Highlight */}
                    <div className="bg-[#ffa200] text-black font-black p-3.5 rounded-xl flex items-center justify-between text-sm shadow-xs">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-black/80">
                          {calcTaxes(calcSubtotal(form.items), form.discount, form.taxes).some(t => t.isDeduction && t.amount > 0)
                            ? 'Actual Amount Paid:'
                            : 'Total Paid:'}
                        </div>
                        <div className="text-[10px] text-black/60 font-semibold">
                          {calcTaxes(calcSubtotal(form.items), form.discount, form.taxes).some(t => t.isDeduction && t.amount > 0)
                            ? 'Net funds received after WHT'
                            : 'Confirmed settlement'}
                        </div>
                      </div>
                      <span className="text-lg font-black font-mono">
                        GHS {calculateTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 bg-[#ffa200] hover:bg-[#ff9100] text-black font-extrabold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingReceiptId ? 'Update Receipt' : 'Generate & Issue Receipt'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* =========================================================================
            QUICK ADD CUSTOMER MODAL
           ========================================================================= */}
        {mounted && showQuickAddCust && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-bold text-gray-900 text-base">Quick Add Customer</h3>
                <button onClick={() => setShowQuickAddCust(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleQuickAddCust} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Full Name / Business *</label>
                  <input
                    type="text"
                    required
                    value={quickCust.name}
                    onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={quickCust.phone}
                    onChange={(e) => setQuickCust({ ...quickCust, phone: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={quickCust.email}
                    onChange={(e) => setQuickCust({ ...quickCust, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Company</label>
                  <input
                    type="text"
                    value={quickCust.company}
                    onChange={(e) => setQuickCust({ ...quickCust, company: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Address</label>
                  <input
                    type="text"
                    value={quickCust.address}
                    onChange={(e) => setQuickCust({ ...quickCust, address: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCust(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingCust}
                    className="px-4 py-1.5 bg-[#ffa200] text-black font-extrabold rounded-xl cursor-pointer"
                  >
                    {addingCust ? 'Saving...' : 'Save & Select'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* =========================================================================
            VIEW / PRINT RECEIPT MODAL (Matching uploaded reference design)
           ========================================================================= */}
        {mounted && viewingReceipt && typeof document !== 'undefined' && createPortal(
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewingReceipt(null);
            }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-2 md:p-6 bg-black/70 backdrop-blur-xs overflow-hidden"
          >
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-[94vh] max-h-[94vh]">
              
              {/* Action Bar */}
              <div className="px-6 py-3.5 border-b border-gray-200 bg-gray-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#ffa200] text-black">
                    <ReceiptText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm tracking-wide">Receipt #{viewingReceipt.receiptNumber}</span>
                    <span className="text-xs text-gray-400 ml-2 font-mono">({viewingReceipt.customerName})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEmailModal(viewingReceipt)}
                    className="px-3.5 py-1.5 bg-[#1e1e1e] hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-white/10"
                  >
                    <Send className="w-3.5 h-3.5 text-[#ffa200]" /> Email / SMS
                  </button>

                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-1.5 bg-[#ffa200] hover:bg-[#ff9100] text-black text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                  </button>

                  <button
                    onClick={() => setViewingReceipt(null)}
                    className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Printable Document Container */}
              <div className="p-4 md:p-8 overflow-y-auto min-h-0 bg-gray-100 flex-1 flex justify-center">
                
                {/* Print Reference Node */}
                <div 
                  ref={printRef}
                  className="receipt-print-wrapper"
                  style={{
                    backgroundColor: '#ffffff',
                    maxWidth: '800px',
                    width: '100%',
                    padding: '36px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    fontFamily: "'Poppins', sans-serif",
                    color: '#111827',
                    boxSizing: 'border-box',
                    minHeight: '1050px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div className="receipt-body" style={{ flex: '1 0 auto' }}>
                    
                    {/* 1. Header: Logo Left, Title Right */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                      <tbody>
                        <tr>
                          <td style={{ verticalAlign: 'middle', width: '50%' }}>
                            <img
                              src={COMPANY.logoUrl}
                              alt={COMPANY.name}
                              style={{ width: '130px', height: 'auto', display: 'block' }}
                            />
                            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px', fontWeight: '600' }}>
                              {COMPANY.slogan}
                            </div>
                          </td>
                          <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '50%' }}>
                            <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#ffa200', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', lineHeight: '1' }}>
                              RECEIPT
                            </h1>
                            <div style={{ width: '48px', height: '3px', backgroundColor: '#ffa200', marginLeft: 'auto', marginTop: '6px', borderRadius: '2px' }} />
                            <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '6px', fontWeight: '700' }}>
                              Official Payment Receipt
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Divider Line */}
                    <div style={{ height: '1px', backgroundColor: '#e5e7eb', width: '100%', marginBottom: '20px' }} />

                    {/* 2. Metadata Strip (Receipt No, Date, Receipt To) */}
                    <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', marginBottom: '24px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '28%', verticalAlign: 'top', borderRight: '1px solid #f3f4f6', paddingRight: '12px' }}>
                              <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                Receipt no.
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>
                                #{viewingReceipt.receiptNumber}
                              </div>
                              {viewingReceipt.invoiceNumber && (
                                <div style={{ fontSize: '10px', color: '#b45309', fontWeight: '600', marginTop: '2px' }}>
                                  Ref Inv: #{viewingReceipt.invoiceNumber}
                                </div>
                              )}
                            </td>

                            <td style={{ width: '24%', verticalAlign: 'top', borderRight: '1px solid #f3f4f6', paddingLeft: '12px', paddingRight: '12px' }}>
                              <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                Date
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: '#111827' }}>
                                {new Date(viewingReceipt.receiptDate || viewingReceipt.createdAt).toLocaleDateString('en-GB')}
                              </div>
                              {viewingReceipt.paymentDate && (
                                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                                  Paid: {new Date(viewingReceipt.paymentDate).toLocaleDateString('en-GB')}
                                </div>
                              )}
                            </td>

                            <td style={{ width: '48%', verticalAlign: 'top', paddingLeft: '16px' }}>
                              <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                Receipt to:
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                                {viewingReceipt.customerName || 'Valued Customer'}
                              </div>
                              {viewingReceipt.customerCompany && (
                                <div style={{ fontSize: '11px', color: '#4b5563', fontWeight: '600' }}>
                                  {viewingReceipt.customerCompany}
                                </div>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 3. Featured Total Display & Company Address on Right */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px' }}>
                      <tbody>
                        <tr>
                          {/* Large Highlight Box */}
                          <td style={{ verticalAlign: 'middle', width: '55%' }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              TOTAL PAID
                            </div>
                            <div style={{ fontSize: '32px', fontWeight: '900', color: '#111827', marginTop: '2px', letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                              GHS {Number(viewingReceipt.total || 0).toFixed(2)}
                            </div>
                          </td>

                          {/* Company Details with mini icons */}
                          <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '45%', fontSize: '11px', color: '#4b5563', lineHeight: '1.6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <span>{settings?.companyAddress || COMPANY.address}</span>
                              <svg viewBox="0 0 24 24" width="11" height="11" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <span>{settings?.companyPhone || COMPANY.phone}</span>
                              <svg viewBox="0 0 24 24" width="11" height="11" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <span>{settings?.companyEmail || COMPANY.email}</span>
                              <svg viewBox="0 0 24 24" width="11" height="11" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 4. Itemized Table with Orange Accent Header & Zebra Rows */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#ffa200', color: '#000000', fontWeight: '800', fontSize: '11px', textTransform: 'capitalize' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderRadius: '4px 0 0 4px', width: '48%' }}>Item Description</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', width: '18%' }}>Unit Price</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', width: '14%' }}>Qty</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', borderRadius: '0 4px 4px 0', width: '20%' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewingReceipt.items || []).map((item, idx) => {
                          const isZebra = idx % 2 === 1;
                          const uPrice = Number(item.unitPrice || item.price || 0);
                          const q = Number(item.quantity || 1);
                          const iTotal = Number(item.total || (q * uPrice));
                          return (
                            <tr key={idx} style={{ backgroundColor: isZebra ? '#f9fafb' : '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827' }}>
                                <div>{item.name || 'Product'}</div>
                                {item.description && (
                                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'normal', marginTop: '2px' }}>
                                    {item.description}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#4b5563', fontWeight: '500' }}>
                                GHS {uPrice.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center', color: '#4b5563', fontWeight: '500' }}>
                                {q < 10 ? `0${q}` : q}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#111827' }}>
                                GHS {iTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* 5. Totals & Payment Method We Accept */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px' }}>
                      <tbody>
                        <tr>
                          {/* Left Column: Settlement & Payment Details */}
                          <td style={{ width: '52%', verticalAlign: 'top', paddingRight: '20px' }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>
                              Payment Settlement
                            </div>
                            <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.6' }}>
                              <div><strong>Method:</strong> {viewingReceipt.paymentMethod || 'Mobile Money'}</div>
                              {viewingReceipt.paymentReference && (
                                <div><strong>Reference ID:</strong> <span style={{ fontFamily: 'monospace' }}>{viewingReceipt.paymentReference}</span></div>
                              )}
                              <div><strong>Status:</strong> <span style={{ color: '#059669', fontWeight: '700' }}>Payment Received in Full</span></div>
                            </div>

                            {/* Note Box */}
                            <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', fontSize: '10px', color: '#78350f', lineHeight: '1.5' }}>
                              <strong>Note:</strong> {viewingReceipt.notes || 'Official tax receipt confirming payment. Thank you for your patronage!'}
                            </div>
                          </td>

                          {/* Right Column: Totals & Grand Total Banner */}
                          <td style={{ width: '48%', verticalAlign: 'top' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', lineHeight: '1.9' }}>
                              <tbody>
                                <tr>
                                  <td style={{ color: '#4b5563', fontWeight: '600', width: '50%' }}>Sub Total:</td>
                                  <td style={{ textAlign: 'right', fontWeight: '700', color: '#111827' }}>
                                    GHS {Number(viewingReceipt.subtotal || 0).toFixed(2)}
                                  </td>
                                </tr>

                                {/* Tax Rows */}
                                {Array.isArray(viewingReceipt.taxes) && viewingReceipt.taxes.length > 0 ? (
                                  viewingReceipt.taxes.map((t, idx) => (
                                    <tr key={idx}>
                                      <td style={{ color: '#4b5563', fontWeight: '600' }}>Tax ({t.name || 'VAT'}{t.rate ? ` ${t.rate}%` : ''}):</td>
                                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#111827' }}>
                                        GHS {Number(t.amount || 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  viewingReceipt.vat > 0 && (
                                    <tr>
                                      <td style={{ color: '#4b5563', fontWeight: '600' }}>Tax (VAT):</td>
                                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#111827' }}>
                                        GHS {Number(viewingReceipt.vat || 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  )
                                )}

                                {viewingReceipt.discount > 0 && (
                                  <tr>
                                    <td style={{ color: '#dc2626', fontWeight: '600' }}>Discount:</td>
                                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                                      -GHS {Number(viewingReceipt.discount || 0).toFixed(2)}
                                    </td>
                                  </tr>
                                )}

                                {/* Invoice Value Row */}
                                {(viewingReceipt.applyWht || Number(viewingReceipt.whtAmount || 0) > 0) && (
                                  <tr style={{ borderTop: '1px dashed #d1d5db' }}>
                                    <td style={{ color: '#111827', fontWeight: '800', paddingTop: '4px' }}>Invoice Value:</td>
                                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#111827', paddingTop: '4px' }}>
                                      GHS {Number(viewingReceipt.invoiceValue || (Number(viewingReceipt.total || 0) + Number(viewingReceipt.whtAmount || 0))).toFixed(2)}
                                    </td>
                                  </tr>
                                )}

                                {/* Less Withholding Tax Row */}
                                {(viewingReceipt.applyWht || Number(viewingReceipt.whtAmount || 0) > 0) && (
                                  <tr style={{ color: '#b45309' }}>
                                    <td style={{ fontWeight: '700' }}>Less Withholding Tax ({viewingReceipt.whtRate || 3}%):</td>
                                    <td style={{ textAlign: 'right', fontWeight: '800' }}>
                                      -GHS {Number(viewingReceipt.whtAmount || 0).toFixed(2)}
                                    </td>
                                  </tr>
                                )}

                                <tr>
                                  <td colSpan="2" style={{ paddingTop: '8px' }}>
                                    <div style={{ backgroundColor: '#ffa200', color: '#000000', padding: '10px 16px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '900', fontSize: '13px' }}>
                                      <span>{(viewingReceipt.applyWht || Number(viewingReceipt.whtAmount || 0) > 0) ? 'Actual Amount Paid' : 'Grand Total'}</span>
                                      <span style={{ fontSize: '15px' }}>GHS {Number(viewingReceipt.actualAmountPaid || viewingReceipt.total || 0).toFixed(2)}</span>
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            {/* Signature Block */}
                            <div style={{ marginTop: '24px', textAlign: 'center', marginLeft: 'auto', width: '220px' }}>
                              <div style={{ fontFamily: "'Dancing Script', cursive, sans-serif", fontSize: '24px', color: '#111827', lineHeight: '1.1', marginBottom: '4px' }}>
                                The Honey Palace Africa
                              </div>
                              <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '4px', fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'capitalize' }}>
                                Accounts Manager
                              </div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 6. Footer Section: Contact Details Left, Logo Right */}
                  <div 
                    className="receipt-footer"
                    style={{ 
                      borderTop: '1px solid #e5e7eb', 
                      paddingTop: '16px', 
                      marginTop: 'auto',
                      flexShrink: 0,
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid'
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ verticalAlign: 'middle', width: '65%', fontSize: '10px', color: '#6b7280' }}>
                            <div style={{ fontWeight: '800', color: '#111827', textTransform: 'capitalize', marginBottom: '3px' }}>
                              Contact details
                            </div>
                            <div style={{ lineHeight: '1.6' }}>
                              <span>{settings?.companyAddress || COMPANY.address}</span> &bull; <span>{settings?.companyPhone || COMPANY.phone}</span> &bull; <span>{settings?.companyEmail || COMPANY.email}</span>
                            </div>
                          </td>
                          <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '35%' }}>
                            <img
                              src={COMPANY.logoUrl}
                              alt={COMPANY.name}
                              style={{ width: '100px', height: 'auto', display: 'inline-block' }}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          </div>,
          document.body
        )}

        {/* =========================================================================
            EMAIL & SMS SEND MODAL
           ========================================================================= */}
        {mounted && showEmailModal && emailPreviewReceipt && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-[#D07B00]">
                    <Send className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">Send Digital Receipt</h3>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Customer Email</label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Customer Phone (SMS)</label>
                  <input
                    type="text"
                    disabled
                    value={emailPreviewReceipt.customerPhone || 'No phone number provided'}
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500"
                  />
                </div>

                {emailPreviewReceipt.customerPhone && (
                  <label className="flex items-center gap-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendSmsAlso}
                      onChange={(e) => setSendSmsAlso(e.target.checked)}
                      className="rounded-sm text-[#ffa200] focus:ring-[#ffa200]"
                    />
                    <span className="font-semibold text-amber-900 text-xs">
                      Also dispatch instant SMS notification with receipt link
                    </span>
                  </label>
                )}

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-600 text-[11px] space-y-1">
                  <div><strong>Receipt #:</strong> {emailPreviewReceipt.receiptNumber}</div>
                  <div><strong>Customer:</strong> {emailPreviewReceipt.customerName}</div>
                  <div><strong>Total Paid:</strong> GHS {Number(emailPreviewReceipt.total || 0).toFixed(2)}</div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-3 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendReceiptEmailAndSMS}
                    disabled={sending}
                    className="px-5 py-2 bg-[#ffa200] hover:bg-[#e59100] text-black font-extrabold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Send Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Floating Actions Menu Portal (always on top, immune to table overflow) */}
        {mounted && activeMenuReceipt && typeof document !== 'undefined' && createPortal(
          <div
            id="receipt-floating-menu"
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              zIndex: 999999,
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-44 bg-white rounded-2xl shadow-2xl border border-gray-200 py-1.5 animate-in fade-in zoom-in-95 duration-100 text-left"
          >
            <button
              type="button"
              onClick={() => {
                const target = activeMenuReceipt;
                setActiveMenuReceipt(null);
                setViewingReceipt(target);
                setTimeout(() => handlePrint(), 300);
              }}
              className="w-full px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5 text-gray-500" /> Print / Save PDF
            </button>

            <button
              type="button"
              onClick={() => {
                const target = activeMenuReceipt;
                setActiveMenuReceipt(null);
                startEditReceipt(target);
              }}
              className="w-full px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition"
            >
              <Edit className="w-3.5 h-3.5 text-blue-500" /> Edit Receipt
            </button>

            <button
              type="button"
              onClick={() => {
                const target = activeMenuReceipt;
                setActiveMenuReceipt(null);
                handleOpenEmailModal(target);
              }}
              className="w-full px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition"
            >
              <Mail className="w-3.5 h-3.5 text-[#D07B00]" /> Send to Customer
            </button>

            <div className="border-t border-gray-100 my-1" />

            <button
              type="button"
              onClick={() => {
                const target = activeMenuReceipt;
                setActiveMenuReceipt(null);
                handleSoftDelete(target);
              }}
              className="w-full px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" /> Delete Receipt
            </button>
          </div>,
          document.body
        )}

      </div>
    </AuthShield>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#ffa200]" />
      </div>
    }>
      <ReceiptsContent />
    </Suspense>
  );
}
