'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { 
  Users, Plus, X, Phone, Mail, MapPin, Trash2, Edit3, Save,
  AlertCircle, Tag, Search, Upload, MoreVertical, MessageSquare
} from 'lucide-react';

export default function CustomersPage() {
  const router = useRouter();
  const { showConfirm } = useUI();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [parsedCSV, setParsedCSV] = useState([]);

  // New Customer Form Data
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    customer_type: 'Retail',
  });

  // Edit Customer Form Data
  const [editCustomer, setEditCustomer] = useState({});

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id });
        });
        setCustomers(list);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore loading error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) return;

    const docId = `cust-${Date.now().toString(36)}`;
    const payload = {
      name: newCustomer.name.trim(),
      email: newCustomer.email.trim(),
      phone: newCustomer.phone.trim(),
      address: newCustomer.address.trim(),
      customer_type: newCustomer.customer_type,
      created_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'customers', docId), payload);
      setShowAddForm(false);
      setNewCustomer({ name: '', email: '', phone: '', address: '', customer_type: 'Retail' });
      toast.success("Customer added successfully!");
    } catch (err) {
      console.error("Error creating customer:", err);
      toast.error("Failed to save customer.");
    }
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    const payload = {
      name: (editCustomer.name || '').trim(),
      email: (editCustomer.email || '').trim(),
      phone: (editCustomer.phone || '').trim(),
      address: (editCustomer.address || '').trim(),
      customer_type: editCustomer.customer_type || 'Retail',
    };

    try {
      await updateDoc(doc(db, 'customers', id), payload);
      setEditingId(null);
      toast.success("Customer updated successfully!");
    } catch (err) {
      console.error("Error updating customer:", err);
      toast.error("Failed to update customer.");
    }
  };

  const handleDeleteCustomer = async (id) => {
    const isConfirmed = await showConfirm({
      title: 'Delete Customer',
      message: 'Are you sure you want to delete this customer record?',
      confirmText: 'Delete',
      isDestructive: true
    });
    if (!isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'customers', id));
      toast.success("Customer deleted successfully!");
    } catch (err) {
      console.error("Error deleting customer:", err);
      toast.error("Failed to delete customer.");
    }
  };

  // CSV Upload Logic
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length <= 1) {
        toast.error("CSV file is empty or invalid.");
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
      const list = [];
      
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/["']/g, ''));
        if (cols.length < headers.length) continue;
        
        const rowData = {};
        headers.forEach((h, idx) => {
          rowData[h] = cols[idx] || '';
        });
        
        // Map common CSV columns to our schema
        list.push({
          name: rowData.name || rowData.fullname || rowData.customer || `Customer ${i}`,
          email: rowData.email || '',
          phone: rowData.phone || rowData.contact || '',
          address: rowData.address || rowData.location || '',
          customer_type: rowData.type?.toLowerCase().includes('wholesale') ? 'Wholesale' : 'Retail',
        });
      }

      setParsedCSV(list);
    };
    reader.readAsText(file);
  };

  const confirmCSVImport = async () => {
    if (parsedCSV.length === 0) return;
    
    const toastId = toast.loading(`Importing ${parsedCSV.length} customers...`);
    try {
      const batch = writeBatch(db);
      parsedCSV.forEach((cust, index) => {
        const docRef = doc(collection(db, 'customers'));
        batch.set(docRef, {
          ...cust,
          created_at: new Date().toISOString()
        });
      });
      
      await batch.commit();
      toast.success(`Successfully imported ${parsedCSV.length} customers!`, { id: toastId });
      setShowUploadModal(false);
      setParsedCSV([]);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Failed to import customers.", { id: toastId });
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <AuthShield requiredPermission="customer.view">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        
        {/* Actions Area */}
        <div className="flex justify-end gap-3 mb-6">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-semibold rounded-xl transition-all duration-300 shadow-sm text-sm"
          >
            <Upload className="w-4 h-4" />
            Bulk Import (CSV)
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search customers by name, email, or phone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200]"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="px-4 py-2 bg-orange-50 text-[#d07b00] rounded-xl text-xs font-bold border border-[#ffa200]/20 flex items-center gap-2">
              <Users className="w-4 h-4" /> Total: {customers.length}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Segment</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400">Loading customers...</td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isEditing = editingId === cust.id;

                    if (isEditing) {
                      return (
                        <tr key={cust.id} className="bg-orange-50/30">
                          <td colSpan="5" className="px-6 py-4">
                            <form onSubmit={(e) => handleEditSubmit(e, cust.id)} className="grid grid-cols-5 gap-4 items-center">
                              <input
                                type="text"
                                required
                                className="col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={editCustomer.name}
                                onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                              />
                              <div className="col-span-1 flex flex-col gap-2">
                                <input
                                  type="tel"
                                  placeholder="Phone"
                                  className="px-3 py-1 border border-gray-300 rounded-md text-xs"
                                  value={editCustomer.phone}
                                  onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                                />
                                <input
                                  type="email"
                                  placeholder="Email"
                                  className="px-3 py-1 border border-gray-300 rounded-md text-xs"
                                  value={editCustomer.email}
                                  onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
                                />
                              </div>
                              <select
                                className="col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={editCustomer.customer_type}
                                onChange={(e) => setEditCustomer({ ...editCustomer, customer_type: e.target.value })}
                              >
                                <option value="Retail">Retail</option>
                                <option value="Wholesale">Wholesale</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Address"
                                className="col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={editCustomer.address}
                                onChange={(e) => setEditCustomer({ ...editCustomer, address: e.target.value })}
                              />
                              <div className="col-span-1 flex gap-2 justify-end">
                                <button type="button" onClick={() => setEditingId(null)} className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-xs font-bold transition">Cancel</button>
                                <button type="submit" className="px-3 py-2 bg-black text-white rounded-lg text-xs font-bold transition">Save</button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={cust.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
                              {cust.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{cust.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono tracking-wider">ID: {cust.id.split('-')[1]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1 text-xs">
                            {cust.phone && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Phone className="w-3 h-3 text-gray-400" /> {cust.phone}
                              </div>
                            )}
                            {cust.email && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Mail className="w-3 h-3 text-gray-400" /> {cust.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                            cust.customer_type === 'Wholesale'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-[#ffa200]/10 text-[#d07b00]'
                          }`}>
                            <Tag className="w-3 h-3" /> {cust.customer_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {cust.address ? (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 max-w-[200px] truncate" title={cust.address}>
                              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" /> <span className="truncate">{cust.address}</span>
                            </div>
                          ) : <span className="text-gray-300 text-xs">-</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => router.push(`/communications?prefill=${cust.email}&channel=email`)}
                              className="p-1.5 text-gray-400 hover:text-[#ffa200] hover:bg-orange-50 rounded-lg transition-colors" title="Send Email"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => { setEditingId(cust.id); setEditCustomer({ ...cust }); }}
                              className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors" title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCustomer(cust.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Customer Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-black">Register New Customer</h3>
                <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCustomer} className="space-y-4 text-sm">
                <div>
                  <label className="text-xs text-gray-500 font-bold block mb-1">Customer Name *</label>
                  <input
                    type="text" required placeholder="e.g. Alice Mensah"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] focus:border-transparent outline-none"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-bold block mb-1">Phone</label>
                    <input
                      type="tel" placeholder="+233..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] focus:border-transparent outline-none"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-bold block mb-1">Email</label>
                    <input
                      type="email" placeholder="alice@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] focus:border-transparent outline-none"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold block mb-1">Customer Segment</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] outline-none bg-white"
                    value={newCustomer.customer_type}
                    onChange={(e) => setNewCustomer({ ...newCustomer, customer_type: e.target.value })}
                  >
                    <option value="Retail">Retail Client</option>
                    <option value="Wholesale">Wholesale Distributor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold block mb-1">Address / Location</label>
                  <input
                    type="text" placeholder="e.g. Spintex Road, Accra"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] focus:border-transparent outline-none"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 bg-black hover:bg-gray-800 text-white font-bold rounded-xl transition">Save Customer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CSV Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <h3 className="text-lg font-bold text-black flex items-center gap-2"><Upload className="w-5 h-5 text-[#ffa200]" /> Bulk Import CSV</h3>
                <button onClick={() => { setShowUploadModal(false); setParsedCSV([]); }} className="text-gray-400 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center space-y-3 relative">
                <Upload className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-sm font-bold text-gray-800">
                  {parsedCSV.length > 0 ? `${parsedCSV.length} customers ready to import` : 'Click or drag a CSV file here'}
                </p>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Your CSV should ideally have columns like Name, Email, Phone, Address, and Type.
                </p>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {parsedCSV.length > 0 && (
                <div className="bg-orange-50 border border-[#ffa200]/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Preview (First 3):</p>
                  {parsedCSV.slice(0, 3).map((c, i) => (
                    <div key={i} className="text-xs text-gray-700 truncate py-0.5 border-b border-orange-200/50 last:border-0">
                      <strong>{c.name}</strong> • {c.email || c.phone} • {c.customer_type}
                    </div>
                  ))}
                  {parsedCSV.length > 3 && <p className="text-xs text-gray-500 mt-2 italic text-center">+ {parsedCSV.length - 3} more</p>}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => { setShowUploadModal(false); setParsedCSV([]); }} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition">Cancel</button>
                <button 
                  onClick={confirmCSVImport}
                  disabled={parsedCSV.length === 0}
                  className="flex-1 py-2.5 bg-[#ffa200] hover:bg-[#d07b00] disabled:bg-gray-200 disabled:text-gray-400 text-black font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Import {parsedCSV.length > 0 ? parsedCSV.length : ''}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthShield>
  );
}
