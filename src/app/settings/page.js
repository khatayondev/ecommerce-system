'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthShield from '@/components/AuthShield';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { logAction } from '@/utils/logging';
import { toast } from 'react-hot-toast';
import { 
  Store, 
  Power, 
  Clock, 
  Phone, 
  Mail, 
  MapPin, 
  Image as ImageIcon, 
  Save, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Truck, 
  ShieldCheck, 
  Building,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { DEFAULT_DELIVERY_ZONES } from '@/context/StoreSettingsContext';

export default function StoreSettingsPage() {
  const { user } = useAuth();
  const { 
    isStoreOpen, 
    isBusyMode, 
    settings, 
    loading: settingsLoading, 
    toggleStoreOpen, 
    toggleBusyMode, 
    updateSettings 
  } = useStoreSettings();

  const [form, setForm] = useState({
    companyName: '',
    tagline: '',
    logoUrl: '',
    companyEmail: '',
    companyPhone: '',
    secondaryPhone: '',
    companyAddress: '',
    openingHoursWeekdays: '',
    openingHoursSaturday: '',
    openingHoursSunday: '',
    offlineNotice: '',
    freeShippingThreshold: 300,
    deliveryZones: DEFAULT_DELIVERY_ZONES
  });

  const [saving, setSaving] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZoneIndex, setEditingZoneIndex] = useState(null);
  const [zoneFormData, setZoneFormData] = useState({
    id: '',
    name: '',
    region: 'Greater Accra',
    fee: 25,
    eta: 'Same Day / Next Day',
    isActive: true
  });

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName || 'The Honey Palace Africa',
        tagline: settings.tagline || '100% Pure, Unprocessed & Certified Natural Honey',
        logoUrl: settings.logoUrl || 'https://res.cloudinary.com/doysykrko/image/upload/c_scale,h_100/v1705796419/Honey-Palace-Logo-Design-3-e1700045253681.png',
        companyEmail: settings.companyEmail || 'purchases@thehoneypalaceafrica.com',
        companyPhone: settings.companyPhone || '+233 50 260 6270',
        secondaryPhone: settings.secondaryPhone || '+233 55 454 8978',
        companyAddress: settings.companyAddress || 'Amrahia, Off Dodowa Road, Greater Accra, Ghana',
        openingHoursWeekdays: settings.openingHoursWeekdays || 'Monday – Friday: 8:00 AM – 6:00 PM',
        openingHoursSaturday: settings.openingHoursSaturday || 'Saturday: 9:00 AM – 4:00 PM',
        openingHoursSunday: settings.openingHoursSunday || 'Sunday: Closed (Online Orders Processed Next Business Day)',
        offlineNotice: settings.offlineNotice || 'We are temporarily restocking our fresh honey barrels. Online checkout will resume shortly!',
        freeShippingThreshold: settings.freeShippingThreshold !== undefined ? settings.freeShippingThreshold : 300,
        deliveryZones: settings.deliveryZones || DEFAULT_DELIVERY_ZONES
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenAddZone = () => {
    setEditingZoneIndex(null);
    setZoneFormData({
      id: `zone_${Date.now().toString(36)}`,
      name: '',
      region: 'Greater Accra',
      fee: 30,
      eta: 'Same Day / Next Day',
      isActive: true
    });
    setShowZoneModal(true);
  };

  const handleOpenEditZone = (index) => {
    setEditingZoneIndex(index);
    setZoneFormData({ ...form.deliveryZones[index] });
    setShowZoneModal(true);
  };

  const handleSaveZone = (e) => {
    e.preventDefault();
    if (!zoneFormData.name.trim() || !zoneFormData.region.trim()) {
      toast.error("Please fill in the zone coverage areas and region.");
      return;
    }

    const currentZones = [...(form.deliveryZones || DEFAULT_DELIVERY_ZONES)];
    if (editingZoneIndex !== null) {
      currentZones[editingZoneIndex] = {
        ...zoneFormData,
        fee: Number(zoneFormData.fee) || 0
      };
      toast.success("Delivery zone updated!");
    } else {
      currentZones.push({
        ...zoneFormData,
        id: zoneFormData.id || `zone_${Date.now().toString(36)}`,
        fee: Number(zoneFormData.fee) || 0
      });
      toast.success("New delivery zone added!");
    }

    setForm(prev => ({ ...prev, deliveryZones: currentZones }));
    setShowZoneModal(false);
  };

  const handleToggleZoneActive = (index) => {
    const currentZones = [...(form.deliveryZones || DEFAULT_DELIVERY_ZONES)];
    currentZones[index] = {
      ...currentZones[index],
      isActive: currentZones[index].isActive === false ? true : false
    };
    setForm(prev => ({ ...prev, deliveryZones: currentZones }));
  };

  const handleDeleteZone = (index) => {
    if (confirm("Are you sure you want to remove this delivery zone?")) {
      const currentZones = [...(form.deliveryZones || DEFAULT_DELIVERY_ZONES)].filter((_, i) => i !== index);
      setForm(prev => ({ ...prev, deliveryZones: currentZones }));
      toast.success("Delivery zone removed.");
    }
  };

  const handleResetDefaultZones = () => {
    if (confirm("Reset all delivery zones to standard Honey Palace presets?")) {
      setForm(prev => ({ ...prev, deliveryZones: DEFAULT_DELIVERY_ZONES }));
      toast.success("Delivery zones reset to factory presets.");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(form);
      toast.success('Global store settings & delivery zones saved successfully!');
      if (user) {
        logAction(user, 'UPDATE_STORE_SETTINGS', 'Updated global business settings and delivery zone configuration');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShield requiredPermission="settings.manage">
      <div className="p-4 md:p-8 pb-36 md:pb-12 max-w-6xl mx-auto space-y-8 font-sans text-gray-900">
        
        {/* Header & Sub-Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#d07b00] uppercase tracking-wider mb-1">
              <Store className="w-4 h-4" /> Management Control
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
              Global Store Settings
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure brand identity, live store accessibility, contact details, and warehouse operating hours.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ffa200] text-black shadow-sm"
            >
              Store Profile
            </Link>
            <Link
              href="/settings/users"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" /> Team &amp; Access
            </Link>
          </div>
        </div>

        {/* 1. MASTER STORE ONLINE / OFFLINE SWITCH */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <Power className="w-5 h-5 text-[#ffa200]" />
            <h2 className="text-lg font-extrabold text-gray-900">Store Status &amp; Customer Accessibility</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Master Switch Card */}
            <div className={`p-6 rounded-2xl border transition-all ${
              isStoreOpen 
                ? 'bg-emerald-50/60 border-emerald-200' 
                : 'bg-rose-50/60 border-rose-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Master Switch</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                  isStoreOpen 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : 'bg-rose-500 text-white shadow-sm'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {isStoreOpen ? 'STORE ONLINE' : 'STORE OFFLINE'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {isStoreOpen ? 'Online Ordering Active' : 'Online Ordering Paused'}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-6">
                {isStoreOpen 
                  ? 'The storefront is open to the public. Customers can browse honey varieties and pay via Paystack.'
                  : 'The storefront is currently offline. Customers will see a banner and checkout buttons are disabled.'}
              </p>

              <button
                type="button"
                onClick={toggleStoreOpen}
                disabled={settingsLoading}
                className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                  isStoreOpen
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                }`}
              >
                <Power className="w-4 h-4" />
                {isStoreOpen ? 'Take Store Offline' : 'Bring Store Online'}
              </button>
            </div>

            {/* High Demand / Busy Mode Card */}
            <div className={`p-6 rounded-2xl border transition-all ${
              isBusyMode 
                ? 'bg-amber-50/60 border-amber-200' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Fulfillment Load</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                  isBusyMode 
                    ? 'bg-amber-500 text-white shadow-sm' 
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {isBusyMode ? 'HIGH DEMAND' : 'NORMAL DEMAND'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {isBusyMode ? 'High Volume Notice Active' : 'Standard Delivery Speed'}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-6">
                {isBusyMode 
                  ? 'A gentle advisory banner is displayed informing shoppers that courier dispatches might take slightly longer.'
                  : 'No delay notices shown. Standard same-day and next-day dispatches are expected.'}
              </p>

              <button
                type="button"
                onClick={toggleBusyMode}
                disabled={settingsLoading}
                className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                  isBusyMode
                    ? 'bg-gray-800 hover:bg-black text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-black shadow-md shadow-amber-500/20'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                {isBusyMode ? 'Disable High Demand Mode' : 'Enable High Demand Mode'}
              </button>
            </div>

          </div>

          {/* Offline Notice Message Box */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold text-gray-700 block">
              Offline Customer Notice Message
            </label>
            <textarea
              name="offlineNotice"
              rows={2}
              value={form.offlineNotice}
              onChange={handleChange}
              placeholder="e.g. We are temporarily updating our honey stock. Orders will resume shortly!"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white transition-all"
            />
            <span className="text-[11px] text-gray-500 block">
              Displayed on the storefront checkout banner when the Master Switch is toggled OFFLINE.
            </span>
          </div>
        </div>

        {/* 2. BUSINESS PROFILE & BRANDING FORM */}
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* Brand Identity */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
              <Building className="w-5 h-5 text-[#ffa200]" />
              <h2 className="text-lg font-extrabold text-gray-900">Brand Identity &amp; Logo</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Business Name *</label>
                <input
                  type="text"
                  name="companyName"
                  required
                  value={form.companyName}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Tagline / Mission</label>
                <input
                  type="text"
                  name="tagline"
                  value={form.tagline}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-gray-700 block">Logo Image URL</label>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <input
                    type="url"
                    name="logoUrl"
                    value={form.logoUrl}
                    onChange={handleChange}
                    placeholder="https://res.cloudinary.com/..."
                    className="flex-1 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                  />
                  {form.logoUrl && (
                    <div className="p-2 border border-gray-200 rounded-xl bg-gray-50 flex items-center gap-2">
                      <img 
                        src={form.logoUrl} 
                        alt="Logo Preview" 
                        className="h-8 max-w-[120px] object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Preview</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
              <Phone className="w-5 h-5 text-[#ffa200]" />
              <h2 className="text-lg font-extrabold text-gray-900">Official Contact Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Primary Customer Care Phone *</label>
                <input
                  type="text"
                  name="companyPhone"
                  required
                  value={form.companyPhone}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Secondary / WhatsApp Dispatch Line</label>
                <input
                  type="text"
                  name="secondaryPhone"
                  value={form.secondaryPhone}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Official Support Email *</label>
                <input
                  type="email"
                  name="companyEmail"
                  required
                  value={form.companyEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Warehouse &amp; Apiary Facility Address</label>
                <input
                  type="text"
                  name="companyAddress"
                  value={form.companyAddress}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
              <Clock className="w-5 h-5 text-[#ffa200]" />
              <h2 className="text-lg font-extrabold text-gray-900">Facility &amp; Dispatch Operating Hours</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Weekdays (Mon – Fri)</label>
                <input
                  type="text"
                  name="openingHoursWeekdays"
                  value={form.openingHoursWeekdays}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Saturdays</label>
                <input
                  type="text"
                  name="openingHoursSaturday"
                  value={form.openingHoursSaturday}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Sundays &amp; Public Holidays</label>
                <input
                  type="text"
                  name="openingHoursSunday"
                  value={form.openingHoursSunday}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-gray-50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* 5. DELIVERY ZONES & SHIPPING RULES */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#ffa200]" />
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Delivery Zones &amp; Shipping Fees</h2>
                  <p className="text-xs text-gray-500">Define specific delivery coverage areas and their upfront shipping fees.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaultZones}
                  className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                  title="Reset to Honey Palace standard zones"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddZone}
                  className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4 text-[#ffa200]" /> Add Delivery Area
                </button>
              </div>
            </div>

            {/* Delivery Zones Table */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Region / Area</th>
                    <th className="py-3 px-4">Covered Towns &amp; Neighborhoods</th>
                    <th className="py-3 px-4 text-center">Delivery Fee</th>
                    <th className="py-3 px-4">Estimated ETA</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(form.deliveryZones || []).map((zone, idx) => {
                    const isActive = zone.isActive !== false;
                    return (
                      <tr key={zone.id || idx} className={`hover:bg-gray-50/70 transition-colors ${!isActive ? 'opacity-50 bg-gray-50/40' : ''}`}>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleZoneActive(idx)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${
                              isActive 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}
                          >
                            {isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900 whitespace-nowrap">
                          {zone.region}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 max-w-xs font-medium">
                          {zone.name}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold rounded-lg text-xs">
                            GH₵{Number(zone.fee || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                          {zone.eta}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditZone(idx)}
                              className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-600 transition"
                              title="Edit Zone"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteZone(idx)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition"
                              title="Delete Zone"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Free Shipping Milestone Setting */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50/30 p-4 rounded-xl border border-amber-100">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Free Delivery Milestone Threshold (Greater Accra)
                </span>
                <p className="text-[11px] text-amber-800">
                  Cart subtotals at or above this amount automatically qualify for free shipping.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">GH₵</span>
                <input
                  type="number"
                  name="freeShippingThreshold"
                  min="0"
                  step="10"
                  value={form.freeShippingThreshold}
                  onChange={handleChange}
                  className="w-32 px-3 py-2 rounded-xl border border-gray-300 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#ffa200] bg-white text-gray-900"
                />
              </div>
            </div>

          </div>

          {/* Form Submit Bar */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3.5 rounded-xl font-extrabold text-sm bg-[#ffa200] hover:bg-[#e69100] text-black shadow-md shadow-[#ffa200]/25 transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving Configuration...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Global Settings
                </>
              )}
            </button>
          </div>

        </form>

        {/* Modal: Add or Edit Delivery Zone */}
        {showZoneModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 overflow-hidden text-gray-900 animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#ffa200]" />
                  {editingZoneIndex !== null ? 'Edit Delivery Area' : 'Add New Delivery Area'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowZoneModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveZone} className="p-6 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 uppercase tracking-wide text-[10px] block">
                    Region / Area Category *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Greater Accra Local, Accra Core Metro, Inter-Regional"
                    value={zoneFormData.region}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, region: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ffa200] text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 uppercase tracking-wide text-[10px] block">
                    Covered Neighborhoods &amp; Towns *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. Amrahia, Adenta, Oyibi, Madina, Dodowa, Oyarifa"
                    value={zoneFormData.name}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ffa200] text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 uppercase tracking-wide text-[10px] block">
                      Delivery Fee (GH₵) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={zoneFormData.fee}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, fee: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ffa200] text-sm font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 uppercase tracking-wide text-[10px] block">
                      Estimated Delivery ETA
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Same Day / Next Day"
                      value={zoneFormData.eta}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, eta: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ffa200] text-sm"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zoneFormData.isActive !== false}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, isActive: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-bold text-gray-700">Active (Visible on checkout)</span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowZoneModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#ffa200] hover:bg-[#e69100] text-black font-extrabold rounded-xl shadow-md transition"
                    >
                      {editingZoneIndex !== null ? 'Save Changes' : 'Add Zone'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AuthShield>
  );
}
