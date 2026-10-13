'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { hasPermission } from '@/utils/permissions';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { 
  Users, 
  Plus, 
  Trash2, 
  X, 
  Mail, 
  Phone, 
  Tag,
  AlertCircle
} from 'lucide-react';

const MOCK_SUPPLIERS = [
  { id: '1', name: 'Nkoranza Beekeepers Co-op', contactName: 'Emmanuel Mensah', phone: '+233 244 887 990', email: 'nkoranzabees@gmail.com', suppliedItems: 'Raw Wildflower Nectar' },
  { id: '2', name: 'Volta Glass Containers Ltd', contactName: 'Grace Tsikata', phone: '+233 208 112 334', email: 'info@voltaglass.com', suppliedItems: '250ml & 500ml Premium Glass Jars' },
  { id: '3', name: 'Accra Prints & Package Ltd', contactName: 'Kojo Asante', phone: '+233 553 444 555', email: 'orders@accraprints.com', suppliedItems: 'Product Jar Labels, Custom Gift Boxes' },
];

export default function SuppliersPage() {
  const { roles } = useAuth();
  const { showConfirm } = useUI();
  const [suppliers, setSuppliers] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    suppliedItems: '',
  });

  useEffect(() => {
    if (!db) {
      setSuppliers(MOCK_SUPPLIERS);
      setIsMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      collection(db, 'suppliers'),
      (snapshot) => {
        if (snapshot.empty) {
          setSuppliers([]);
          setIsMock(false);
        } else {
          const list = [];
          snapshot.forEach((doc) => {
            list.push({ ...doc.data(), id: doc.id });
          });
          setSuppliers(list);
          setIsMock(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore loading error, using mock suppliers:", err);
        setSuppliers(MOCK_SUPPLIERS);
        setIsMock(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;

    const supplierId = `sup-${Date.now().toString(36)}`;
    const payload = {
      name: newSupplier.name,
      contactName: newSupplier.contactName,
      phone: newSupplier.phone,
      email: newSupplier.email,
      suppliedItems: newSupplier.suppliedItems,
    };

    if (isMock) {
      setSuppliers((prev) => [...prev, { id: supplierId, ...payload }]);
      setShowAddForm(false);
      setNewSupplier({ name: '', contactName: '', phone: '', email: '', suppliedItems: '' });
      return;
    }

    try {
      await setDoc(doc(db, 'suppliers', supplierId), payload);
      setShowAddForm(false);
      setNewSupplier({ name: '', contactName: '', phone: '', email: '', suppliedItems: '' });
      toast.success("Supplier added successfully!");
    } catch (err) {
      console.error("Error creating supplier:", err);
      toast.error("Failed to add supplier to database.");
    }
  };

  const handleDeleteSupplier = async (id) => {
    const isConfirmed = await showConfirm({
      title: 'Delete Supplier',
      message: 'Are you sure you want to delete this supplier?',
      confirmText: 'Delete',
      isDestructive: true
    });
    
    if (!isConfirmed) return;

    if (isMock) {
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Supplier deleted (Sandbox Mode)!");
      return;
    }

    try {
      await deleteDoc(doc(db, 'suppliers', id));
      toast.success("Supplier deleted successfully!");
    } catch (err) {
      console.error("Error deleting supplier:", err);
      toast.error("Failed to delete supplier.");
    }
  };

  return (
    <AuthShield requiredPermission="supplier.view">
    <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
      {/* Actions Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-light text-bg-dark font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-gold/20 text-sm"
        >
          <Plus className="w-5 h-5" />
          Add Supplier
        </button>
      </div>

      {/* Add Supplier Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-gold/15 p-6 rounded-2xl w-full max-w-md space-y-6">
            <div className="flex justify-between items-center border-b border-gold/10 pb-4">
              <h3 className="text-lg font-display font-semibold text-white">Add New Supplier</h3>
              <button onClick={() => setShowAddForm(false)} className="text-text-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted font-medium">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Volta Glass Containers"
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted font-medium">Primary Contact Person</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grace Tsikata"
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white"
                  value={newSupplier.contactName}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-muted font-medium">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="+233 244 000 000"
                    className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-muted font-medium">Contact Email</label>
                  <input
                    type="email"
                    required
                    placeholder="grace@example.com"
                    className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted font-medium">Supplied Goods / Services</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Glass Jars, Labels, raw honey..."
                  className="bg-bg-dark border border-gold/10 focus:border-gold px-3 py-2 rounded-lg text-white"
                  value={newSupplier.suppliedItems}
                  onChange={(e) => setNewSupplier({ ...newSupplier, suppliedItems: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 border border-gold/10 rounded-xl text-text-muted hover:text-white transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gold hover:bg-gold-light text-bg-dark font-semibold rounded-xl transition-all duration-300"
                >
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((supplier) => (
          <div 
            key={supplier.id}
            className="bg-bg-card border border-gold/10 hover:border-gold/20 rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-gold/5 transition-all duration-300"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gold/10 pb-3">
                <div>
                  <h3 className="font-semibold text-white text-base leading-snug">{supplier.name}</h3>
                  <span className="text-xs text-gold font-medium mt-1 inline-block">{supplier.contactName}</span>
                </div>
                <button
                  onClick={() => handleDeleteSupplier(supplier.id)}
                  className="text-text-muted hover:text-gold p-1 border border-transparent hover:border-gold/20 rounded hover:bg-gold/10 transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Specs */}
              <div className="space-y-2 text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gold/60" />
                  <span>{supplier.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gold/60" />
                  <span>{supplier.email}</span>
                </div>
              </div>
            </div>

            {/* Supplied Items tag */}
            <div className="pt-3 border-t border-gold/5 flex items-start gap-2">
              <Tag className="w-4 h-4 text-gold/60 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-text-muted font-medium italic leading-relaxed">
                {supplier.suppliedItems}
              </span>
            </div>
          </div>
        ))}

        {suppliers.length === 0 && (
          <div className="col-span-full text-center p-12 bg-bg-card border border-gold/10 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-gold/40 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-white">No Suppliers Logged</h3>
            <p className="text-xs text-text-muted mt-1">Log apiaries and packing materials vendors here.</p>
          </div>
        )}
      </div>
    </div>
    </AuthShield>
  );
}
