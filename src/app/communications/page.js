'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { logAction } from '@/utils/logging';
import AuthShield from '@/components/AuthShield';
import toast from 'react-hot-toast';
import { Megaphone, FileText, Users, Mail, Zap, RotateCw } from 'lucide-react';

// Sub-components
import BroadcastsTab from './components/BroadcastsTab';
import TemplatesTab from './components/TemplatesTab';
import ContactListsTab from './components/ContactListsTab';
import ComposerModal from './components/ComposerModal';
import BroadcastConfirmModal from './components/BroadcastConfirmModal';
import BroadcastPreviewModal from './components/BroadcastPreviewModal';

export default function CommunicationsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('broadcasts');
  
  // Firebase Data
  const [announcements, setAnnouncements] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [exhibitions, setExhibitions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Modals
  const [search, setSearch] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [previewBroadcast, setPreviewBroadcast] = useState(null);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [sending, setSending] = useState(false);

  // Form State
  const [form, setForm] = useState({
    subject: '',
    message: '',
    audience: 'all',
    channel: 'email',
    individualId: '',
    eventName: ''
  });

  // Live SMS Balance State
  const [smsBalance, setSmsBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchBalance = async (isManual = false) => {
    setBalanceLoading(true);
    try {
      const res = await fetch('/api/sms-balance');
      const data = await res.json();
      if (data.success && typeof data.balance === 'number') {
        setSmsBalance(data.balance);
        if (isManual) toast.success(`Balance refreshed: ${data.balance} SMS credits available`);
      } else {
        console.warn('SMS balance response not ok:', data);
        if (isManual) toast.error('Could not fetch SMS balance.');
      }
    } catch (err) {
      console.error('Failed to fetch SMS balance:', err);
      if (isManual) toast.error('Failed to connect to SMS service.');
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    if (!db) { setLoading(false); return; }

    const unsubAnn = onSnapshot(collection(db, 'announcements'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      list.sort((a, b) => {
        const dateA = a.status === 'scheduled' ? a.scheduledFor : a.sentAt;
        const dateB = b.status === 'scheduled' ? b.scheduledFor : b.sentAt;
        return (dateB || '').localeCompare(dateA || '');
      });
      setAnnouncements(list);
    }, (err) => console.warn('[Communications] Announcements permission warning:', err.message));

    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setCustomers(list);
    }, (err) => console.warn('[Communications] Customers permission warning:', err.message));

    const unsubLists = onSnapshot(collection(db, 'contact_lists'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setContactLists(list);
    }, (err) => console.warn('[Communications] Contact lists permission warning:', err.message));

    const unsubExh = onSnapshot(collection(db, 'exhibitions'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setExhibitions(list);
    }, (err) => console.warn('[Communications] Exhibitions permission warning:', err.message));

    const unsubTemplates = onSnapshot(collection(db, 'message_templates'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id }));
      setTemplates(list);
      setLoading(false);
    }, (err) => {
      console.warn('[Communications] Templates permission warning:', err.message);
      setLoading(false);
    });

    return () => { 
      unsubAnn(); unsubCust(); unsubLists(); unsubExh(); unsubTemplates(); 
    };
  }, []);

  const handleStartCampaignForList = (list) => {
    const defaultSubject = list.event_name 
      ? `Special Update from The Honey Palace - ${list.event_name}`
      : `Special Update from The Honey Palace`;
      
    const defaultMessage = list.event_name
      ? `Hi {{Name}},\n\nThank you for connecting with The Honey Palace at ${list.event_name}! We hope you enjoyed tasting our 100% pure, raw, unpasteurized honey.\n\nAs a special gift for visiting us, you can enjoy an exclusive 10% discount on your next online order at https://thehoneypalaceafrica.com with discount code: HONEYVIP.\n\nStay healthy and sweet!\nWarm regards,\nThe Honey Palace Team`
      : `Hi {{Name}},\n\nThank you for connecting with The Honey Palace! We appreciate your support for pure raw honey.\n\nExplore our latest harvest online at https://thehoneypalaceafrica.com.\n\nWarm regards,\nThe Honey Palace Team`;

    const smsCount = list.smsCount || list.recipients?.filter(r => r.phone)?.length || 0;
    const emailCount = list.emailCount || list.recipients?.filter(r => r.email)?.length || 0;

    let targetChannel = 'sms';
    if (smsCount > 0 && emailCount > 0) targetChannel = 'both';
    else if (emailCount > 0) targetChannel = 'email';

    setForm({
      subject: defaultSubject,
      message: defaultMessage,
      audience: list.id,
      channel: targetChannel,
      individualId: '',
      eventName: list.event_name || ''
    });
    setShowComposer(true);
  };

  const handleSaveContactList = async (listData, syncToCustomers = true) => {
    try {
      const docRef = await addDoc(collection(db, 'contact_lists'), listData);
      
      let syncedCount = 0;
      if (syncToCustomers && listData.recipients?.length > 0) {
        // Collect existing phone numbers and emails to avoid duplicate customer records
        const existingPhones = new Set();
        const existingEmails = new Set();
        customers.forEach(c => {
          const p = (c.phone || c.phoneNumber || '').replace(/[^\d]/g, '');
          if (p) existingPhones.add(p);
          const e = (c.email || '').trim().toLowerCase();
          if (e) existingEmails.add(e);
        });

        const newContacts = [];
        const seenInBatch = new Set();

        listData.recipients.forEach(r => {
          const cleanPhone = (r.phone || '').replace(/[^\d]/g, '');
          const cleanEmail = (r.email || '').trim().toLowerCase();
          const dedupKey = cleanPhone || cleanEmail || (r.full_name || '').trim().toLowerCase();

          if (!dedupKey || seenInBatch.has(dedupKey)) return;
          seenInBatch.add(dedupKey);

          const phoneExists = cleanPhone && existingPhones.has(cleanPhone);
          const emailExists = cleanEmail && existingEmails.has(cleanEmail);

          if (!phoneExists && !emailExists) {
            newContacts.push({
              name: r.full_name || 'Guest Contact',
              full_name: r.full_name || 'Guest Contact',
              phone: r.phone || '',
              phoneNumber: r.phone || '',
              email: cleanEmail || '',
              company: r.company || '',
              customer_type: 'retail',
              source: listData.event_name ? `Event: ${listData.event_name}` : `Contact List: ${listData.name}`,
              contact_list_id: docRef.id,
              notes: `Imported via contact list "${listData.name}"${listData.event_name ? ` (${listData.event_name})` : ''}`,
              createdAt: new Date().toISOString()
            });

            if (cleanPhone) existingPhones.add(cleanPhone);
            if (cleanEmail) existingEmails.add(cleanEmail);
          }
        });

        // Batch write to Firestore (max 400 operations per batch)
        const CHUNK_SIZE = 400;
        for (let i = 0; i < newContacts.length; i += CHUNK_SIZE) {
          const chunk = newContacts.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(contact => {
            const customerDocRef = doc(collection(db, 'customers'));
            batch.set(customerDocRef, contact);
          });
          await batch.commit();
        }
        syncedCount = newContacts.length;
      }

      await logAction(
        user?.email || 'admin@thehoneypalaceafrica.com',
        user?.full_name || user?.email?.split('@')[0] || 'Staff',
        'Upload Contact List',
        `Created contact list "${listData.name}" with ${listData.recipientCount} contacts.${syncedCount > 0 ? ` Added ${syncedCount} new contacts to Customers directory.` : ''}`
      );

      if (syncedCount > 0) {
        toast.success(`Saved to Firebase! ${listData.recipientCount} contacts stored & ${syncedCount} added to Customers.`);
      } else {
        toast.success(`Contact list saved to Firebase (${listData.recipientCount} contacts)!`);
      }
    } catch (err) {
      console.error('Failed to save contact list:', err);
      toast.error('Failed to save to Firebase: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteContactList = async (listId) => {
    if (!window.confirm('Are you sure you want to delete this contact list?')) return;
    try {
      await deleteDoc(doc(db, 'contact_lists', listId));
      toast.success('Contact list deleted.');
    } catch (err) {
      toast.error('Failed to delete list.');
    }
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      if (templateData.id) {
        const { id, ...data } = templateData;
        await setDoc(doc(db, 'message_templates', id), data);
        toast.success('Template updated!');
      } else {
        await addDoc(collection(db, 'message_templates'), templateData);
        toast.success('Template created!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteDoc(doc(db, 'message_templates', templateId));
      toast.success('Template deleted.');
    } catch (err) {
      toast.error('Failed to delete template.');
    }
  };

  // Preview Announcement Modal Trigger
  const handlePreviewBroadcast = (ann) => {
    setPreviewBroadcast(ann);
  };

  // Edit & Resend Announcement
  const handleEditAndResend = (ann) => {
    setForm({
      subject: ann.subject || '',
      message: ann.message || '',
      audience: ann.audience || 'all',
      channel: ann.channel || 'email',
      individualId: ann.individualId || ''
    });
    setPreviewBroadcast(null);
    setShowComposer(true);
    toast.success('Loaded broadcast into composer! Edit and send when ready.');
  };

  // Save Announcement as Template
  const handleSaveBroadcastAsTemplate = async (ann) => {
    const templateName = window.prompt('Enter a name for this template:', ann.subject || 'Saved Announcement Template');
    if (!templateName || !templateName.trim()) return;

    try {
      await addDoc(collection(db, 'message_templates'), {
        name: templateName.trim(),
        subject: ann.subject || '',
        message: ann.message || '',
        createdAt: new Date().toISOString()
      });
      toast.success(`Template "${templateName}" saved successfully!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save template.');
    }
  };

  // Step 1: Open Confirmation & Recipient Preview Modal
  const handlePrepareBroadcast = (payload) => {
    setPendingPayload(payload);
    setShowComposer(false);
    setShowConfirmModal(true);
  };

  // Step 2: Execute Final Broadcast after Confirmation
  const handleExecuteBroadcast = async (finalPayload) => {
    setSending(true);

    try {
      const { recipientsData, ...broadcastData } = finalPayload;
      
      broadcastData.sentBy = user?.full_name || 'System';
      if (broadcastData.status !== 'scheduled') {
        broadcastData.sentAt = new Date().toISOString();
      } else {
        broadcastData.recipients = recipientsData || [];
      }

      // Save announcement record to Firestore
      await addDoc(collection(db, 'announcements'), broadcastData);
      await logAction(
        user?.email || 'admin@thehoneypalaceafrica.com', 
        user?.full_name || user?.email?.split('@')[0] || 'Staff', 
        broadcastData.status === 'scheduled' ? 'Scheduled Broadcast' : 'Broadcast Announcement', 
        `${broadcastData.status === 'scheduled' ? 'Scheduled' : 'Sent'} ${form.channel} broadcast to ${broadcastData.recipientCount} recipients: "${form.subject}"`
      );

      // If it's sending NOW, call the API
      if (broadcastData.status === 'sent') {
        try {
          await fetch('/api/send-announcement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...broadcastData,
              recipients: recipientsData
            })
          });
        } catch (err) {
          console.error('API call failed:', err);
        }
        toast.success(`Announcement sent to ${broadcastData.recipientCount} recipients!`);
        fetchBalance();
      } else {
        toast.success(`Broadcast successfully scheduled for ${new Date(broadcastData.scheduledFor).toLocaleString()}!`);
      }

      setForm({ subject: '', message: '', audience: 'all', channel: 'email', individualId: '' });
      setShowConfirmModal(false);
      setPendingPayload(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to process broadcast.');
    } finally {
      setSending(false);
    }
  };

  const handleCancelScheduled = async (id) => {
    if (!window.confirm('Cancel this scheduled broadcast?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast.success('Scheduled broadcast cancelled.');
    } catch (err) {
      toast.error('Failed to cancel broadcast.');
    }
  };

  const handleSendScheduledNow = async (id) => {
    if (!window.confirm('Send this scheduled broadcast immediately to all recipients?')) return;
    try {
      toast.loading('Dispatching scheduled broadcast...', { id: 'send-scheduled-now' });
      const res = await fetch('/api/cron/send-scheduled-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Broadcast dispatched successfully!', { id: 'send-scheduled-now' });
        if (previewBroadcast && previewBroadcast.id === id) {
          setPreviewBroadcast(null);
        }
        fetchBalance();
      } else {
        toast.error('Failed: ' + (data.error || 'Check server logs'), { id: 'send-scheduled-now' });
      }
    } catch (err) {
      toast.error('Dispatch error: ' + err.message, { id: 'send-scheduled-now' });
    }
  };

  const tabs = [
    { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'lists', label: 'Contact Lists', icon: Users },
  ];

  return (
    <AuthShield requiredPermission="customer.manage">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        
        {/* Header Navigation & Live SMS Balance Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3 mb-6">
          <div className="flex gap-4 md:gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide py-0.5">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex-shrink-0 whitespace-nowrap cursor-pointer ${
                    isActive ? 'border-[#ffa200] text-[#ffa200]' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* Live Arkesel SMS Balance Pill */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div 
              title="Real-time SMS credits available on connected Arkesel account"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border shadow-2xs transition ${
                smsBalance === null
                  ? 'bg-gray-100 border-gray-200 text-gray-600'
                  : smsBalance > 50
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : smsBalance > 10
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800 animate-pulse'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${
                smsBalance === null ? 'text-gray-400' : smsBalance > 50 ? 'text-emerald-500' : smsBalance > 10 ? 'text-amber-500' : 'text-rose-500'
              }`} />
              <span>
                {balanceLoading && smsBalance === null
                  ? 'Checking SMS credits...'
                  : smsBalance !== null
                  ? `${smsBalance.toLocaleString()} SMS Credits`
                  : 'SMS Gateway Ready'}
              </span>
              {smsBalance !== null && smsBalance <= 20 && (
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">Low</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchBalance(true)}
              disabled={balanceLoading}
              title="Refresh SMS balance"
              className="p-1.5 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-200 transition cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${balanceLoading ? 'animate-spin text-[#ffa200]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="text-center py-16 text-text-muted-dark">Loading data...</div>
        ) : (
          <div className="pt-2">
            {activeTab === 'broadcasts' && (
              <BroadcastsTab 
                announcements={announcements} 
                customers={customers} 
                search={search} 
                setSearch={setSearch} 
                setShowComposer={setShowComposer}
                liveBalance={smsBalance}
                onCancelScheduled={handleCancelScheduled}
                onPreviewBroadcast={handlePreviewBroadcast}
                onEditAndResend={handleEditAndResend}
                onSaveAsTemplate={handleSaveBroadcastAsTemplate}
                onSendScheduledNow={handleSendScheduledNow}
              />
            )}
            
            {activeTab === 'templates' && (
              <TemplatesTab 
                templates={templates} 
                onSaveTemplate={handleSaveTemplate}
                onDeleteTemplate={handleDeleteTemplate}
              />
            )}
            
            {activeTab === 'lists' && (
              <ContactListsTab 
                contactLists={contactLists}
                exhibitions={exhibitions}
                onSaveList={handleSaveContactList}
                onDeleteList={handleDeleteContactList}
                onStartCampaignForList={handleStartCampaignForList}
              />
            )}
          </div>
        )}

        {/* Composer Modal */}
        {showComposer && (
          <ComposerModal
            onClose={() => setShowComposer(false)}
            onSend={handlePrepareBroadcast}
            form={form}
            setForm={setForm}
            customers={customers}
            contactLists={contactLists}
            exhibitions={exhibitions}
            templates={templates}
            sending={sending}
            liveBalance={smsBalance}
          />
        )}

        {/* Preview Broadcast Modal */}
        {previewBroadcast && (
          <BroadcastPreviewModal
            announcement={previewBroadcast}
            onClose={() => setPreviewBroadcast(null)}
            onEditAndResend={handleEditAndResend}
            onSaveAsTemplate={handleSaveBroadcastAsTemplate}
            onSendScheduledNow={handleSendScheduledNow}
          />
        )}

        {/* Broadcast Confirmation & Recipient Preview Modal */}
        {showConfirmModal && (
          <BroadcastConfirmModal
            isOpen={showConfirmModal}
            onClose={() => {
              setShowConfirmModal(false);
              setShowComposer(true);
            }}
            onConfirm={handleExecuteBroadcast}
            payload={pendingPayload}
            sending={sending}
            liveBalance={smsBalance}
          />
        )}
      </div>

    </AuthShield>
  );
}
