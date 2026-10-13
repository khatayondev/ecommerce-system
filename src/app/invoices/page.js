'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { buildInvoiceHTML } from '@/utils/invoiceEmailTemplate';
import { PRESET_TAXES } from '@/utils/taxPresets';
import { logAction } from '@/utils/logging';
import {
  FileText, Plus, X, Search, Send, Download, Eye,
  Printer, Calendar, DollarSign, User, Hash, Mail,
  CheckCircle2, Clock, AlertCircle, Trash2, ArrowLeft, RefreshCw,
  ChevronRight, ChevronDown, Check, Building, Smartphone, MapPin, MoreVertical, Edit, Copy, Loader2, MessageSquare,
  Package, Truck, ReceiptText, Save
} from 'lucide-react';

export default function InvoicesPage() {
  const { user } = useAuth();
  const { showConfirm } = useUI();
  const { settings } = useStoreSettings();
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [activeProductDropdownIdx, setActiveProductDropdownIdx] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const printRef = useRef(null);

  // Email Preview Modal States
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);
  const [emailPreviewInvoice, setEmailPreviewInvoice] = useState(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendSmsAlso, setSendSmsAlso] = useState(false);

  // Packing List States
  const [packingListInvoice, setPackingListInvoice] = useState(null);
  const [packingListData, setPackingListData] = useState(null);
  const packingListPrintRef = useRef(null);

  // Waybill States
  const [waybillInvoice, setWaybillInvoice] = useState(null);
  const [waybillData, setWaybillData] = useState(null);
  const waybillPrintRef = useRef(null);

  // Quick Customer Add States
  const [showQuickAddCust, setShowQuickAddCust] = useState(false);
  const [quickCust, setQuickCust] = useState({ name: '', email: '', phone: '', company: '', address: '' });
  const [addingCust, setAddingCust] = useState(false);

  // Smart Client Search States
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Invoice Form State
  const [form, setForm] = useState({
    invoiceType: 'commercial', // 'commercial' | 'proforma'
    invoiceNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    customerCompany: '',
    customerPhoto: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    leadTime: '3–5 business days',
    poNumber: '',
    notes: '',
    discount: '0',
    taxes: [{ name: 'VAT', rate: '15' }],
    items: [{ name: '', quantity: 1, unitPrice: '' }],
  });

  // Close 3-dot menu and client dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.invoice-menu-container')) {
        setOpenMenuId(null);
      }
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!db) { setLoading(false); return; }

    const unsubInv = onSnapshot(collection(db, 'invoices'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setInvoices(list);
      setLoading(false);
    }, () => setLoading(false));

    const unsubProd = onSnapshot(collection(db, 'products'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setProducts(list);
    }, (err) => console.warn('[Invoices] Products permission warning:', err.message));

    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setCustomers(list);
    }, (err) => console.warn('[Invoices] Customers permission warning:', err.message));

    return () => { unsubInv(); unsubProd(); unsubCust(); };
  }, []);

  const generateInvoiceNumber = () => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `MGL${rand}`;
  };

  const generateProformaNumber = () => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `PF-MGL${rand}`;
  };

  const handleSwitchInvoiceType = (type) => {
    if (form.invoiceType === type) return;
    
    let newNum = form.invoiceNumber;
    let newNotes = form.notes;
    
    if (type === 'proforma') {
      if (!newNum.startsWith('PF-')) {
        newNum = `PF-${newNum}`;
      }
      if (!newNotes || newNotes === 'Payment due within 7 days of invoice issue date.') {
        newNotes = 'Prices quoted are valid for 14 days and subject to batch stock availability. Official Tax Invoice will be issued upon Purchase Order (PO) or formal confirmation.';
      }
    } else {
      if (newNum.startsWith('PF-')) {
        newNum = newNum.replace(/^PF-/, '');
      }
      if (newNotes.includes('Prices quoted are valid for 14 days')) {
        newNotes = 'Payment due within 7 days of invoice issue date.';
      }
    }

    setForm(prev => ({
      ...prev,
      invoiceType: type,
      invoiceNumber: newNum,
      notes: newNotes,
      validUntil: prev.validUntil || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      leadTime: prev.leadTime || '3–5 business days'
    }));
  };

  const startNewInvoice = (initialType = 'commercial') => {
    setEditingInvoiceId(null);
    const isPf = initialType === 'proforma';
    setForm({
      invoiceType: initialType,
      invoiceNumber: isPf ? generateProformaNumber() : generateInvoiceNumber(),
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      customerCompany: '',
      customerPhoto: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: isPf ? '' : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      leadTime: '3–5 business days',
      poNumber: '',
      notes: isPf 
        ? 'Prices quoted are valid for 14 days and subject to batch stock availability. Official Tax Invoice will be issued upon Purchase Order (PO) or formal confirmation.'
        : 'Payment due within 7 days of invoice issue date.',
      discount: '0',
      taxes: [{ name: 'VAT', rate: '15' }],
      items: [{ name: '', quantity: 1, unitPrice: '' }],
    });
    setIsCreating(true);
    setViewingInvoice(null);
    setOpenMenuId(null);
    setClientSearchQuery('');
    setShowClientDropdown(false);
  };

  const startEditInvoice = (invoice) => {
    setOpenMenuId(null);
    setClientSearchQuery('');
    setShowClientDropdown(false);
    if (invoice.emailSent) {
      toast.info('Editing an invoice that has already been emailed.');
    }
    setEditingInvoiceId(invoice.id);

    let initialTaxes = [{ name: 'VAT', rate: '15' }];
    if (Array.isArray(invoice.taxes) && invoice.taxes.length > 0) {
      initialTaxes = invoice.taxes.map(t => ({
        name: t.name || '',
        rate: t.rate !== undefined ? t.rate.toString() : ''
      }));
    } else if (invoice.vat && invoice.subtotal) {
      const approxRate = ((invoice.vat / Math.max(1, invoice.subtotal - (invoice.discount || 0))) * 100).toFixed(1);
      initialTaxes = [{ name: 'VAT', rate: approxRate }];
    }

    setForm({
      invoiceType: invoice.invoiceType || 'commercial',
      invoiceNumber: invoice.invoiceNumber || generateInvoiceNumber(),
      customerName: invoice.customerName || '',
      customerEmail: invoice.customerEmail || '',
      customerPhone: invoice.customerPhone || '',
      customerAddress: invoice.customerAddress || '',
      customerCompany: invoice.customerCompany || '',
      customerPhoto: invoice.customerPhoto || '',
      issueDate: invoice.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate || '',
      validUntil: invoice.validUntil || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      leadTime: invoice.leadTime || '3–5 business days',
      poNumber: invoice.poNumber || '',
      notes: invoice.notes || '',
      discount: (invoice.discount || 0).toString(),
      taxes: initialTaxes,
      items: (invoice.items || []).map(i => ({
        name: i.name || '',
        quantity: i.quantity || 1,
        unitPrice: (i.unitPrice || 0).toString()
      }))
    });
    setIsCreating(true);
    setViewingInvoice(null);
  };

  const handleSoftDelete = async (invoice) => {
    setOpenMenuId(null);
    const confirmed = await showConfirm({
      title: 'Soft Delete Invoice',
      message: `Are you sure you want to delete invoice ${invoice.invoiceNumber}? It will be hidden from active lists and sales stats.`,
      confirmText: 'Delete Invoice',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
      await logAction({
        module: 'INVOICES',
        action: 'DELETE_INVOICE',
        details: `Deleted invoice #${invoice.invoiceNumber} (${invoice.customerName || 'Customer'})`,
        targetId: invoice.invoiceNumber,
        severity: 'danger',
        userEmail: user?.email,
        userName: user?.full_name || 'Staff'
      });
      toast.success(`Invoice ${invoice.invoiceNumber} deleted.`);
      if (viewingInvoice?.id === invoice.id) setViewingInvoice(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete invoice.');
    }
  };

  const copyPaymentLink = (paymentUrl) => {
    setOpenMenuId(null);
    if (!paymentUrl) {
      toast.error('No Paystack link generated for this invoice yet.');
      return;
    }
    navigator.clipboard.writeText(paymentUrl);
    toast.success('Paystack payment link copied to clipboard!');
  };

  const addLineItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, { name: '', quantity: 1, unitPrice: '' }] }));
  };

  const removeLineItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
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
      taxes: [...(prev.taxes || []), { name: '', rate: '' }]
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
      return { name: t.name || 'Tax', rate, amount };
    });
  };

  const calcTotalTaxAmount = (taxCalculatedList) => {
    return (taxCalculatedList || []).reduce((sum, t) => sum + (t.amount || 0), 0);
  };

  const calculateTotal = (items = form.items, discount = form.discount, taxes = form.taxes) => {
    const sub = calcSubtotal(items);
    const net = Math.max(0, sub - (parseFloat(discount) || 0));
    const taxAmt = calcTotalTaxAmount(calcTaxes(sub, discount, taxes));
    return net + taxAmt;
  };

  const handleCreate = async (e) => {
    if (e) e.preventDefault();
    if (!form.customerName.trim()) {
      toast.error('Please select or fill in client details.');
      return;
    }
    if (form.items.some(i => !i.name.trim() || !i.unitPrice)) {
      toast.error('Please enter a name and price for all line items.');
      return;
    }

    const subtotal = calcSubtotal(form.items);
    const discountVal = parseFloat(form.discount) || 0;
    const discountedSubtotal = Math.max(0, subtotal - discountVal);
    
    const computedTaxes = calcTaxes(subtotal, form.discount, form.taxes);
    const totalTaxVal = calcTotalTaxAmount(computedTaxes);
    const total = discountedSubtotal + totalTaxVal;

    const payload = {
      invoiceType: form.invoiceType || 'commercial',
      invoiceNumber: form.invoiceNumber,
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim(),
      customerPhone: form.customerPhone.trim(),
      customerAddress: form.customerAddress.trim(),
      customerCompany: form.customerCompany.trim(),
      customerPhoto: form.customerPhoto || null,
      issueDate: form.issueDate,
      dueDate: form.dueDate || null,
      validUntil: form.validUntil || null,
      leadTime: form.leadTime || null,
      poNumber: form.poNumber || null,
      notes: form.notes.trim(),
      discount: discountVal,
      taxes: computedTaxes,
      vat: totalTaxVal,
      items: form.items.map(i => ({
        name: i.name,
        quantity: parseInt(i.quantity) || 1,
        unitPrice: parseFloat(i.unitPrice) || 0,
        total: (parseInt(i.quantity) || 1) * (parseFloat(i.unitPrice) || 0)
      })),
      subtotal,
      total,
      status: editingInvoiceId 
        ? (invoices.find(x => x.id === editingInvoiceId)?.status || (form.invoiceType === 'proforma' ? 'proforma' : 'unpaid')) 
        : (form.invoiceType === 'proforma' ? 'proforma' : 'unpaid'),
      updatedAt: new Date().toISOString(),
      ...(editingInvoiceId ? {} : { createdAt: new Date().toISOString(), createdBy: user?.full_name || 'System' }),
    };

    setIsSaving(true);
    try {
      let targetId = editingInvoiceId;

      if (editingInvoiceId) {
        await updateDoc(doc(db, 'invoices', editingInvoiceId), payload);
      } else {
        const docRef = await addDoc(collection(db, 'invoices'), payload);
        targetId = docRef.id;
      }

      let paymentUrl = editingInvoiceId ? (invoices.find(x => x.id === editingInvoiceId)?.paymentUrl || '') : '';
      
      // For Commercial invoices, pre-generate Paystack link
      if (payload.invoiceType !== 'proforma' && payload.customerEmail && total > 0 && !paymentUrl) {
        try {
          const res = await fetch('/api/send-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              id: targetId,
              channel: 'none',
              skipNotification: true
            })
          });
          const resData = await res.json();
          if (resData.success && resData.paymentUrl) {
            paymentUrl = resData.paymentUrl;
            await updateDoc(doc(db, 'invoices', targetId), { paymentUrl });
          }
        } catch (e) {
          console.error("Failed to pre-generate Paystack link on creation:", e);
        }
      }

      const createdInvoice = {
        ...payload,
        id: targetId,
        paymentUrl
      };

      const docLabel = form.invoiceType === 'proforma' ? 'Pro Forma Quotation' : 'Invoice';
      toast.success(editingInvoiceId ? `${docLabel} ${form.invoiceNumber} updated successfully!` : `${docLabel} ${form.invoiceNumber} saved successfully!`);
      
      await logAction({
        module: 'INVOICES',
        action: editingInvoiceId ? 'UPDATE_INVOICE' : 'CREATE_INVOICE',
        details: `${editingInvoiceId ? 'Updated' : 'Created'} ${docLabel} #${form.invoiceNumber} for ${payload.customerName || 'Customer'} (Total: ₵${total.toFixed(2)})`,
        targetId: form.invoiceNumber,
        severity: 'success',
        userEmail: user?.email,
        userName: user?.full_name || 'Staff',
        metadata: {
          invoiceType: form.invoiceType,
          total,
          subtotal,
          itemsCount: payload.items?.length,
          customerEmail: payload.customerEmail
        }
      });

      setIsCreating(false);
      setEditingInvoiceId(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  const markAsPaid = async (invoice) => {
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), { status: 'paid', paidAt: new Date().toISOString() });
      await logAction({
        module: 'INVOICES',
        action: 'MARK_INVOICE_PAID',
        details: `Marked invoice #${invoice.invoiceNumber} as paid (₵${(invoice.total || 0).toFixed(2)}) for ${invoice.customerName || 'Customer'}`,
        targetId: invoice.invoiceNumber,
        severity: 'success',
        userEmail: user?.email,
        userName: user?.full_name || 'Staff',
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
          customerName: invoice.customerName
        }
      });
      toast.success('Invoice marked as paid.');
      if (viewingInvoice?.id === invoice.id) setViewingInvoice({ ...viewingInvoice, status: 'paid' });

      // Automatically dispatch receipt email to customer if email exists
      if (invoice.customerEmail) {
        toast.loading('Sending receipt email to customer...', { id: 'sending-receipt' });
        try {
          await fetch('/api/send-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerEmail: invoice.customerEmail,
              customerPhone: invoice.customerPhone,
              channel: 'email',
              receipt: {
                id: invoice.invoiceNumber || invoice.id,
                total: Number(invoice.total || invoice.amountPaid || 0),
                subtotal: Number(invoice.subtotal || invoice.total || 0),
                discount: Number(invoice.discountAmount || invoice.discount || 0),
                tax: Number(invoice.tax || 0),
                cartItems: invoice.items || invoice.cartItems || [],
                sale_date: new Date().toISOString()
              }
            })
          });
          toast.success(`Receipt sent to ${invoice.customerEmail}`, { id: 'sending-receipt' });
        } catch (e) {
          console.error('Failed to send receipt:', e);
          toast.error('Invoice updated, but failed to send receipt email.', { id: 'sending-receipt' });
        }
      }
    } catch {
      toast.error('Failed to update invoice.');
    }
  };

  const checkPaymentStatus = async (invoice) => {
    const refMatch = invoice.paymentReference || (invoice.paymentUrl && invoice.paymentUrl.split('/').pop());
    if (!refMatch) {
      toast.error('No Paystack payment link reference found on this invoice.');
      return;
    }

    try {
      toast.loading('Verifying Paystack payment status...', { id: 'check-pay' });
      const res = await fetch('/api/verify-invoice-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, reference: refMatch })
      });
      const data = await res.json();
      toast.dismiss('check-pay');

      if (data.success && data.paid) {
        toast.success(`Payment verified! Invoice ${invoice.invoiceNumber} is marked as PAID.`);
        if (viewingInvoice?.id === invoice.id) setViewingInvoice(prev => ({ ...prev, status: 'paid' }));
      } else {
        toast.info(`Paystack Payment Status: ${data.paystackStatus || 'Unpaid'}`);
      }
    } catch (err) {
      toast.dismiss('check-pay');
      toast.error('Failed to verify payment with Paystack.');
    }
  };

  const handleOpenEmailPreview = (invoice) => {
    if (!invoice.customerEmail) {
      toast.error('No email address on this invoice.');
      return;
    }
    setEmailPreviewInvoice(invoice);
    setEmailRecipient(invoice.customerEmail || '');
    setSendSmsAlso(false);
    setShowEmailPreviewModal(true);
  };

  const handleSendInvoiceSms = async (invoice) => {
    if (!invoice?.customerPhone) {
      toast.error('No phone number on this invoice.');
      return;
    }
    const toastId = toast.loading(`Sending payment SMS to ${invoice.customerPhone}...`);
    try {
      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...invoice,
          channel: 'sms'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send SMS');
      }
      toast.success(`Payment link SMS sent to ${invoice.customerPhone}!`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Failed to send SMS.', { id: toastId });
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!emailPreviewInvoice) return;
    if (!emailRecipient.trim()) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }

    setSending(true);
    try {
      const invoiceToSend = {
        ...emailPreviewInvoice,
        customerEmail: emailRecipient.trim(),
        channel: sendSmsAlso ? 'both' : 'email'
      };

      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceToSend)
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invoice');
      }

      if (data.success) {
        const updateFields = {
          emailSent: true,
          sentAt: new Date().toISOString(),
          ...(sendSmsAlso ? { smsSent: true } : {}),
          ...(data.paymentUrl ? { paymentUrl: data.paymentUrl } : {})
        };
        await updateDoc(doc(db, 'invoices', emailPreviewInvoice.id), updateFields);
        if (viewingInvoice?.id === emailPreviewInvoice.id) {
          setViewingInvoice(prev => ({ ...prev, ...updateFields }));
        }
        await logAction({
          module: 'INVOICES',
          action: 'DISPATCH_INVOICE',
          details: `Dispatched invoice #${emailPreviewInvoice.invoiceNumber} via email to ${emailRecipient.trim()}${sendSmsAlso ? ' and SMS' : ''}`,
          targetId: emailPreviewInvoice.invoiceNumber,
          severity: 'info',
          userEmail: user?.email,
          userName: user?.full_name || 'Staff',
          metadata: {
            recipient: emailRecipient.trim(),
            channel: sendSmsAlso ? 'email+sms' : 'email'
          }
        });
      }
      
      const successMsg = sendSmsAlso
        ? `Invoice email sent to ${emailRecipient.trim()} and SMS sent to ${emailPreviewInvoice.customerPhone}!`
        : `Invoice email sent to ${emailRecipient.trim()}!`;
      toast.success(successMsg);
      setShowEmailPreviewModal(false);
      setEmailPreviewInvoice(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Email service unavailable.');
    } finally {
      setSending(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Invoice</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;950&display=swap" rel="stylesheet">
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
          height: 100%;
          margin: 0;
          padding: 0;
          font-family: 'Poppins', sans-serif;
          background-color: #f3f4f6;
          color: #111;
        }
        .print-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .print-card {
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          padding: 40px;
          border-radius: 8px;
          max-width: 800px;
          width: 100%;
          margin: auto;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          min-height: 980px;
          box-sizing: border-box;
        }
        .invoice-body {
          flex: 1 0 auto;
        }
        .invoice-footer {
          margin-top: auto !important;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        @media print {
          html, body {
            background-color: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            height: 100% !important;
          }
          .print-wrapper {
            padding: 0 !important;
            background-color: #ffffff !important;
            min-height: 100vh !important;
            height: 100% !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 96vh !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .invoice-footer {
            margin-top: auto !important;
          }
        }
      </style>
      </head><body><div class="print-wrapper">${printRef.current.innerHTML}</div></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };
  const handlePreviewDraft = (shouldPrint = false) => {
    const subtotal = calcSubtotal(form.items);
    const discountVal = parseFloat(form.discount) || 0;
    const discountedSubtotal = Math.max(0, subtotal - discountVal);
    const computedTaxes = calcTaxes(subtotal, form.discount, form.taxes);
    const vat = calcTotalTaxAmount(computedTaxes);
    const total = discountedSubtotal + vat;

    const draftInvoice = {
      id: 'draft',
      invoiceType: form.invoiceType || 'commercial',
      invoiceNumber: form.invoiceNumber,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      validUntil: form.validUntil,
      leadTime: form.leadTime,
      poNumber: form.poNumber,
      customerName: form.customerName || 'Draft Customer',
      customerCompany: form.customerCompany || '',
      customerPhone: form.customerPhone || '',
      customerEmail: form.customerEmail || '',
      customerAddress: form.customerAddress || '',
      items: form.items.map(item => ({
        name: item.name || 'Custom Line Item',
        quantity: parseInt(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        total: (parseInt(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0)
      })),
      subtotal,
      discount: discountVal,
      taxes: computedTaxes,
      vat,
      total,
      status: form.invoiceType === 'proforma' ? 'proforma' : 'unpaid',
      notes: form.notes || (form.invoiceType === 'proforma' ? 'Draft Pro Forma Quotation' : 'Draft Invoice Preview'),
    };
    
    setViewingInvoice(draftInvoice);
    
    if (shouldPrint) {
      setTimeout(() => {
        handlePrint();
      }, 300);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => {
      const name = (c.name || c.full_name || '').toLowerCase();
      const company = (c.company || c.businessName || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const phone = (c.phone || c.phoneNumber || c.id || '').toLowerCase();
      const address = (c.address || c.location || '').toLowerCase();
      return name.includes(q) || company.includes(q) || email.includes(q) || phone.includes(q) || address.includes(q);
    });
  }, [customers, clientSearchQuery]);

  const selectCustomer = (custId) => {
    const c = customers.find(x => x.id === custId);
    if (c) {
      setForm(prev => ({
        ...prev,
        customerName: c.name || '',
        customerEmail: c.email || '',
        customerPhone: c.phone || c.phoneNumber || c.id || '',
        customerAddress: c.address || '',
        customerCompany: c.company || '',
        customerPhoto: c.photoUrl || '',
      }));
      setClientSearchQuery('');
      setShowClientDropdown(false);
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
      customerPhoto: '',
    }));
    setClientSearchQuery('');
    setShowClientDropdown(false);
  };

  const handleQuickAddCust = async (e) => {
    e.preventDefault();
    if (!quickCust.name.trim()) {
      toast.error('Customer name is required.');
      return;
    }
    setAddingCust(true);
    try {
      const payload = {
        name: quickCust.name.trim(),
        email: quickCust.email.trim(),
        phone: quickCust.phone.trim(),
        company: quickCust.company.trim(),
        address: quickCust.address.trim(),
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'customers'), payload);
      
      // Auto-select this newly created customer
      setForm(prev => ({
        ...prev,
        customerName: payload.name,
        customerEmail: payload.email,
        customerPhone: payload.phone,
        customerCompany: payload.company,
        customerAddress: payload.address,
        customerPhoto: ''
      }));
      
      toast.success('Customer added successfully!');
      setShowQuickAddCust(false);
      setQuickCust({ name: '', email: '', phone: '', company: '', address: '' });
      setClientSearchQuery('');
      setShowClientDropdown(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add customer.');
    } finally {
      setAddingCust(false);
    }
  };

  const handleConvertToCommercial = async (invoice) => {
    const isConfirmed = await showConfirm({
      title: 'Convert to Commercial Tax Invoice',
      message: `Convert Pro Forma ${invoice.invoiceNumber} into an official Tax / Commercial Invoice? This will assign a commercial invoice number (MGL...) and allow Paystack online payment.`,
      confirmText: 'Convert to Commercial',
      isDestructive: false
    });
    if (!isConfirmed) return;

    try {
      const newInvoiceNum = generateInvoiceNumber();
      const updatedData = {
        invoiceType: 'commercial',
        invoiceNumber: newInvoiceNum,
        proformaReference: invoice.invoiceNumber,
        status: 'unpaid',
        dueDate: invoice.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lastUpdated: new Date().toISOString()
      };

      if (db) {
        await updateDoc(doc(db, 'invoices', invoice.id), updatedData);
      }

      setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, ...updatedData } : inv));
      if (viewingInvoice && viewingInvoice.id === invoice.id) {
        setViewingInvoice(prev => ({ ...prev, ...updatedData }));
      }
      setOpenMenuId(null);
      await logAction({
        module: 'INVOICES',
        action: 'CONVERT_PROFORMA',
        details: `Converted Pro Forma #${invoice.invoiceNumber} to Commercial Tax Invoice #${newInvoiceNum} for ${invoice.customerName || 'Customer'}`,
        targetId: newInvoiceNum,
        severity: 'info',
        userEmail: user?.email,
        userName: user?.full_name || 'Staff',
        metadata: {
          proformaReference: invoice.invoiceNumber,
          newInvoiceNumber: newInvoiceNum,
          customerName: invoice.customerName
        }
      });
      toast.success(`Converted to Commercial Invoice #${newInvoiceNum}!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to convert invoice.');
    }
  };

  const openPackingList = (invoice) => {
    if (!invoice) return;

    const rawNum = String(invoice.invoiceNumber || '').replace(/[^0-9]/g, '');
    const plNum = invoice.packingListNo || `THP${rawNum.padStart(8, '0') || '00002628'}`;
    const todayFormatted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const rawItems = (Array.isArray(invoice.items) && invoice.items.length > 0)
      ? invoice.items
      : (Array.isArray(invoice.cartItems) && invoice.cartItems.length > 0)
        ? invoice.cartItems
        : [{ name: 'Multifloral Honey', quantity: 200 }];

    const items = rawItems.map(item => {
      const name = item.name || 'Pure Honey';
      const nameLower = name.toLowerCase();
      let packaging = 'Yellow Food-grade Plastic Gallon';
      let unitSize = '25 Litres';
      let unitName = 'Gallons';

      if (nameLower.includes('500g') || nameLower.includes('jar')) {
        packaging = 'Food-grade Glass Jar';
        unitSize = '500g';
        unitName = 'Jars';
      } else if (nameLower.includes('1kg') || nameLower.includes('1 kg')) {
        packaging = 'Food-grade Glass Jar';
        unitSize = '1 kg';
        unitName = 'Jars';
      } else if (nameLower.includes('20l') || nameLower.includes('bucket')) {
        packaging = 'Food-grade Plastic Bucket';
        unitSize = '20 Litres';
        unitName = 'Buckets';
      } else if (nameLower.includes('comb')) {
        packaging = 'Airtight Honeycomb Tub';
        unitSize = '400g';
        unitName = 'Tubs';
      } else if (!nameLower.includes('gallon') && !nameLower.includes('25l')) {
        packaging = 'Carton / Standard Packaging';
        unitSize = '1 Unit';
        unitName = 'Units';
      }

      const qty = Number(item.quantity || 1);

      return {
        description: name,
        packaging,
        unitSize,
        quantity: qty,
        unitName
      };
    });

    setPackingListData({
      packingListNo: plNum,
      date: invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : todayFormatted,
      invoiceNo: invoice.invoiceNumber || 'N/A',
      customerName: invoice.customerName || '',
      customerCompany: invoice.customerCompany || '',
      customerAddress: invoice.customerAddress || '',
      customerPhone: invoice.customerPhone || '',
      modeOfTransport: invoice.modeOfTransport || 'Road Transport',
      vehicleType: invoice.vehicleType || 'Kia Cargo Truck',
      driverName: invoice.driverName || '',
      vehicleRegNo: invoice.vehicleRegNo || '',
      dispatchDate: invoice.dispatchDate || todayFormatted,
      expectedDeliveryDate: invoice.expectedDeliveryDate || '',
      items,
      dispatchedByName: invoice.dispatchedByName || 'The Honey Palace Staff',
      receivedByName: invoice.receivedByName || '',
      receivedByCompany: invoice.receivedByCompany || invoice.customerCompany || invoice.customerName || ''
    });

    setPackingListInvoice(invoice);
  };

  // Lock background scroll and handle Escape key for Packing List modal
  useEffect(() => {
    if (!packingListInvoice) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPackingListInvoice(null);
        setPackingListData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [packingListInvoice]);

  const handlePrintPackingList = () => {
    if (!packingListPrintRef.current) return;
    const printContents = packingListPrintRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      toast.error('Please allow popups to print packing list');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Packing List - ${packingListData?.packingListNo || 'THP'}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 0;
              color: #111827;
              background-color: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-card {
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
            }
          </style>
        </head>
        <body>
          ${printContents}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const openWaybill = (invoice) => {
    if (!invoice) return;

    const rawNum = String(invoice.invoiceNumber || '').replace(/[^0-9]/g, '');
    const wbNum = invoice.waybillNo || `THPA-WB${rawNum ? rawNum.slice(-7).padStart(7, '0') : '2026125'}`;
    const plNum = invoice.packingListNo || `THP${rawNum ? rawNum.padStart(8, '0') : '00002630'}`;
    const todayFormatted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const rawItems = (Array.isArray(invoice.items) && invoice.items.length > 0)
      ? invoice.items
      : (Array.isArray(invoice.cartItems) && invoice.cartItems.length > 0)
        ? invoice.cartItems
        : [{ name: 'Multifloral Honey', quantity: 200 }];

    const items = rawItems.map((item, idx) => {
      const name = item.name || 'Multifloral Honey';
      const nameLower = name.toLowerCase();
      let packaging = 'Yellow Food-grade Plastic Gallon';
      let unitSize = '25 Litres';
      let unitName = 'Gallons';

      if (nameLower.includes('500g') || nameLower.includes('jar')) {
        packaging = 'Food-grade Glass Jar';
        unitSize = '500g';
        unitName = 'Jars';
      } else if (nameLower.includes('1kg') || nameLower.includes('1 kg')) {
        packaging = 'Food-grade Glass Jar';
        unitSize = '1 kg';
        unitName = 'Jars';
      } else if (nameLower.includes('20l') || nameLower.includes('bucket')) {
        packaging = 'Food-grade Plastic Bucket';
        unitSize = '20 Litres';
        unitName = 'Buckets';
      } else if (nameLower.includes('comb')) {
        packaging = 'Airtight Honeycomb Tub';
        unitSize = '400g';
        unitName = 'Tubs';
      } else if (!nameLower.includes('gallon') && !nameLower.includes('25l')) {
        packaging = 'Carton / Standard Packaging';
        unitSize = '1 Unit';
        unitName = 'Units';
      }

      const qty = Number(item.quantity || 1);

      return {
        itemNo: idx + 1,
        description: name,
        packaging,
        unitSize,
        quantity: qty,
        unitName
      };
    });

    setWaybillData({
      waybillNo: wbNum,
      packingListNo: plNum,
      invoiceNo: invoice.invoiceNumber || 'MGL726959',
      date: invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : todayFormatted,
      senderName: 'The Honey Palace Africa Ltd',
      senderAddress: 'Amrahia - Inside GreenField Estate',
      senderEmail: 'thehoneypalace2022@gmail.com',
      senderPhone: '+233554548978',
      receiverName: invoice.customerName || '',
      receiverCompany: invoice.customerCompany || invoice.customerName || 'CSIR - FORIG',
      receiverAddress: invoice.customerAddress || '',
      receiverPhone: invoice.customerPhone || '',
      modeOfTransport: invoice.modeOfTransport || 'Road',
      vehicleType: invoice.vehicleType || 'Kia Cargo Truck',
      vehicleRegNo: invoice.vehicleRegNo || '',
      driverName: invoice.driverName || '',
      driverPhone: invoice.driverPhone || '',
      departureDate: invoice.dispatchDate || todayFormatted,
      expectedDeliveryDate: invoice.expectedDeliveryDate || '',
      items,
      dispatchedByName: invoice.dispatchedByName || 'The Honey Palace Staff',
      dispatchedByPosition: invoice.dispatchedByPosition || 'Warehouse & Dispatch Supervisor',
      receivedByName: invoice.receivedByName || '',
      receivedByCompany: invoice.receivedByCompany || invoice.customerCompany || invoice.customerName || ''
    });

    setWaybillInvoice(invoice);
  };

  // Lock background scroll and handle Escape key for Waybill modal
  useEffect(() => {
    if (!waybillInvoice) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setWaybillInvoice(null);
        setWaybillData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [waybillInvoice]);

  const handlePrintWaybill = () => {
    if (!waybillPrintRef.current) return;
    const printContents = waybillPrintRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      toast.error('Please allow popups to print waybill');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Waybill / Delivery Note - ${waybillData?.waybillNo || 'THPA-WB'}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 0;
              color: #111827;
              background-color: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-card {
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
            }
          </style>
        </head>
        <body>
          ${printContents}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const activeInvoices = invoices.filter(inv => !inv.isDeleted);

  const proformaInvoicesCount = activeInvoices.filter(i => i.invoiceType === 'proforma').length;
  const commercialInvoices = activeInvoices.filter(i => i.invoiceType !== 'proforma');
  const totalInvoicesCount = commercialInvoices.length;
  const paidInvoicesCount = commercialInvoices.filter(i => i.status === 'paid').length;
  const unpaidInvoicesCount = commercialInvoices.filter(i => i.status === 'unpaid').length;
  const overdueInvoicesCount = commercialInvoices.filter(i => i.status === 'unpaid' && i.dueDate && new Date(i.dueDate) < new Date()).length;

  const totalInvoicedAmt = commercialInvoices.reduce((acc, i) => acc + (i.total || 0), 0);
  const totalPaidAmt = commercialInvoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + (i.total || 0), 0);
  const totalUnpaidAmt = commercialInvoices.filter(i => i.status === 'unpaid').reduce((acc, i) => acc + (i.total || 0), 0);
  const totalProformaAmt = activeInvoices.filter(i => i.invoiceType === 'proforma').reduce((acc, i) => acc + (i.total || 0), 0);

  const filtered = activeInvoices.filter(inv => {
    if (activeTab === 'proforma') {
      if (inv.invoiceType !== 'proforma') return false;
    } else if (activeTab === 'paid') {
      if (inv.status !== 'paid' || inv.invoiceType === 'proforma') return false;
    } else if (activeTab === 'unpaid') {
      if (inv.status !== 'unpaid' || inv.invoiceType === 'proforma') return false;
    } else if (activeTab === 'overdue') {
      if (inv.invoiceType === 'proforma') return false;
      const isOverdue = inv.status === 'unpaid' && inv.dueDate && new Date(inv.dueDate) < new Date();
      if (!isOverdue) return false;
    } else if (activeTab === 'all') {
      // shows all invoices and quotations
    }
    if (!search) return true;
    const s = search.toLowerCase();
    return inv.invoiceNumber?.toLowerCase().includes(s) || inv.customerName?.toLowerCase().includes(s) || inv.customerCompany?.toLowerCase().includes(s);
  });

  const COMPANY = {
    name: 'The Honey Palace Africa',
    email: 'purchases@thehoneypalaceafrica.com',
    phone: '+233 55 454 8978',
    address: 'Inside GreenField Estate, Amrahia - Accra, Ghana',
    website: 'thehoneypalaceafrica.com'
  };

  return (
    <AuthShield requiredPermission="sale.view">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        
        {/* LIST VIEW */}
        {!isCreating && !viewingInvoice && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-[#ffa200]" /> Invoicing
                </h1>
                <p className="text-xs text-gray-500 mt-1">Manage, generate, edit, and email customer invoices.</p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search invoices & quotes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-xs w-52 md:w-56 text-gray-900 focus:outline-none focus:border-[#ffa200]"
                  />
                </div>
                <button
                  onClick={() => startNewInvoice('proforma')}
                  className="px-3.5 py-2 bg-[#fef9c3] hover:bg-[#fef08a] text-amber-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-amber-200/80 shadow-xs cursor-pointer"
                  title="Generate Pro Forma Quotation"
                >
                  <Building className="w-3.5 h-3.5 text-[#d07b00]" /> New Pro Forma
                </button>
                <button
                  onClick={() => startNewInvoice('commercial')}
                  className="px-4 py-2 bg-[#ffa200] hover:bg-[#e59100] text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Create Invoice
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Invoiced</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">GHS {totalInvoicedAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p className="text-[9px] text-gray-400 mt-0.5">{totalInvoicesCount} total invoices</p>
                </div>
                <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-100">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#D07B00] font-bold uppercase tracking-wider">Paid Revenue</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">GHS {totalPaidAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p className="text-[9px] text-[#D07B00] mt-0.5">{paidInvoicesCount} paid</p>
                </div>
                <div className="w-10 h-10 bg-[#ffa200]/10 rounded-2xl flex items-center justify-center text-[#ffa200] border border-[#ffa200]/20">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-amber-600">Outstanding</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">GHS {totalUnpaidAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p className="text-[9px] text-amber-600 mt-0.5">{unpaidInvoicesCount} pending</p>
                </div>
                <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-100">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-red-600">Overdue Invoices</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">
                    {overdueInvoicesCount}
                  </h3>
                  <p className="text-[9px] text-red-600 mt-0.5">past due date</p>
                </div>
                <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 border border-red-100">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 overflow-x-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'all' ? 'bg-[#000000] text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                All Invoices
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {totalInvoicesCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('unpaid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'unpaid' ? 'bg-[#ffa200] text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Unpaid
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'unpaid' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                  {unpaidInvoicesCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('paid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'paid' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Paid
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'paid' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {paidInvoicesCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('overdue')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'overdue' ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Overdue
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'overdue' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'}`}>
                  {overdueInvoicesCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('proforma')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'proforma' ? 'bg-[#000000] text-white shadow-sm' : 'bg-amber-50/70 text-amber-950 hover:bg-amber-100/80 border border-amber-200/60'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-[#ffa200]" />
                Pro Forma (Quotations)
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'proforma' ? 'bg-[#ffa200] text-black font-bold' : 'bg-amber-200 text-amber-950'}`}>
                  {proformaInvoicesCount}
                </span>
              </button>
            </div>

            {/* Invoices List Table */}
            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading invoices...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-white border border-gray-200 rounded-3xl">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium text-sm">No invoices found.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 bg-gray-50/50 font-semibold uppercase tracking-wider">
                      <th className="p-4">Invoice #</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Issue Date</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(inv => {
                      const isPf = inv.invoiceType === 'proforma';
                      return (
                      <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition cursor-pointer text-gray-900" onClick={() => setViewingInvoice(inv)}>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-gray-900">{inv.invoiceNumber}</span>
                            {isPf && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200">Quote</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-gray-800">{inv.customerName}</p>
                          {inv.customerCompany && <p className="text-[10px] text-gray-400">{inv.customerCompany}</p>}
                        </td>
                        <td className="p-4 text-gray-500">{new Date(inv.issueDate || inv.createdAt).toLocaleDateString('en-GB')}</td>
                        <td className="p-4 text-right font-bold text-gray-900">GHS {inv.total?.toFixed(2)}</td>
                        <td className="p-4">
                          {isPf ? (
                            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                              Pro Forma
                            </span>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase ${
                              inv.status === 'paid' ? 'bg-[#ffa200]/10 text-[#D07B00] border border-[#ffa200]/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>{inv.status}</span>
                          )}
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block text-left invoice-menu-container">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                              className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-600 focus:outline-none cursor-pointer"
                              title="Invoice Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuId === inv.id && (
                              <div className="absolute right-0 mt-1 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150 text-left">
                                {/* View & Print */}
                                <button
                                  type="button"
                                  onClick={() => { setViewingInvoice(inv); setOpenMenuId(null); }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                >
                                  <Eye className="w-4 h-4 text-gray-500" /> View & Print
                                </button>

                                {/* Convert to Commercial Invoice (if Pro Forma) */}
                                {isPf && (
                                  <button
                                    type="button"
                                    onClick={() => handleConvertToCommercial(inv)}
                                    className="w-full px-3.5 py-2 text-left text-xs text-amber-800 hover:bg-amber-50 flex items-center gap-2.5 font-bold cursor-pointer"
                                  >
                                    <RefreshCw className="w-4 h-4 text-[#ffa200]" /> Convert to Commercial
                                  </button>
                                )}

                                {/* Edit Invoice */}
                                <button
                                  type="button"
                                  onClick={() => startEditInvoice(inv)}
                                  className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                >
                                  <Edit className="w-4 h-4 text-amber-600" /> Edit {isPf ? 'Quotation' : 'Invoice'} {!inv.emailSent && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold ml-auto">Unsent</span>}
                                </button>

                                {/* Email Client */}
                                {inv.customerEmail && (
                                  <button
                                    type="button"
                                    onClick={() => { handleOpenEmailPreview(inv); setOpenMenuId(null); }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                  >
                                    <Mail className="w-4 h-4 text-blue-600" /> Email Client {inv.emailSent && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold ml-auto">Sent</span>}
                                  </button>
                                )}

                                {/* Send SMS */}
                                {inv.customerPhone && (
                                  <button
                                    type="button"
                                    onClick={() => { handleSendInvoiceSms(inv); setOpenMenuId(null); }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                  >
                                    <MessageSquare className="w-4 h-4 text-emerald-600" /> Send Payment SMS
                                  </button>
                                )}

                                {/* Copy Payment Link */}
                                {inv.paymentUrl && (
                                  <button
                                    type="button"
                                    onClick={() => copyPaymentLink(inv.paymentUrl)}
                                    className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                  >
                                    <Copy className="w-4 h-4 text-amber-600" /> Copy Payment Link
                                  </button>
                                )}

                                {/* Packing List */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    openPackingList(inv);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                >
                                  <Package className="w-4 h-4 text-amber-600" /> Packing List
                                </button>

                                {/* Waybill / Delivery Note */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    openWaybill(inv);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                >
                                  <FileText className="w-4 h-4 text-amber-600" /> Waybill / Delivery Note
                                </button>

                                {/* Verify Paystack Status */}
                                {inv.status === 'unpaid' && (
                                  <button
                                    type="button"
                                    onClick={() => { checkPaymentStatus(inv); setOpenMenuId(null); }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                  >
                                    <RefreshCw className="w-4 h-4 text-emerald-600" /> Verify Paystack
                                  </button>
                                )}

                                {/* Mark as Paid */}
                                {inv.status === 'unpaid' && (
                                  <button
                                    type="button"
                                    onClick={() => { markAsPaid(inv); setOpenMenuId(null); }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-[#ffa200]" /> Mark as Paid
                                  </button>
                                )}

                                {/* Generate Receipt */}
                                <a
                                  href={`/receipts?invoiceId=${inv.id}`}
                                  className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                >
                                  <ReceiptText className="w-4 h-4 text-emerald-600" /> Issue Receipt
                                </a>

                                <div className="border-t border-gray-100 my-1" />

                                {/* Soft Delete */}
                                <button
                                  type="button"
                                  onClick={() => handleSoftDelete(inv)}
                                  className="w-full px-3.5 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" /> Soft Delete
                                </button>
                              </div>
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
        )}

        {/* INLINE NEW / EDIT INVOICE CREATION VIEW */}
        {isCreating && !viewingInvoice && (
          <div className="space-y-6">
            {/* Header / Nav */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsCreating(false); setEditingInvoiceId(null); }} className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition shadow-sm cursor-pointer">
                  <ArrowLeft className="w-4 h-4 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingInvoiceId 
                      ? `Edit ${form.invoiceType === 'proforma' ? 'Pro Forma Quotation' : 'Invoice'}: ${form.invoiceNumber}` 
                      : `New ${form.invoiceType === 'proforma' ? 'Pro Forma Quotation' : 'Invoice'}: ${form.invoiceNumber}`}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.invoiceType === 'proforma'
                      ? 'Draft an official B2B price quote & delivery estimate for buyer procurement review.'
                      : 'Fill in product details and customer information below.'}
                  </p>
                </div>
              </div>

              {/* Type Switcher */}
              <div className="inline-flex p-1 bg-gray-100 rounded-2xl border border-gray-200/80 shadow-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleSwitchInvoiceType('commercial')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    form.invoiceType === 'commercial'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-[#ffa200]" />
                  Commercial Tax Invoice
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchInvoiceType('proforma')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    form.invoiceType === 'proforma'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Building className="w-3.5 h-3.5 text-[#ffa200]" />
                  Pro Forma Quotation
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Center Canvas */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
                  
                  {/* Company Brand Banner / Corporate Header */}
                  {form.invoiceType === 'proforma' ? (
                    <div className="space-y-5">
                      {/* Top Row: Logo Left, Pro Forma Invoice Title Right */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2">
                        <div>
                          <img src="/assets/honey-palace-logo.png" className="h-14 w-auto object-contain" alt="Logo" />
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">The Home of Quality Honey</p>
                        </div>
                        <div className="text-left md:text-right">
                          <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">PRO FORMA INVOICE</h2>
                          <div className="w-12 h-1 bg-[#ffa200] rounded-full mt-1.5 md:ml-auto"></div>
                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mt-1">Commercial Price Quotation</p>
                        </div>
                      </div>

                      {/* 4-Column Metadata Band */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-100 text-xs">
                        <div className="space-y-1 pr-2 border-r border-gray-50">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Invoice no.</span>
                          <span className="font-mono font-bold text-gray-900 text-sm">#{form.invoiceNumber}</span>
                        </div>
                        <div className="space-y-1 px-2 border-r border-gray-50">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Date</span>
                          <span className="font-bold text-gray-900 text-xs">{new Date(form.issueDate).toLocaleDateString('en-GB')}</span>
                        </div>
                        <div className="space-y-1 px-2 border-r border-gray-50">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Valid Until</span>
                          <span className="font-bold text-amber-700 text-xs">{form.validUntil ? new Date(form.validUntil).toLocaleDateString('en-GB') : '14 Days'}</span>
                          {form.leadTime && <span className="text-[10px] text-gray-500 block truncate">Lead: {form.leadTime}</span>}
                        </div>
                        <div className="space-y-1 pl-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Invoice to:</span>
                          <span className="font-bold text-gray-900 text-xs block truncate">{form.customerName || 'Select Client →'}</span>
                          {form.customerCompany && <span className="text-[10px] text-gray-500 block truncate">{form.customerCompany}</span>}
                        </div>
                      </div>

                      {/* Featured Total Row */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 pt-1 pb-3">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL DUE (ESTIMATED)</span>
                          <div className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mt-0.5">
                            GHS {calculateTotal().toFixed(2)}
                          </div>
                        </div>
                        {form.customerAddress && (
                          <div className="text-right text-[11px] text-gray-500 space-y-0.5 max-w-xs">
                            <p className="truncate">{form.customerAddress}</p>
                            {form.customerPhone && <p>{form.customerPhone}</p>}
                            {form.customerEmail && <p>{form.customerEmail}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-[#000000] border-l-4 border-[#ffa200] text-white p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
                        <div className="space-y-1">
                          <div className="mb-2">
                            <img src="/assets/honey-palace-logo.png" className="h-24 w-auto object-contain" alt="Logo" />
                          </div>
                        </div>
                        <div className="text-left md:text-right text-[10px] text-gray-300 space-y-0.5">
                          <p>{COMPANY.address}</p>
                          <p className="text-[#ffa200] font-semibold">{COMPANY.email}</p>
                          <p>{COMPANY.phone}</p>
                        </div>
                      </div>

                      {/* Invoice Meta Grid */}
                      <div className="grid grid-cols-2 gap-6 text-xs border-b border-gray-100 pb-6">
                        <div className="space-y-2">
                          <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px]">Invoice Number</h4>
                          <p className="text-gray-900 font-mono font-bold text-sm">{form.invoiceNumber}</p>
                          <div className="space-y-1 text-gray-500">
                            <p>Issued Date: {new Date(form.issueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            {form.dueDate && <p>Due Date: {new Date(form.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                          </div>
                        </div>
                        <div className="space-y-2 text-right md:text-left">
                          <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px]">Billed to</h4>
                          {form.customerName ? (
                            <div className="space-y-0.5 text-gray-600">
                              <p className="font-bold text-gray-900 text-sm">{form.customerName}</p>
                              {form.customerCompany && <p className="font-medium text-gray-700">{form.customerCompany}</p>}
                              {form.customerAddress && <p className="text-[10px]">{form.customerAddress}</p>}
                            </div>
                          ) : (
                            <p className="text-gray-400 italic">Select client from the sidebar →</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Item Details */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">Item Details</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Details item with more info</p>
                    </div>

                    <div className="space-y-3">
                      {/* Form inputs list */}
                      {form.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                          {/* Item Name (Smart Search / Autocomplete) */}
                          <div className="col-span-6 relative">
                            <input
                              type="text"
                              required
                              value={item.name}
                              onChange={(e) => {
                                updateLineItem(idx, 'name', e.target.value);
                                setActiveProductDropdownIdx(idx);
                              }}
                              onFocus={() => setActiveProductDropdownIdx(idx)}
                              onBlur={() => setTimeout(() => setActiveProductDropdownIdx(null), 200)}
                              placeholder="Search products or type custom item name..."
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white text-gray-900 focus:outline-none focus:border-[#ffa200]"
                            />
                            {activeProductDropdownIdx === idx && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                {products.filter(p => p.name.toLowerCase().includes(item.name.toLowerCase())).length > 0 ? (
                                  products
                                    .filter(p => p.name.toLowerCase().includes(item.name.toLowerCase()))
                                    .map(p => (
                                      <div 
                                        key={p.id}
                                        className="p-2.5 hover:bg-orange-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0 transition-colors"
                                        onClick={() => {
                                          updateLineItemMultiple(idx, { name: p.name, unitPrice: p.sellingPrice?.toString() || '' });
                                          setActiveProductDropdownIdx(null);
                                        }}
                                      >
                                        <div className="flex flex-col overflow-hidden">
                                          <span className="font-bold text-gray-900 text-[11px] truncate">{p.name}</span>
                                          {p.stockLevel > 0 ? (
                                            <span className="text-[9px] text-[#D07B00] font-medium">In Stock: {p.stockLevel}</span>
                                          ) : (
                                            <span className="text-[9px] text-red-500 font-medium">Out of Stock</span>
                                          )}
                                        </div>
                                        <span className="text-gray-600 font-mono text-[11px] font-bold">₵{p.sellingPrice}</span>
                                      </div>
                                    ))
                                ) : (
                                  <div className="p-3 text-[10px] text-gray-400 text-center italic">
                                    No matching products found. You can still use this as a custom item.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Qty */}
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-center bg-white text-gray-900 focus:outline-none"
                            />
                          </div>

                          {/* Unit Price */}
                          <div className="col-span-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                              placeholder="Rate"
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-right bg-white text-gray-900 focus:outline-none"
                            />
                          </div>

                          {/* Line Total */}
                          <div className="col-span-2 flex items-center justify-between pl-2">
                            <span className="font-bold text-xs text-gray-900">
                              ₵{((parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)}
                            </span>
                            {form.items.length > 1 && (
                              <button type="button" onClick={() => removeLineItem(idx)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Add Item Button */}
                      <button
                        type="button"
                        onClick={addLineItem}
                        className="text-xs font-bold text-[#ffa200] hover:text-[#e59100] flex items-center gap-1 mt-2 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Item
                      </button>
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="border-t border-gray-100 pt-6 flex justify-end">
                    <div className="w-80 space-y-3 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-bold text-gray-900">GHS {calcSubtotal(form.items).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span>Discount (GHS)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.discount}
                          onChange={(e) => setForm({ ...form, discount: e.target.value })}
                          placeholder="0.00"
                          className="w-24 px-2 py-1 border border-gray-200 rounded-xl text-right text-xs bg-white text-gray-900 focus:outline-none focus:border-[#ffa200]"
                        />
                      </div>

                      {/* Dynamic Taxes Builder */}
                      <div className="border-t border-b border-gray-100 py-2.5 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800 text-[11px] uppercase">Taxes</span>
                          <button
                            type="button"
                            onClick={addTaxRow}
                            className="text-[11px] font-bold text-[#ffa200] hover:text-[#e59100] flex items-center gap-1 transition cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add Tax
                          </button>
                        </div>

                        {(form.taxes || []).map((tax, tIdx) => {
                          const net = Math.max(0, calcSubtotal(form.items) - (parseFloat(form.discount) || 0));
                          const rateVal = parseFloat(tax.rate) || 0;
                          const taxAmt = net * (rateVal / 100);
                          const matchedPreset = PRESET_TAXES.find(p => p.name && p.name === tax.name);
                          const isCustom = !matchedPreset || tax.isCustom;
                          const selectVal = matchedPreset && !tax.isCustom ? matchedPreset.name : '__custom__';

                          return (
                            <div key={tIdx} className="bg-gray-50 border border-gray-200 rounded-xl p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={selectVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '__custom__') {
                                      updateTaxRow(tIdx, { name: '', rate: '0', isCustom: true });
                                    } else {
                                      const preset = PRESET_TAXES.find(p => p.name === val);
                                      if (preset) {
                                        updateTaxRow(tIdx, {
                                          name: preset.name,
                                          rate: preset.defaultRate,
                                          isCustom: false
                                        });
                                      }
                                    }
                                  }}
                                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-900 font-semibold focus:outline-none focus:border-[#ffa200] truncate"
                                >
                                  <option value="__custom__">-- Custom Tax (Type name & rate) --</option>
                                  <optgroup label="Standard Indirect Taxes">
                                    {PRESET_TAXES.filter(p => !p.isDeduction && p.name).map(p => (
                                      <option key={p.name} value={p.name}>{p.label}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Withholding Taxes">
                                    {PRESET_TAXES.filter(p => p.isDeduction).map(p => (
                                      <option key={p.name} value={p.name}>{p.label}</option>
                                    ))}
                                  </optgroup>
                                </select>

                                <div className="relative w-20 shrink-0">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    placeholder="Rate"
                                    value={tax.rate}
                                    onChange={(e) => updateTaxRow(tIdx, 'rate', e.target.value)}
                                    className="w-full pl-2 pr-5 py-1.5 border border-gray-200 rounded-lg text-right text-xs bg-white text-gray-900 font-bold focus:outline-none focus:border-[#ffa200]"
                                  />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">%</span>
                                </div>
                                <span className="w-16 shrink-0 text-right font-semibold text-gray-800 text-xs whitespace-nowrap">
                                  ₵{taxAmt.toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeTaxRow(tIdx)}
                                  className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Delete Tax"
                                  aria-label="Delete Tax"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {isCustom && (
                                <input
                                  type="text"
                                  placeholder="Enter custom tax name..."
                                  value={tax.name}
                                  onChange={(e) => updateTaxRow(tIdx, { name: e.target.value, isCustom: true })}
                                  className="w-full min-w-0 px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white text-gray-900 focus:outline-none focus:border-[#ffa200]"
                                />
                              )}
                            </div>
                          );
                        })}

                        {(!form.taxes || form.taxes.length === 0) && (
                          <div className="text-center py-2.5 px-2 border border-dashed border-gray-200 rounded-xl bg-white/70 text-xs text-gray-400">
                            No taxes applied. Click <button type="button" onClick={addTaxRow} className="font-bold text-[#ffa200] hover:underline cursor-pointer inline">+ Add Tax</button> to add one.
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-bold text-gray-900">
                        <span>Total</span>
                        <span>
                          GHS {(
                            Math.max(0, calcSubtotal(form.items) - (parseFloat(form.discount) || 0)) + 
                            calcTotalTaxAmount(calcTaxes(calcSubtotal(form.items), form.discount, form.taxes))
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-6">
                
                {/* Client Details Card */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#ffa200]" />
                      Client Details
                    </h4>
                    {form.customerName && (
                      <button
                        type="button"
                        onClick={clearSelectedCustomer}
                        className="text-[10px] text-gray-400 hover:text-red-600 transition flex items-center gap-1 cursor-pointer font-medium"
                        title="Clear selected client"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>

                  {/* Smart Search Bar & Picker */}
                  <div className="space-y-1.5 relative" ref={clientSearchRef}>
                    <label className="text-[10px] text-gray-500 font-semibold uppercase flex items-center justify-between">
                      <span>Search & Select Client</span>
                      <span className="text-[9px] text-gray-400 font-normal">Name, company, phone, email</span>
                    </label>
                    
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Search className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder={form.customerName ? `Selected: ${form.customerName}` : "Search wholesale buyer..."}
                        className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ffa200]/40 focus:border-[#ffa200] transition"
                      />
                      {clientSearchQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setClientSearchQuery('');
                            setShowClientDropdown(true);
                          }}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowClientDropdown(prev => !prev)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Results Dropdown Flyout */}
                    {showClientDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-gray-50 animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Header bar in dropdown */}
                        <div className="px-3 py-1.5 bg-gray-50/80 flex items-center justify-between text-[10px] text-gray-500 font-medium">
                          <span>{filteredCustomers.length} client{filteredCustomers.length === 1 ? '' : 's'}</span>
                          {clientSearchQuery && (
                            <span className="text-gray-400 truncate max-w-[130px]">matching "{clientSearchQuery}"</span>
                          )}
                        </div>

                        {filteredCustomers.length === 0 ? (
                          <div className="p-4 text-center space-y-2">
                            <p className="text-xs text-gray-500">No client matching "{clientSearchQuery}"</p>
                            <button
                              type="button"
                              onClick={() => {
                                setQuickCust(prev => ({ ...prev, name: clientSearchQuery }));
                                setShowQuickAddCust(true);
                                setShowClientDropdown(false);
                              }}
                              className="px-3 py-1.5 bg-[#ffa200] hover:bg-[#e08f00] text-amber-950 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Quick-add "{clientSearchQuery}"
                            </button>
                          </div>
                        ) : (
                          filteredCustomers.map(c => {
                            const isSelected = form.customerName === c.name;
                            return (
                              <div
                                key={c.id}
                                onClick={() => selectCustomer(c.id)}
                                className={`p-2.5 cursor-pointer flex items-center gap-3 transition-colors ${
                                  isSelected ? 'bg-amber-50/90 border-l-4 border-[#ffa200]' : 'hover:bg-amber-50/40'
                                }`}
                              >
                                <div className="w-8 h-8 rounded-full bg-[#ffa200]/10 flex items-center justify-center text-xs font-bold text-[#ffa200] border border-[#ffa200]/20 flex-shrink-0">
                                  {(c.name || 'C').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="text-xs font-bold text-gray-900 truncate">{c.name}</p>
                                    {c.customer_type === 'Wholesale' && (
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200 flex-shrink-0">Wholesale</span>
                                    )}
                                  </div>
                                  {c.company && (
                                    <p className="text-[10px] text-[#d97706] font-semibold truncate flex items-center gap-1 mt-0.5">
                                      <Building className="w-2.5 h-2.5 flex-shrink-0" /> {c.company}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                    {(c.phone || c.phoneNumber) && (
                                      <span className="truncate flex items-center gap-0.5">
                                        <Smartphone className="w-2.5 h-2.5 flex-shrink-0" /> {c.phone || c.phoneNumber}
                                      </span>
                                    )}
                                    {c.email && (
                                      <span className="truncate flex items-center gap-0.5">
                                        <Mail className="w-2.5 h-2.5 flex-shrink-0" /> {c.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-[#ffa200] flex-shrink-0" />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Client Card Preview */}
                  {form.customerName ? (
                    <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#ffa200] flex items-center justify-center text-xs font-bold text-black flex-shrink-0 shadow-xs">
                            {form.customerName.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-gray-900 truncate">{form.customerName}</p>
                            {form.customerCompany && (
                              <p className="text-[10px] text-[#b45309] font-bold truncate flex items-center gap-1">
                                <Building className="w-2.5 h-2.5 flex-shrink-0" /> {form.customerCompany}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowClientDropdown(true)}
                          className="text-[10px] font-semibold text-amber-900 hover:text-amber-950 bg-white hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition cursor-pointer flex-shrink-0"
                        >
                          Change
                        </button>
                      </div>

                      <div className="pt-2 border-t border-amber-200/50 space-y-1 text-[11px] text-gray-600">
                        {form.customerPhone && (
                          <p className="flex items-center gap-1.5 truncate">
                            <Smartphone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{form.customerPhone}</span>
                          </p>
                        )}
                        {form.customerEmail && (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{form.customerEmail}</span>
                          </p>
                        )}
                        {form.customerAddress && (
                          <p className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{form.customerAddress}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2.5 px-3 bg-gray-50/60 rounded-xl border border-dashed border-gray-200 text-[11px] text-gray-400">
                      No client selected. Search above or quick-add.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowQuickAddCust(true)}
                    className="w-full py-2 bg-[#fef9c3] hover:bg-[#fef08a] text-amber-950 font-bold rounded-xl text-xs transition border border-amber-200/50 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Quick-add Customer
                  </button>
                </div>

                {/* Basic Info / Terms Card */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">
                      {form.invoiceType === 'proforma' ? 'Quotation Terms' : 'Basic Info'}
                    </h4>
                    {form.invoiceType === 'proforma' && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                        B2B Estimate
                      </span>
                    )}
                  </div>

                  {/* Dates & Terms */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                        {form.invoiceType === 'proforma' ? 'Quotation Date' : 'Invoice Date'}
                      </label>
                      <input
                        type="date"
                        value={form.issueDate}
                        onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-800 focus:outline-none focus:border-[#ffa200]"
                      />
                    </div>

                    {form.invoiceType === 'proforma' ? (
                      <>
                        <div>
                          <label className="text-[10px] text-gray-600 font-semibold uppercase block mb-1">
                            Valid Until (Expiry Date)
                          </label>
                          <input
                            type="date"
                            value={form.validUntil}
                            onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-800 font-medium focus:outline-none focus:border-[#ffa200]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                            Est. Lead Time / Delivery
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 3–5 business days"
                            value={form.leadTime}
                            onChange={(e) => setForm({ ...form, leadTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-800 focus:outline-none focus:border-[#ffa200]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                            Buyer PO / RFQ Ref (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. PO-2026-AVH-01"
                            value={form.poNumber}
                            onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-800 font-mono text-xs focus:outline-none focus:border-[#ffa200]"
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">Due Date</label>
                        <input
                          type="date"
                          value={form.dueDate}
                          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-800 focus:outline-none focus:border-[#ffa200]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={isSaving}
                      className="w-full py-3 bg-[#ffa200] hover:bg-[#e59100] text-black disabled:opacity-60 font-bold rounded-2xl text-xs tracking-wider uppercase transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{editingInvoiceId ? 'Updating...' : (form.invoiceType === 'proforma' ? 'Saving Quotation...' : 'Saving Invoice...')}</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>{editingInvoiceId ? (form.invoiceType === 'proforma' ? 'Update Quotation' : 'Update Invoice') : (form.invoiceType === 'proforma' ? 'Save Pro Forma Quotation' : 'Save Invoice')}</span>
                        </>
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreviewDraft(false)}
                        className="py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreviewDraft(true)}
                        className="py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Generate and save PDF without saving to database"
                      >
                        <Download className="w-3.5 h-3.5" /> Download PDF
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* VIEW INVOICE MODAL DETAIL VIEW */}
        {viewingInvoice && (() => {
          const isViewingProforma = viewingInvoice.invoiceType === 'proforma';
          return (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
            {/* Header bar */}
            <div className="flex justify-between items-center border-b border-gray-50 pb-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setViewingInvoice(null)} className="p-2 hover:bg-gray-50 border border-gray-100 rounded-xl transition cursor-pointer">
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    isViewingProforma
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : (viewingInvoice.status === 'paid' ? 'bg-[#ffa200]/10 text-[#D07B00] border border-[#ffa200]/20' : 'bg-amber-50 text-amber-700 border border-amber-200')
                  }`}>
                    {isViewingProforma ? 'Pro Forma Quotation' : viewingInvoice.status}
                  </span>
                  <span className="font-mono text-xs font-bold text-gray-900">{viewingInvoice.invoiceNumber}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isViewingProforma && viewingInvoice.id !== 'draft' && (
                  <button
                    onClick={() => handleConvertToCommercial(viewingInvoice)}
                    className="px-3 py-1.5 bg-[#ffa200] text-black text-xs font-bold rounded-xl hover:bg-[#D07B00] transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Convert to Final Invoice
                  </button>
                )}
                {viewingInvoice.id !== 'draft' && !isViewingProforma && viewingInvoice.status === 'unpaid' && (
                  <button onClick={() => markAsPaid(viewingInvoice)} className="px-3 py-1.5 bg-[#ffa200] text-black text-xs font-bold rounded-xl hover:bg-[#D07B00] transition flex items-center gap-1 cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                  </button>
                )}
                {viewingInvoice.id !== 'draft' && viewingInvoice.customerEmail && (
                  <button onClick={() => handleOpenEmailPreview(viewingInvoice)} disabled={sending} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                    <Mail className="w-3.5 h-3.5" /> {sending ? 'Sending...' : (isViewingProforma ? 'Email Quote' : 'Email')}
                  </button>
                )}
                {viewingInvoice.id !== 'draft' && (
                  <button
                    onClick={() => openPackingList(viewingInvoice)}
                    className="px-3 py-1.5 bg-[#000000] text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-[#ffa200]" /> Packing List
                  </button>
                )}
                {viewingInvoice.id !== 'draft' && (
                  <button
                    onClick={() => openWaybill(viewingInvoice)}
                    className="px-3 py-1.5 bg-[#ffa200] hover:bg-[#e69200] text-black text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> Waybill
                  </button>
                )}
                {viewingInvoice.id !== 'draft' && (
                  <a
                    href={`/receipts?invoiceId=${viewingInvoice.id}`}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <ReceiptText className="w-3.5 h-3.5" /> Issue Receipt
                  </a>
                )}
                <button onClick={handlePrint} className="px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded-xl hover:bg-gray-200 transition flex items-center gap-1 cursor-pointer">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>

            {/* Print Body (High-contrast professional layout matching user's image) */}
            <div ref={printRef} className="print-wrapper" style={{ backgroundColor: '#f3f4f6', padding: '30px', fontFamily: "'Poppins', sans-serif" }}>
              <div className="print-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '40px', borderRadius: '8px', maxWidth: '800px', margin: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '920px', boxSizing: 'border-box' }}>

                {isViewingProforma ? (
                  /* ========================================================
                     CORPORATE PRO FORMA QUOTATION DESIGN (REFERENCE TEMPLATE)
                     ======================================================== */
                  <div className="proforma-document" style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      {/* 1. Header: Logo Left, Title Right */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                        <tbody>
                          <tr>
                            <td style={{ verticalAlign: 'middle', width: '50%' }}>
                              <img 
                                src="/assets/honey-palace-logo.png" 
                                style={{ width: '130px', height: 'auto', display: 'block' }} 
                                alt="The Honey Palace" 
                              />
                              <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px', fontWeight: '600' }}>
                                The Home of Quality Honey
                              </div>
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '50%' }}>
                              <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>
                                PRO FORMA INVOICE
                              </h1>
                              <div style={{ width: '48px', height: '3px', backgroundColor: '#ffa200', marginLeft: 'auto', marginTop: '8px', borderRadius: '2px' }} />
                              <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '6px', fontWeight: '600' }}>
                                Commercial Price Quotation
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 2. Metadata Strip (4 Columns: Quote No, Date, Valid Until, Quotation To) */}
                      <div style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '16px 0', marginBottom: '24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '22%', verticalAlign: 'top', borderRight: '1px solid #f3f4f6', paddingRight: '12px' }}>
                                <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px' }}>Invoice no.</div>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>#{viewingInvoice.invoiceNumber}</div>
                              </td>
                              <td style={{ width: '20%', verticalAlign: 'top', borderRight: '1px solid #f3f4f6', paddingLeft: '12px', paddingRight: '12px' }}>
                                <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px' }}>Date</div>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#111827' }}>
                                  {new Date(viewingInvoice.issueDate || viewingInvoice.createdAt).toLocaleDateString('en-GB')}
                                </div>
                              </td>
                              <td style={{ width: '22%', verticalAlign: 'top', borderRight: '1px solid #f3f4f6', paddingLeft: '12px', paddingRight: '12px' }}>
                                <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px' }}>Valid Until</div>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#b45309' }}>
                                  {viewingInvoice.validUntil ? new Date(viewingInvoice.validUntil).toLocaleDateString('en-GB') : '14 Days'}
                                </div>
                                {viewingInvoice.leadTime && (
                                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>Lead: {viewingInvoice.leadTime}</div>
                                )}
                              </td>
                              <td style={{ width: '36%', verticalAlign: 'top', paddingLeft: '12px' }}>
                                <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px' }}>Invoice to:</div>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>{viewingInvoice.customerName || 'Valued Client'}</div>
                                {viewingInvoice.customerCompany && (
                                  <div style={{ fontSize: '11px', color: '#4b5563', fontWeight: '600' }}>{viewingInvoice.customerCompany}</div>
                                )}
                                {viewingInvoice.poNumber && (
                                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', fontFamily: 'monospace' }}>PO Ref: {viewingInvoice.poNumber}</div>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 3. Featured Total Display & Client Contact Info */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px' }}>
                        <tbody>
                          <tr>
                            <td style={{ verticalAlign: 'middle', width: '55%' }}>
                              <div style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                TOTAL DUE
                              </div>
                              <div style={{ fontSize: '32px', fontWeight: '900', color: '#111827', marginTop: '2px', letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                                GHS {Number(viewingInvoice.total || 0).toFixed(2)}
                              </div>
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '45%', fontSize: '11px', color: '#4b5563', lineHeight: '1.6' }}>
                              {viewingInvoice.customerAddress && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                  <span>{viewingInvoice.customerAddress}</span>
                                  <svg viewBox="0 0 24 24" width="11" height="11" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                </div>
                              )}
                              {viewingInvoice.customerPhone && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                  <span>{viewingInvoice.customerPhone}</span>
                                  <svg viewBox="0 0 24 24" width="11" height="11" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                </div>
                              )}
                              {viewingInvoice.customerEmail && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                  <span>{viewingInvoice.customerEmail}</span>
                                  <svg viewBox="0 0 24 24" width="11" height="11" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                </div>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 4. Itemized Table with Filled Accent Header and Zebra Rows */}
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
                          {(viewingInvoice.items || []).map((item, idx) => {
                            const isZebra = idx % 2 === 1;
                            const uPrice = Number(item.unitPrice || item.price || 0);
                            const q = Number(item.quantity || 1);
                            const iTotal = Number(item.total || (q * uPrice));
                            return (
                              <tr key={idx} style={{ backgroundColor: isZebra ? '#f9fafb' : '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827' }}>
                                  <div>{item.name || 'Product'}</div>
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
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                        <tbody>
                          <tr>
                            {/* Left Column: Settlement & Terms */}
                            <td style={{ width: '52%', verticalAlign: 'top', paddingRight: '20px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>
                                Payment Method We Accept
                              </div>
                              <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.6' }}>
                                <div><strong>Mobile Money:</strong> {settings?.momoNetwork || 'MTN MoMo'} — {settings?.momoNumber || '+233 54 883 4874'}</div>
                                <div><strong>Account Name:</strong> {settings?.bankAccountName || settings?.companyName || 'The Honey Palace'}</div>
                                {settings?.bankAccountNo && settings.bankAccountNo !== '1234567890123' && (
                                  <div><strong>Bank:</strong> {settings?.bankName || 'Bank'} (A/C: {settings.bankAccountNo})</div>
                                )}
                              </div>

                              <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', fontSize: '10px', color: '#78350f', lineHeight: '1.5' }}>
                                <strong>Quotation Note:</strong> {viewingInvoice.notes && viewingInvoice.notes !== 'Draft Invoice Preview' ? viewingInvoice.notes : 'This Pro Forma Invoice is an official commercial price quotation and cost estimate. Prices quoted are valid for 14 calendar days from date of issue and subject to batch stock availability upon formal Purchase Order confirmation.'}
                              </div>
                            </td>

                            {/* Right Column: Breakdown & Filled Grand Total Bar */}
                            <td style={{ width: '48%', verticalAlign: 'top' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', lineHeight: '1.9' }}>
                                <tbody>
                                  <tr>
                                    <td style={{ color: '#4b5563', fontWeight: '600', width: '50%' }}>Sub Total:</td>
                                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#111827' }}>GHS {Number(viewingInvoice.subtotal || 0).toFixed(2)}</td>
                                  </tr>
                                  {Array.isArray(viewingInvoice.taxes) && viewingInvoice.taxes.length > 0 ? (
                                    viewingInvoice.taxes.map((t, idx) => (
                                      <tr key={idx}>
                                        <td style={{ color: '#4b5563', fontWeight: '600' }}>Tax ({t.name || 'VAT'}{t.rate ? ` ${t.rate}%` : ''}):</td>
                                        <td style={{ textAlign: 'right', fontWeight: '700', color: '#111827' }}>GHS {Number(t.amount || 0).toFixed(2)}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    viewingInvoice.vat > 0 && (
                                      <tr>
                                        <td style={{ color: '#4b5563', fontWeight: '600' }}>Tax (VAT):</td>
                                        <td style={{ textAlign: 'right', fontWeight: '700', color: '#111827' }}>GHS {Number(viewingInvoice.vat || 0).toFixed(2)}</td>
                                      </tr>
                                    )
                                  )}
                                  {viewingInvoice.discount > 0 && (
                                    <tr>
                                      <td style={{ color: '#dc2626', fontWeight: '600' }}>Discount:</td>
                                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>-GHS {Number(viewingInvoice.discount || 0).toFixed(2)}</td>
                                    </tr>
                                  )}
                                  <tr>
                                    <td colSpan="2" style={{ paddingTop: '8px' }}>
                                      <div style={{ backgroundColor: '#ffa200', color: '#000000', padding: '10px 16px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '900', fontSize: '13px' }}>
                                        <span>Grand Total</span>
                                        <span style={{ fontSize: '15px' }}>GHS {Number(viewingInvoice.total || 0).toFixed(2)}</span>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>

                              {/* Signature Block */}
                              <div style={{ marginTop: '28px', textAlign: 'center', marginLeft: 'auto', width: '220px' }}>
                                <div style={{ fontFamily: "'Brush Script MT', 'Dancing Script', 'Caveat', cursive, sans-serif", fontSize: '24px', color: '#111827', lineHeight: '1.1', marginBottom: '4px' }}>
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
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ verticalAlign: 'middle', width: '65%', fontSize: '10px', color: '#6b7280' }}>
                              <div style={{ fontWeight: '800', color: '#111827', textTransform: 'capitalize', marginBottom: '3px' }}>Contact details</div>
                              <div style={{ lineHeight: '1.6' }}>
                                <span>{COMPANY.address}</span> &bull; <span>{COMPANY.phone}</span> &bull; <span>{COMPANY.email}</span>
                              </div>
                            </td>
                            <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '35%' }}>
                              <img 
                                src="/assets/honey-palace-logo.png" 
                                style={{ width: '100px', height: 'auto', display: 'inline-block' }} 
                                alt="Logo" 
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* ========================================================
                     COMMERCIAL TAX INVOICE DESIGN (DARK SIDEBAR TEMPLATE)
                     ======================================================== */
                  <>
                    {/* Upper Invoice Content Body */}
                    <div className="invoice-body" style={{ flex: '1 0 auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                        <tbody>
                          <tr>
                            {/* Left Sidebar Block (Date, Due Date, Billed To) */}
                            <td style={{ width: '38%', backgroundColor: '#000000', color: '#ffffff', padding: '30px', verticalAlign: 'top', borderRadius: '6px 0 0 6px' }}>
                              <div style={{ marginBottom: '15px', fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px' }}>Date:</div>
                              <div style={{ fontSize: '13px', marginBottom: '20px', fontWeight: '500' }}>
                                {new Date(viewingInvoice.issueDate || viewingInvoice.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </div>
                              
                              <div style={{ marginBottom: '15px', fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px' }}>Due Date:</div>
                              <div style={{ fontSize: '13px', marginBottom: '25px', fontWeight: '500' }}>
                                {viewingInvoice.dueDate ? new Date(viewingInvoice.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Upon Receipt'}
                              </div>
                              
                              <hr style={{ border: 0, borderTop: '1px solid #262626', marginBottom: '25px' }} />
                              
                              <div style={{ marginBottom: '10px', fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px' }}>To</div>
                              <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '5px' }}>{viewingInvoice.customerName}</div>
                              <div style={{ fontSize: '11px', color: '#d1d5db', lineHeight: '1.6' }}>
                                {viewingInvoice.customerCompany && <div style={{ fontWeight: '500', marginBottom: '3px' }}>{viewingInvoice.customerCompany}</div>}
                                {viewingInvoice.customerPhone && <div>{viewingInvoice.customerPhone}</div>}
                                {viewingInvoice.customerEmail && <div>{viewingInvoice.customerEmail}</div>}
                                {viewingInvoice.customerAddress && <div style={{ marginTop: '5px' }}>{viewingInvoice.customerAddress}</div>}
                              </div>
                            </td>
                            
                            {/* Right Header Block (Company Logo, Details, Invoice Title) */}
                            <td style={{ width: '62%', paddingLeft: '40px', verticalAlign: 'top' }}>
                              {/* Logo at the left end of the right section */}
                              <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                                <img src="/assets/honey-palace-logo.png" style={{ width: '120px', height: 'auto', display: 'inline-block' }} alt="Logo" />
                              </div>

                              {/* Invoice Title */}
                              <h1 style={{ fontSize: '42px', fontWeight: '900', margin: 0, color: '#111827', letterSpacing: '-1px', lineHeight: '1' }}>INVOICE</h1>
                              <p style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px', marginBottom: '25px', letterSpacing: '0.5px' }}>Document Payment Information</p>
                              
                              {/* Bank Details / Account Block */}
                              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', marginBottom: '20px', borderRadius: '6px' }}>
                                <tbody>
                                  <tr>
                                    <td style={{ padding: '12px 15px', borderRight: '1px solid #e5e7eb', width: '50%' }}>
                                      <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '3px' }}>MoMo Network:</div>
                                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#111827' }}>{settings?.momoNetwork || 'MTN Mobile Money'}</div>
                                    </td>
                                    <td style={{ padding: '12px 15px' }}>
                                      <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '3px' }}>Invoice No:</div>
                                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#111827' }}>#{viewingInvoice.invoiceNumber}</div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                              
                              {/* Payment Method details */}
                              <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.6', marginTop: '15px' }}>
                                <div style={{ fontWeight: 'bold', color: '#111827', marginBottom: '6px' }}>Payment Method:</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#4b5563', lineHeight: '1.6' }}>
                                  <tbody>
                                    <tr>
                                      <td style={{ fontWeight: 'bold', color: '#111827', width: '95px', paddingBottom: '3px', verticalAlign: 'top' }}>Account Name:</td>
                                      <td style={{ paddingBottom: '3px', verticalAlign: 'top' }}>{settings?.bankAccountName || settings?.companyName || 'The Honey Palace'}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ fontWeight: 'bold', color: '#111827', paddingBottom: '3px', verticalAlign: 'top' }}>Mobile Money:</td>
                                      <td style={{ paddingBottom: '3px', verticalAlign: 'top' }}>{settings?.momoNumber || '+233 54 883 4874'} ({settings?.momoNetwork || 'MTN MoMo'})</td>
                                    </tr>
                                    {settings?.bankAccountNo && settings.bankAccountNo !== '1234567890123' && (
                                      <>
                                        <tr>
                                          <td style={{ fontWeight: 'bold', color: '#111827', paddingBottom: '3px', verticalAlign: 'top' }}>Bank:</td>
                                          <td style={{ paddingBottom: '3px', verticalAlign: 'top' }}>{settings?.bankName || 'Bank'}{settings?.bankBranch ? ` (${settings.bankBranch})` : ''}</td>
                                        </tr>
                                        <tr>
                                          <td style={{ fontWeight: 'bold', color: '#111827', paddingBottom: '3px', verticalAlign: 'top' }}>Account No:</td>
                                          <td style={{ paddingBottom: '3px', verticalAlign: 'top' }}>{settings.bankAccountNo}</td>
                                        </tr>
                                      </>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      
                      {/* Item Table Section */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#ffa200', color: '#ffffff', textAlign: 'left', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}>
                            <th style={{ padding: '10px 15px', width: '50%' }}>Item Description</th>
                            <th style={{ padding: '10px 15px', textAlign: 'right', width: '15%' }}>Rate</th>
                            <th style={{ padding: '10px 15px', textAlign: 'center', width: '15%' }}>Unit</th>
                            <th style={{ padding: '10px 15px', textAlign: 'right', width: '20%' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(viewingInvoice.items || []).map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '12px 15px', fontWeight: '500', color: '#111827' }}>{item.name}</td>
                              <td style={{ padding: '12px 15px', textAlign: 'right', color: '#4b5563' }}>GHS {item.unitPrice.toFixed(2)}</td>
                              <td style={{ padding: '12px 15px', textAlign: 'center', color: '#4b5563', borderRight: '1px solid #e5e7eb' }}>{item.quantity}</td>
                              <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 'bold', color: '#111827' }}>GHS {item.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {/* Totals Summary Table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '35px', fontSize: '12px' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '55%' }}></td>
                            <td style={{ width: '45%' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: '2' }}>
                                <tbody>
                                  <tr>
                                    <td style={{ color: '#4b5563', fontWeight: 'bold', width: '50%' }}>Subtotal:</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#111827' }}>GHS {viewingInvoice.subtotal?.toFixed(2)}</td>
                                  </tr>
                                  {viewingInvoice.discount > 0 && (
                                    <tr>
                                      <td style={{ color: '#dc2626', fontWeight: 'bold' }}>Discount:</td>
                                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>-GHS {viewingInvoice.discount?.toFixed(2)}</td>
                                    </tr>
                                  )}
                                  {Array.isArray(viewingInvoice.taxes) && viewingInvoice.taxes.length > 0 ? (
                                    viewingInvoice.taxes.map((t, idx) => (
                                      <tr key={idx}>
                                        <td style={{ color: '#4b5563', fontWeight: 'bold' }}>{t.name || 'Tax'}{t.rate ? ` (${t.rate}%)` : ''}:</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#111827' }}>GHS {(t.amount || 0).toFixed(2)}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    viewingInvoice.vat > 0 && (
                                      <tr>
                                        <td style={{ color: '#4b5563', fontWeight: 'bold' }}>Taxes:</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#111827' }}>GHS {viewingInvoice.vat.toFixed(2)}</td>
                                      </tr>
                                    )
                                  )}
                                  <tr style={{ borderTop: '1px solid #d1d5db' }}>
                                    <td style={{ fontWeight: '900', fontSize: '14px', color: '#111827', paddingTop: '8px' }}>Total:</td>
                                    <td style={{ textAlign: 'right', fontWeight: '900', fontSize: '14px', color: '#111827', paddingTop: '8px' }}>GHS {viewingInvoice.total?.toFixed(2)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Footer Section */}
                    <div className="invoice-footer" style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #e5e7eb', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', color: '#6b7280' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '45%', verticalAlign: 'top', paddingRight: '30px', lineHeight: '1.6' }}>
                              {(!viewingInvoice.notes || viewingInvoice.notes === 'Draft Invoice Preview') 
                                ? 'Thank you for your business! All payments should be made within the due date.' 
                                : viewingInvoice.notes}
                            </td>
                            <td style={{ width: '55%', verticalAlign: 'top', textAlign: 'right', lineHeight: '1.8' }}>
                              <table style={{ display: 'inline-table', textAlign: 'left', borderCollapse: 'collapse', fontSize: '10px', color: '#4b5563' }}>
                                <tbody>
                                  {/* Phone */}
                                  <tr>
                                    <td style={{ paddingBottom: '8px', verticalAlign: 'middle' }}>
                                      <svg viewBox="0 0 24 24" width="11" height="11" stroke="#4b5563" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                      <span style={{ fontWeight: '500', color: '#111827' }}>{COMPANY.phone}</span>
                                    </td>
                                  </tr>
                                  {/* Email */}
                                  <tr>
                                    <td style={{ paddingBottom: '8px', verticalAlign: 'middle' }}>
                                      <svg viewBox="0 0 24 24" width="11" height="11" stroke="#4b5563" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                      <span style={{ fontWeight: '500', color: '#111827' }}>{COMPANY.email}</span>
                                    </td>
                                  </tr>
                                  {/* Website */}
                                  <tr>
                                    <td style={{ paddingBottom: '8px', verticalAlign: 'middle' }}>
                                      <svg viewBox="0 0 24 24" width="11" height="11" stroke="#4b5563" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                      <span style={{ fontWeight: '500', color: '#111827' }}>{COMPANY.website}</span>
                                    </td>
                                  </tr>
                                  {/* Address */}
                                  <tr>
                                    <td style={{ verticalAlign: 'top', paddingTop: '2px' }}>
                                      <svg viewBox="0 0 24 24" width="11" height="11" stroke="#4b5563" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px', marginTop: '2px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                      <span style={{ fontWeight: '500', color: '#111827', display: 'inline-block', verticalAlign: 'top', maxWidth: '280px', textAlign: 'left', lineHeight: '1.4' }}>{COMPANY.address}</span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
          );
        })()}

        {/* QUICK ADD CUSTOMER MODAL */}
        {mounted && showQuickAddCust && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-150 relative">
              <button 
                onClick={() => setShowQuickAddCust(false)} 
                className="absolute top-4 right-4 p-2 hover:bg-gray-50 rounded-xl transition text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#ffa200]/10 flex items-center justify-center text-xs font-bold text-[#ffa200] border border-[#ffa200]/20 flex-shrink-0">
                  <User className="w-5 h-5 text-[#ffa200]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-950 text-sm">Quick Add Customer</h3>
                  <p className="text-[10px] text-gray-400 font-medium">Create and select a new buyer profile</p>
                </div>
              </div>

              <form onSubmit={handleQuickAddCust} className="space-y-4 text-xs">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter customer full name"
                    value={quickCust.name}
                    onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-855 focus:outline-none focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter customer email"
                    value={quickCust.email}
                    onChange={(e) => setQuickCust({ ...quickCust, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-855 focus:outline-none focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="Enter customer phone number"
                    value={quickCust.phone}
                    onChange={(e) => setQuickCust({ ...quickCust, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-855 focus:outline-none focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">Company / Organization</label>
                  <input
                    type="text"
                    placeholder="Optional company name"
                    value={quickCust.company}
                    onChange={(e) => setQuickCust({ ...quickCust, company: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-855 focus:outline-none focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">Address</label>
                  <input
                    type="text"
                    placeholder="Optional address details"
                    value={quickCust.address}
                    onChange={(e) => setQuickCust({ ...quickCust, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-855 focus:outline-none focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200]"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCust(false)}
                    className="flex-1 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-center cursor-pointer transition border border-gray-200/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingCust}
                    className="flex-1 py-2.5 bg-[#ffa200] hover:bg-[#e59100] text-white font-bold rounded-xl text-center cursor-pointer transition shadow-sm flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {addingCust ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> : 'Save Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* EMAIL PREVIEW & CONFIRMATION MODAL */}
        {mounted && showEmailPreviewModal && emailPreviewInvoice && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-2xl max-w-3xl w-full animate-in fade-in zoom-in-95 duration-150 relative max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-[#ffa200]" /> Email Invoice Confirmation
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Preview the exact email layout before sending to client</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmSendEmail}
                    disabled={sending}
                    className="px-5 py-2 bg-[#ffa200] hover:bg-[#e69200] text-black font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" /> {sending ? 'Sending Email...' : 'Confirm & Send Email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowEmailPreviewModal(false); setEmailPreviewInvoice(null); }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Recipient & Reply-To Settings Banner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">To (Customer Email):</label>
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffa200] outline-none font-medium text-gray-900"
                    placeholder="customer@example.com"
                  />
                  {emailPreviewInvoice.customerPhone && (
                    <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none text-gray-700">
                      <input
                        type="checkbox"
                        checked={sendSmsAlso}
                        onChange={(e) => setSendSmsAlso(e.target.checked)}
                        className="rounded border-gray-300 text-[#ffa200] focus:ring-[#ffa200] w-4 h-4 cursor-pointer"
                      />
                      <span className="font-medium text-[11px]">Also send payment SMS to <strong className="text-gray-900 font-mono">{emailPreviewInvoice.customerPhone}</strong></span>
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Reply-To Email Address:</label>
                  <div className="px-3 py-2 bg-gray-100 text-gray-700 font-semibold border border-gray-200 rounded-xl flex items-center justify-between">
                    {/* Direct Reply Email Banner */}
                    <span className="truncate">purchases@thehoneypalaceafrica.com</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold ml-1 shrink-0">Direct Reply</span>
                  </div>
                </div>
              </div>

              {/* Interactive Email HTML Frame Preview */}
              <div className="flex-1 overflow-hidden border border-gray-200 rounded-2xl bg-gray-100 min-h-[380px] relative">
                <iframe
                  title="Invoice Email Preview"
                  srcDoc={buildInvoiceHTML(
                    { ...emailPreviewInvoice, customerEmail: emailRecipient },
                    emailPreviewInvoice.paymentUrl || '',
                    emailPreviewInvoice.status === 'paid',
                    emailPreviewInvoice.total || 0,
                    settings
                  )}
                  className="w-full h-full min-h-[380px] bg-white border-0"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  onClick={() => { setShowEmailPreviewModal(false); setEmailPreviewInvoice(null); }}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSendEmail}
                  disabled={sending}
                  className="px-6 py-2.5 bg-[#ffa200] hover:bg-[#e69200] text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" /> {sending ? 'Sending Email...' : 'Confirm & Send Email'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Packing List Modal */}
        {mounted && packingListInvoice && packingListData && typeof document !== 'undefined' && createPortal(
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setPackingListInvoice(null);
                setPackingListData(null);
              }
            }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-5 bg-black/75 backdrop-blur-sm overflow-hidden"
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden h-[92vh] max-h-[92vh] relative z-[10000]">
              {/* Modal Top Control Bar */}
              <div className="p-3 sm:p-4 sm:px-6 bg-[#000000] text-white flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#ffa200] flex items-center justify-center text-black shadow-xs">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                      Packing List / Dispatch Manifest
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffa200]/20 text-[#ffa200] font-mono border border-[#ffa200]/30">
                        {packingListData.packingListNo}
                      </span>
                    </h3>
                    <p className="text-[11px] text-gray-400">Invoice Ref: #{packingListData.invoiceNo} &bull; {packingListData.customerCompany || packingListData.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintPackingList}
                    className="px-3.5 py-1.5 bg-[#ffa200] hover:bg-[#e69200] text-black font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Packing List
                  </button>
                  <button
                    onClick={() => { setPackingListInvoice(null); setPackingListData(null); }}
                    className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Editable Transportation & Dispatch Drawer */}
              <div className="bg-[#fcfaf6] border-b border-amber-100/60 p-4 sm:px-6 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-[#ffa200]" /> Transport &amp; Delivery Information (Fill to print)
                  </span>
                  <span className="text-[10px] text-gray-500 italic">Values automatically format onto the printed sheet</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Mode of Transport</label>
                    <input
                      type="text"
                      value={packingListData.modeOfTransport}
                      onChange={(e) => setPackingListData({ ...packingListData, modeOfTransport: e.target.value })}
                      placeholder="Road Transport"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Vehicle Type</label>
                    <input
                      type="text"
                      value={packingListData.vehicleType}
                      onChange={(e) => setPackingListData({ ...packingListData, vehicleType: e.target.value })}
                      placeholder="Kia Cargo Truck"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Driver's Name</label>
                    <input
                      type="text"
                      value={packingListData.driverName}
                      onChange={(e) => setPackingListData({ ...packingListData, driverName: e.target.value })}
                      placeholder="Driver name"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Vehicle Reg. No.</label>
                    <input
                      type="text"
                      value={packingListData.vehicleRegNo}
                      onChange={(e) => setPackingListData({ ...packingListData, vehicleRegNo: e.target.value })}
                      placeholder="e.g. GE 4521-24"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Dispatch Date</label>
                    <input
                      type="text"
                      value={packingListData.dispatchDate}
                      onChange={(e) => setPackingListData({ ...packingListData, dispatchDate: e.target.value })}
                      placeholder="Date"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Expected Delivery</label>
                    <input
                      type="text"
                      value={packingListData.expectedDeliveryDate}
                      onChange={(e) => setPackingListData({ ...packingListData, expectedDeliveryDate: e.target.value })}
                      placeholder="Expected date"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                </div>
              </div>

              {/* Printable Document Preview Canvas */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2 sm:p-6 md:p-8 bg-gray-100 flex justify-center">
                <div 
                  ref={packingListPrintRef} 
                  className="bg-white border border-gray-200 rounded-xl shadow-md w-full max-w-[780px] min-w-[320px] sm:min-w-[620px] p-5 sm:p-8 md:p-10 text-gray-900 flex flex-col justify-between"
                  style={{ minHeight: '980px', boxSizing: 'border-box', fontFamily: "'Poppins', sans-serif" }}
                >
                  <div>
                    {/* Official Letterhead Header */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '22px' }}>
                      <tbody>
                        <tr>
                          {/* Top-Left Logo */}
                          <td style={{ verticalAlign: 'middle', width: '50%' }}>
                            <img 
                              src="/assets/honey-palace-logo.png" 
                              style={{ width: '135px', height: 'auto', display: 'block' }} 
                              alt="The Honey Palace" 
                            />
                          </td>
                          {/* Top-Right Accent Bar + Website */}
                          <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '50%' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <div style={{ width: '4px', height: '22px', backgroundColor: '#ffa200', borderRadius: '1px' }} />
                              <div style={{ width: '190px', height: '22px', backgroundColor: '#ffa200', borderRadius: '1px' }} />
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827', letterSpacing: '0.2px' }}>
                              www.thehoneypalaceafrica.com
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Document Title */}
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '2px', lineHeight: '1.2' }}>
                        PACKING LIST
                      </h1>
                      <div style={{ width: '45px', height: '3px', backgroundColor: '#ffa200', margin: '6px auto 0', borderRadius: '2px' }} />
                    </div>

                    {/* From / To & Meta Section */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '11px', lineHeight: '1.5' }}>
                      <tbody>
                        <tr>
                          {/* From */}
                          <td style={{ width: '38%', verticalAlign: 'top', paddingRight: '12px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                              From:
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '12px', color: '#111827' }}>{settings?.companyName || 'The Honey Palace Africa Ltd'}</div>
                            <div style={{ color: '#4b5563' }}>{settings?.companyAddress || 'Inside GreenField Estate, Amrahia'}</div>
                            <div style={{ color: '#4b5563' }}>{settings?.companyEmail || 'purchases@thehoneypalaceafrica.com'}</div>
                            <div style={{ color: '#4b5563' }}>{settings?.companyPhone || '+233 50 260 6270'}</div>
                          </td>

                          {/* To */}
                          <td style={{ width: '37%', verticalAlign: 'top', paddingRight: '12px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                              To:
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '13px', color: '#111827' }}>
                              {packingListData.customerCompany || packingListData.customerName || 'Valued Client'}
                            </div>
                            {packingListData.customerCompany && packingListData.customerName && (
                              <div style={{ color: '#4b5563', fontWeight: '500' }}>Attn: {packingListData.customerName}</div>
                            )}
                            {packingListData.customerAddress && (
                              <div style={{ color: '#4b5563' }}>{packingListData.customerAddress}</div>
                            )}
                            {packingListData.customerPhone && (
                              <div style={{ color: '#4b5563' }}>{packingListData.customerPhone}</div>
                            )}
                          </td>

                          {/* Meta info */}
                          <td style={{ width: '25%', verticalAlign: 'top', backgroundColor: '#fffbeb', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#78350f', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Date:</span>
                              <span style={{ fontWeight: '700', color: '#111827', fontSize: '11px' }}>{packingListData.date}</span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#78350f', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Packing List No.:</span>
                              <span style={{ fontWeight: '800', color: '#111827', fontFamily: 'monospace', fontSize: '11px' }}>{packingListData.packingListNo}</span>
                            </div>
                            <div>
                              <span style={{ color: '#78350f', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Invoice No.:</span>
                              <span style={{ fontWeight: '800', color: '#b45309', fontFamily: 'monospace', fontSize: '11px' }}>{packingListData.invoiceNo}</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Item Description Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#ffa200', color: '#000000', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px', fontWeight: '800' }}>
                          <th style={{ padding: '9px 12px', textAlign: 'left', borderRadius: '4px 0 0 4px', width: '38%' }}>Item Description</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', width: '32%' }}>Packaging</th>
                          <th style={{ padding: '9px 12px', textAlign: 'center', width: '15%' }}>Unit Size</th>
                          <th style={{ padding: '9px 12px', textAlign: 'right', borderRadius: '0 4px 4px 0', width: '15%' }}>Total Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(packingListData.items || []).map((item, idx) => (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#f9fafb' : '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '9px 12px', fontWeight: '700', color: '#111827' }}>{item.description}</td>
                            <td style={{ padding: '9px 12px', color: '#374151' }}>{item.packaging}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', color: '#4b5563', fontWeight: '600' }}>{item.unitSize}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '800', color: '#111827' }}>{item.quantity} {item.unitName || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Quantity Summary Card */}
                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
                      <div style={{ fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#92400e', marginBottom: '6px' }}>
                        Quantity Summary
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '11px' }}>
                        <div>
                          <span style={{ color: '#78350f', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Product:</span>
                          <span style={{ fontWeight: '700', color: '#111827' }}>{packingListData.items[0]?.description || 'Multifloral Honey'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#78350f', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Packaging:</span>
                          <span style={{ fontWeight: '700', color: '#111827' }}>{packingListData.items[0]?.packaging || '25-Litre Gallons'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#78350f', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Total Quantity:</span>
                          <span style={{ fontWeight: '800', color: '#111827' }}>
                            {(packingListData.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)} {packingListData.items[0]?.unitName || 'Gallons'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#78350f', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Total Volume / Weight:</span>
                          <span style={{ fontWeight: '800', color: '#b45309' }}>
                            {(packingListData.items || []).reduce((s, i) => {
                              const is25L = String(i.unitSize).toLowerCase().includes('25');
                              return is25L ? s + ((Number(i.quantity) || 0) * 25) : s;
                            }, 0) > 0 
                              ? `${((packingListData.items || []).reduce((s, i) => String(i.unitSize).toLowerCase().includes('25') ? s + ((Number(i.quantity) || 0) * 25) : s, 0)).toLocaleString()} Litres`
                              : `${(packingListData.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)} Units`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transportation Details */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px', backgroundColor: '#fafafa' }}>
                      <div style={{ fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#111827', marginBottom: '8px' }}>
                        Transportation Details
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', lineHeight: '1.7' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '22%', color: '#6b7280', fontWeight: 'bold' }}>Mode of Transport:</td>
                            <td style={{ width: '28%', fontWeight: '700', color: '#111827' }}>{packingListData.modeOfTransport || 'Road Transport'}</td>
                            <td style={{ width: '24%', color: '#6b7280', fontWeight: 'bold' }}>Dispatch Date:</td>
                            <td style={{ width: '26%', fontWeight: '700', color: '#111827' }}>{packingListData.dispatchDate || '_______________________'}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Vehicle Type:</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>{packingListData.vehicleType || 'Kia Cargo Truck'}</td>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Expected Delivery Date:</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>{packingListData.expectedDeliveryDate || '_______________________'}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Driver's Name:</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>{packingListData.driverName || '_______________________'}</td>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Vehicle Reg. No.:</td>
                            <td style={{ fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>{packingListData.vehicleRegNo || '_______________________'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Delivery Confirmation (Dual Sign-Off Block) */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '14px 16px', backgroundColor: '#ffffff', marginBottom: '20px' }}>
                      <div style={{ fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#111827', marginBottom: '10px' }}>
                        Delivery Confirmation
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <tbody>
                          <tr>
                            {/* Dispatched By */}
                            <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '20px', borderRight: '1px dashed #d1d5db' }}>
                              <div style={{ fontWeight: '800', color: '#111827', textTransform: 'uppercase', fontSize: '10px', marginBottom: '10px' }}>
                                Dispatched By (The Honey Palace)
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280', display: 'inline-block', width: '65px' }}>Name:</span>
                                <span style={{ fontWeight: '600', color: '#111827' }}>{packingListData.dispatchedByName || '__________________________________'}</span>
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280', display: 'inline-block', width: '65px' }}>Signature:</span>
                                <span>__________________________________</span>
                              </div>
                              <div>
                                <span style={{ color: '#6b7280', display: 'inline-block', width: '65px' }}>Date:</span>
                                <span style={{ fontWeight: '600', color: '#111827' }}>{packingListData.dispatchDate || '__________________________________'}</span>
                              </div>
                            </td>

                            {/* Received By */}
                            <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '20px' }}>
                              <div style={{ fontWeight: '800', color: '#111827', textTransform: 'uppercase', fontSize: '10px', marginBottom: '10px' }}>
                                Received By (Customer / Consignee)
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280', display: 'inline-block', width: '65px' }}>Name:</span>
                                <span style={{ fontWeight: '600', color: '#111827' }}>{packingListData.receivedByName || '__________________________________'}</span>
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280', display: 'inline-block', width: '65px' }}>Company:</span>
                                <span style={{ fontWeight: '600', color: '#111827' }}>{packingListData.receivedByCompany || '__________________________________'}</span>
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280', display: 'inline-block', width: '65px' }}>Signature:</span>
                                <span>__________________________________</span>
                              </div>
                              <div>
                                <span style={{ color: '#6b7280', display: 'inline-block', width: '65px' }}>Date:</span>
                                <span>__________________________________</span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Official Letterhead Footer Matching Company Design */}
                  <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
                      <tbody>
                        <tr>
                          {/* Phone */}
                          <td style={{ width: '31%', verticalAlign: 'middle' }}>
                            <table style={{ borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ffa200', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: '26px' }}>
                                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    </div>
                                  </td>
                                  <td style={{ verticalAlign: 'middle', fontSize: '10px', color: '#111827', fontWeight: '600', lineHeight: '1.35' }}>
                                    <div>{settings?.companyPhone || '+233 50 260 6270'}</div>
                                    {settings?.momoNumber && settings.momoNumber !== settings.companyPhone && (
                                      <div>{settings.momoNumber}</div>
                                    )}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>

                          {/* Email */}
                          <td style={{ width: '38%', verticalAlign: 'middle' }}>
                            <table style={{ borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ffa200', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: '26px' }}>
                                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    </div>
                                  </td>
                                  <td style={{ verticalAlign: 'middle', fontSize: '10px', color: '#111827', fontWeight: '600', lineHeight: '1.35' }}>
                                    <div>{settings?.companyEmail || 'purchases@thehoneypalaceafrica.com'}</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>

                          {/* Address */}
                          <td style={{ width: '31%', verticalAlign: 'middle' }}>
                            <table style={{ borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ffa200', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: '26px' }}>
                                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    </div>
                                  </td>
                                  <td style={{ verticalAlign: 'middle', fontSize: '10px', color: '#111827', fontWeight: '600', lineHeight: '1.35' }}>
                                    <div>{settings?.companyAddress || 'Inside GreenField Estate, Amrahia - Accra, Ghana'}</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Full-width Solid Bottom Accent Bar */}
                    <div style={{ height: '7px', backgroundColor: '#ffa200', width: '100%', borderRadius: '1px' }} />
                  </div>

                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Waybill / Delivery Note Modal */}
        {mounted && waybillInvoice && waybillData && typeof document !== 'undefined' && createPortal(
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setWaybillInvoice(null);
                setWaybillData(null);
              }
            }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-5 bg-black/75 backdrop-blur-sm overflow-hidden"
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden h-[92vh] max-h-[92vh] relative z-[10000]">
              {/* Modal Top Control Bar */}
              <div className="p-3 sm:p-4 sm:px-6 bg-[#000000] text-white flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#ffa200] flex items-center justify-center text-black shadow-xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                      Waybill / Delivery Note
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffa200]/20 text-[#ffa200] font-mono border border-[#ffa200]/30">
                        {waybillData.waybillNo}
                      </span>
                    </h3>
                    <p className="text-[11px] text-gray-400">Invoice: #{waybillData.invoiceNo} &bull; Packing List: #{waybillData.packingListNo} &bull; {waybillData.receiverCompany || waybillData.receiverName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintWaybill}
                    className="px-3.5 py-1.5 bg-[#ffa200] hover:bg-[#e69200] text-black font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Waybill
                  </button>
                  <button
                    onClick={() => { setWaybillInvoice(null); setWaybillData(null); }}
                    className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Editable Transportation & Dispatch Drawer */}
              <div className="bg-[#fcfaf6] border-b border-amber-100/60 p-4 sm:px-6 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-[#ffa200]" /> Transport &amp; Delivery Details (Fill to update waybill)
                  </span>
                  <span className="text-[10px] text-gray-500 italic">Values automatically format onto the printed sheet</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Mode of Transport</label>
                    <input
                      type="text"
                      value={waybillData.modeOfTransport}
                      onChange={(e) => setWaybillData({ ...waybillData, modeOfTransport: e.target.value })}
                      placeholder="Road"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Vehicle Type</label>
                    <input
                      type="text"
                      value={waybillData.vehicleType}
                      onChange={(e) => setWaybillData({ ...waybillData, vehicleType: e.target.value })}
                      placeholder="Kia Cargo Truck"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Vehicle Reg. No.</label>
                    <input
                      type="text"
                      value={waybillData.vehicleRegNo}
                      onChange={(e) => setWaybillData({ ...waybillData, vehicleRegNo: e.target.value })}
                      placeholder="e.g. GE 4521-24"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Driver's Name</label>
                    <input
                      type="text"
                      value={waybillData.driverName}
                      onChange={(e) => setWaybillData({ ...waybillData, driverName: e.target.value })}
                      placeholder="Driver's name"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Driver's Telephone</label>
                    <input
                      type="text"
                      value={waybillData.driverPhone}
                      onChange={(e) => setWaybillData({ ...waybillData, driverPhone: e.target.value })}
                      placeholder="Driver's phone"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Departure Date</label>
                    <input
                      type="text"
                      value={waybillData.departureDate}
                      onChange={(e) => setWaybillData({ ...waybillData, departureDate: e.target.value })}
                      placeholder="Departure date"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Expected Delivery</label>
                    <input
                      type="text"
                      value={waybillData.expectedDeliveryDate}
                      onChange={(e) => setWaybillData({ ...waybillData, expectedDeliveryDate: e.target.value })}
                      placeholder="Expected date"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#ffa200]"
                    />
                  </div>
                </div>
              </div>

              {/* Printable Document Preview Canvas */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2 sm:p-6 md:p-8 bg-gray-100 flex justify-center">
                <div 
                  ref={waybillPrintRef} 
                  className="bg-white border border-gray-200 rounded-xl shadow-md w-full max-w-[780px] min-w-[320px] sm:min-w-[620px] p-5 sm:p-8 md:p-10 text-gray-900 flex flex-col justify-between"
                  style={{ minHeight: '980px', boxSizing: 'border-box', fontFamily: "'Poppins', sans-serif" }}
                >
                  <div>
                    {/* Official Letterhead Header */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                      <tbody>
                        <tr>
                          {/* Top-Left Logo */}
                          <td style={{ verticalAlign: 'middle', width: '50%' }}>
                            <img 
                              src="/assets/honey-palace-logo.png" 
                              style={{ width: '135px', height: 'auto', display: 'block' }} 
                              alt="The Honey Palace" 
                            />
                          </td>
                          {/* Top-Right Accent Bar + Website */}
                          <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '50%' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <div style={{ width: '4px', height: '22px', backgroundColor: '#ffa200', borderRadius: '1px' }} />
                              <div style={{ width: '190px', height: '22px', backgroundColor: '#ffa200', borderRadius: '1px' }} />
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827', letterSpacing: '0.2px' }}>
                              www.thehoneypalaceafrica.com
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Document Title */}
                    <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                      <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '2px', lineHeight: '1.2' }}>
                        WAYBILL / DELIVERY NOTE
                      </h1>
                      <div style={{ width: '45px', height: '3px', backgroundColor: '#ffa200', margin: '5px auto 0', borderRadius: '2px' }} />
                    </div>

                    {/* Company Information: Sender / Receiver & Meta Section */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11px', lineHeight: '1.45' }}>
                      <tbody>
                        <tr>
                          {/* Sender */}
                          <td style={{ width: '38%', verticalAlign: 'top', paddingRight: '12px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                              Sender:
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '12px', color: '#111827' }}>{waybillData.senderName}</div>
                            <div style={{ color: '#4b5563' }}>{waybillData.senderAddress}</div>
                            <div style={{ color: '#4b5563' }}>{waybillData.senderEmail}</div>
                            <div style={{ color: '#4b5563' }}>{waybillData.senderPhone}</div>
                          </td>

                          {/* Receiver */}
                          <td style={{ width: '37%', verticalAlign: 'top', paddingRight: '12px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                              Receiver:
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '13px', color: '#111827' }}>
                              {waybillData.receiverCompany || waybillData.receiverName || 'CSIR - FORIG'}
                            </div>
                            {waybillData.receiverCompany && waybillData.receiverName && (
                              <div style={{ color: '#4b5563', fontWeight: '500' }}>Attn: {waybillData.receiverName}</div>
                            )}
                            {waybillData.receiverAddress && (
                              <div style={{ color: '#4b5563' }}>{waybillData.receiverAddress}</div>
                            )}
                            {waybillData.receiverPhone && (
                              <div style={{ color: '#4b5563' }}>{waybillData.receiverPhone}</div>
                            )}
                          </td>

                          {/* Meta Box */}
                          <td style={{ width: '25%', verticalAlign: 'top', backgroundColor: '#fffbeb', padding: '9px 11px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                            <div style={{ marginBottom: '5px' }}>
                              <span style={{ color: '#78350f', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Date:</span>
                              <span style={{ fontWeight: '700', color: '#111827', fontSize: '11px' }}>{waybillData.date}</span>
                            </div>
                            <div style={{ marginBottom: '5px' }}>
                              <span style={{ color: '#78350f', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Waybill No.:</span>
                              <span style={{ fontWeight: '800', color: '#b45309', fontFamily: 'monospace', fontSize: '11px' }}>{waybillData.waybillNo}</span>
                            </div>
                            <div style={{ marginBottom: '5px' }}>
                              <span style={{ color: '#78350f', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Packing List No.:</span>
                              <span style={{ fontWeight: '800', color: '#111827', fontFamily: 'monospace', fontSize: '10.5px' }}>{waybillData.packingListNo}</span>
                            </div>
                            <div>
                              <span style={{ color: '#78350f', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Invoice No.:</span>
                              <span style={{ fontWeight: '800', color: '#111827', fontFamily: 'monospace', fontSize: '10.5px' }}>{waybillData.invoiceNo}</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Transport Details Section */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', backgroundColor: '#fafafa' }}>
                      <div style={{ fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#111827', marginBottom: '6px' }}>
                        Transport Details
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', lineHeight: '1.6' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '22%', color: '#6b7280', fontWeight: 'bold' }}>Mode of Transport:</td>
                            <td style={{ width: '28%', fontWeight: '700', color: '#111827' }}>{waybillData.modeOfTransport || 'Road'}</td>
                            <td style={{ width: '24%', color: '#6b7280', fontWeight: 'bold' }}>Departure Date:</td>
                            <td style={{ width: '26%', fontWeight: '700', color: '#111827' }}>{waybillData.departureDate || '_______________________'}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Vehicle Type:</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>{waybillData.vehicleType || 'Kia Cargo Truck'}</td>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Expected Delivery Date:</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>{waybillData.expectedDeliveryDate || '_______________________'}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Vehicle Registration No.:</td>
                            <td style={{ fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>{waybillData.vehicleRegNo || '_______________________'}</td>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Driver's Telephone:</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>{waybillData.driverPhone || '_______________________'}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#6b7280', fontWeight: 'bold' }}>Driver's Name:</td>
                            <td colSpan={3} style={{ fontWeight: '700', color: '#111827' }}>{waybillData.driverName || '_______________________'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Goods Description Table */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#111827', marginBottom: '6px' }}>
                        Goods Description
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#ffa200', color: '#000000', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px', fontWeight: '800' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'center', borderRadius: '4px 0 0 4px', width: '8%' }}>Item</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '34%' }}>Product</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '30%' }}>Packaging</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '14%' }}>Unit Size</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', borderRadius: '0 4px 4px 0', width: '14%' }}>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(waybillData.items || []).map((item, idx) => (
                            <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#f9fafb' : '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#6b7280' }}>{item.itemNo || idx + 1}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700', color: '#111827' }}>{item.description}</td>
                              <td style={{ padding: '8px 10px', color: '#374151' }}>{item.packaging}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#4b5563', fontWeight: '600' }}>{item.unitSize}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#111827' }}>{item.quantity} {item.unitName || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Shipment Summary Card */}
                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
                      <div style={{ fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#92400e', marginBottom: '6px' }}>
                        Shipment Summary
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '11px' }}>
                        <div>
                          <span style={{ color: '#78350f', display: 'block', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Product:</span>
                          <span style={{ fontWeight: '700', color: '#111827' }}>{waybillData.items[0]?.description || 'Multifloral Honey'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#78350f', display: 'block', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Packaging:</span>
                          <span style={{ fontWeight: '700', color: '#111827' }}>{waybillData.items[0]?.packaging || '25-Litre Yellow Food-grade Plastic Gallons'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#78350f', display: 'block', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Quantity:</span>
                          <span style={{ fontWeight: '800', color: '#111827' }}>
                            {(waybillData.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)} {waybillData.items[0]?.unitName || 'Gallons'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#78350f', display: 'block', fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Volume:</span>
                          <span style={{ fontWeight: '800', color: '#b45309' }}>
                            {((waybillData.items || []).reduce((s, i) => {
                              const is25L = String(i.unitSize).toLowerCase().includes('25');
                              return is25L ? s + ((Number(i.quantity) || 0) * 25) : s;
                            }, 0) > 0)
                              ? `${((waybillData.items || []).reduce((s, i) => String(i.unitSize).toLowerCase().includes('25') ? s + ((Number(i.quantity) || 0) * 25) : s, 0)).toLocaleString()} Litres`
                              : `${(waybillData.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)} Units`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Instructions */}
                    <div style={{ border: '1px solid #fed7aa', backgroundColor: '#fffbf5', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
                      <div style={{ fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9a3412', marginBottom: '4px' }}>
                        Delivery Instructions
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '10.5px', color: '#374151', lineHeight: '1.45' }}>
                        <li>Handle with care.</li>
                        <li>Keep containers upright during transportation.</li>
                        <li>Protect from excessive heat and direct sunlight.</li>
                        <li style={{ fontWeight: '600', color: '#b45309' }}>Verify quantity upon delivery before signing.</li>
                      </ul>
                    </div>

                    {/* Declaration */}
                    <div style={{ borderLeft: '3px solid #ffa200', backgroundColor: '#f9fafb', padding: '7px 12px', borderRadius: '0 4px 4px 0', marginBottom: '14px' }}>
                      <div style={{ fontWeight: '800', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', marginBottom: '2px' }}>
                        Declaration
                      </div>
                      <div style={{ fontSize: '10.5px', fontWeight: '600', color: '#111827', fontStyle: 'italic' }}>
                        "I certify that the goods described above have been dispatched in good condition."
                      </div>
                    </div>

                    {/* Sign-Off & Acknowledgement (Dispatched By, Received By, Driver's Acknowledgement) */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', marginBottom: '16px' }}>
                      <tbody>
                        <tr>
                          {/* Dispatched By */}
                          <td style={{ width: '33%', verticalAlign: 'top', paddingRight: '12px', borderRight: '1px dashed #d1d5db' }}>
                            <div style={{ fontWeight: '800', color: '#111827', textTransform: 'uppercase', fontSize: '9.5px', marginBottom: '8px' }}>
                              Dispatched By
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '55px', fontSize: '10px' }}>Name:</span>
                              <span style={{ fontWeight: '600', color: '#111827' }}>{waybillData.dispatchedByName || '____________________'}</span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '55px', fontSize: '10px' }}>Position:</span>
                              <span style={{ fontWeight: '600', color: '#111827' }}>{waybillData.dispatchedByPosition || '____________________'}</span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '55px', fontSize: '10px' }}>Signature:</span>
                              <span>____________________</span>
                            </div>
                            <div>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '55px', fontSize: '10px' }}>Date:</span>
                              <span style={{ fontWeight: '600', color: '#111827' }}>{waybillData.departureDate || '____________________'}</span>
                            </div>
                          </td>

                          {/* Received By */}
                          <td style={{ width: '34%', verticalAlign: 'top', paddingLeft: '12px', paddingRight: '12px', borderRight: '1px dashed #d1d5db' }}>
                            <div style={{ fontWeight: '800', color: '#111827', textTransform: 'uppercase', fontSize: '9.5px', marginBottom: '8px' }}>
                              Received By
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '58px', fontSize: '10px' }}>Name:</span>
                              <span style={{ fontWeight: '600', color: '#111827' }}>{waybillData.receivedByName || '____________________'}</span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '58px', fontSize: '10px' }}>Company:</span>
                              <span style={{ fontWeight: '600', color: '#111827' }}>{waybillData.receivedByCompany || '____________________'}</span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '58px', fontSize: '10px' }}>Signature:</span>
                              <span>____________________</span>
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '58px', fontSize: '10px' }}>Date:</span>
                              <span>____________________</span>
                            </div>
                            <div style={{ border: '1px dashed #9ca3af', borderRadius: '4px', padding: '6px', textAlign: 'center', backgroundColor: '#fafafa' }}>
                              <span style={{ fontSize: '8.5px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>Official Stamp</span>
                            </div>
                          </td>

                          {/* Driver's Acknowledgement */}
                          <td style={{ width: '33%', verticalAlign: 'top', paddingLeft: '12px' }}>
                            <div style={{ fontWeight: '800', color: '#111827', textTransform: 'uppercase', fontSize: '9.5px', marginBottom: '6px' }}>
                              Driver's Acknowledgement
                            </div>
                            <div style={{ fontSize: '9.5px', color: '#4b5563', fontStyle: 'italic', marginBottom: '8px', lineHeight: '1.3' }}>
                              "I acknowledge receipt of the above goods for transportation to the stated destination."
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '55px', fontSize: '10px' }}>Name:</span>
                              <span style={{ fontWeight: '600', color: '#111827' }}>{waybillData.driverName || '____________________'}</span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '55px', fontSize: '10px' }}>Signature:</span>
                              <span>____________________</span>
                            </div>
                            <div>
                              <span style={{ color: '#6b7280', display: 'inline-block', width: '55px', fontSize: '10px' }}>Date:</span>
                              <span>____________________</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Official Letterhead Footer Matching Company Design */}
                  <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
                      <tbody>
                        <tr>
                          {/* Phone */}
                          <td style={{ width: '31%', verticalAlign: 'middle' }}>
                            <table style={{ borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ffa200', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: '26px' }}>
                                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    </div>
                                  </td>
                                  <td style={{ verticalAlign: 'middle', fontSize: '10px', color: '#111827', fontWeight: '600', lineHeight: '1.35' }}>
                                    <div>{settings?.companyPhone || '+233 50 260 6270'}</div>
                                    {settings?.momoNumber && settings.momoNumber !== settings.companyPhone && (
                                      <div>{settings.momoNumber}</div>
                                    )}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>

                          {/* Email */}
                          <td style={{ width: '38%', verticalAlign: 'middle' }}>
                            <table style={{ borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ffa200', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: '26px' }}>
                                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    </div>
                                  </td>
                                  <td style={{ verticalAlign: 'middle', fontSize: '10px', color: '#111827', fontWeight: '600', lineHeight: '1.35' }}>
                                    <div>{settings?.companyEmail || 'thehoneypalace2022@gmail.com'}</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>

                          {/* Address */}
                          <td style={{ width: '31%', verticalAlign: 'middle' }}>
                            <table style={{ borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ffa200', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: '26px' }}>
                                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    </div>
                                  </td>
                                  <td style={{ verticalAlign: 'middle', fontSize: '10px', color: '#111827', fontWeight: '600', lineHeight: '1.35' }}>
                                    <div>{settings?.companyAddress || 'Amrahia - Inside GreenField Estate, Accra'}</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Full-width Solid Bottom Accent Bar */}
                    <div style={{ height: '7px', backgroundColor: '#ffa200', width: '100%', borderRadius: '1px' }} />
                  </div>

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
