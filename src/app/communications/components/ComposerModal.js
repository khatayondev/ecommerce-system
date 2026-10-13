import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, Users, Clock, Eye, Edit3, Search, Plus, UserCheck, CheckCircle2, UserPlus, Zap, AlertTriangle, MessageSquare } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function ComposerModal({ 
  onClose, 
  onSend, 
  form, 
  setForm, 
  customers, 
  contactLists, 
  exhibitions = [],
  templates,
  sending,
  liveBalance = null
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll and handle Escape key
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Custom placeholders from a selected CSV list
  const [customPlaceholders, setCustomPlaceholders] = useState([]);
  
  // Smart Individual Person Selection State
  const [selectedIndividualId, setSelectedIndividualId] = useState(form.individualId || '');
  const [individualSearch, setIndividualSearch] = useState('');

  // Quick Add New Contact State
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactType, setNewContactType] = useState('Retail');
  const [isAddingContact, setIsAddingContact] = useState(false);

  useEffect(() => {
    // If audience is a specific contact list, load its headers as placeholders
    const selectedList = contactLists.find(l => l.id === form.audience);
    if (selectedList && selectedList.headers) {
      setCustomPlaceholders(selectedList.headers.map(h => `{{${h}}}`));
    } else {
      setCustomPlaceholders([]);
    }
  }, [form.audience, contactLists]);

  const handleOpenAddContact = () => {
    const q = individualSearch.trim();
    if (q.includes('@')) {
      setNewContactEmail(q);
      setNewContactName('');
      setNewContactPhone('');
    } else if (/^\+?[0-9\s\-]{7,}$/.test(q)) {
      setNewContactPhone(q);
      setNewContactName('');
      setNewContactEmail('');
    } else {
      setNewContactName(q);
      setNewContactPhone('');
      setNewContactEmail('');
    }
    setShowAddContact(true);
  };

  const handleCreateNewContact = async (e) => {
    e.preventDefault();
    if (!newContactName.trim()) {
      toast.error('Customer name is required.');
      return;
    }
    if (!newContactPhone.trim() && !newContactEmail.trim()) {
      toast.error('Provide at least a phone number or email address.');
      return;
    }

    setIsAddingContact(true);
    try {
      const payload = {
        name: newContactName.trim(),
        full_name: newContactName.trim(),
        phone: newContactPhone.trim(),
        phoneNumber: newContactPhone.trim(),
        email: newContactEmail.trim().toLowerCase(),
        customer_type: newContactType,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'customers'), payload);
      setSelectedIndividualId(docRef.id);
      setShowAddContact(false);
      setIndividualSearch('');
      toast.success(`Contact "${newContactName}" added & selected!`);
    } catch (err) {
      console.error('Failed to create customer:', err);
      toast.error('Failed to add contact.');
    } finally {
      setIsAddingContact(false);
    }
  };

  const getRecipientCount = () => {
    if (form.audience === 'individual') {
      return selectedIndividualId ? 1 : 0;
    }

    const selectedList = contactLists.find(l => l.id === form.audience);
    if (selectedList) return selectedList.recipients?.length || 0;

    let filtered = [...customers];
    if (form.audience === 'wholesale') filtered = filtered.filter(c => c.customer_type === 'Wholesale');
    if (form.audience === 'retail') filtered = filtered.filter(c => (c.customer_type || 'Retail') === 'Retail');

    if (form.channel === 'email') filtered = filtered.filter(c => c.email);
    if (form.channel === 'sms') filtered = filtered.filter(c => c.phone || c.phoneNumber);
    if (form.channel === 'both') filtered = filtered.filter(c => c.email || c.phone || c.phoneNumber);

    return filtered.length;
  };

  const isSmsChannel = form.channel === 'sms' || form.channel === 'both';

  const getSmsRecipientCount = () => {
    if (form.audience === 'individual') {
      const targetInd = customers.find(c => c.id === selectedIndividualId);
      return (targetInd && (targetInd.phone || targetInd.phoneNumber)) ? 1 : 0;
    }

    const selectedList = contactLists.find(l => l.id === form.audience);
    if (selectedList && selectedList.recipients) {
      return selectedList.recipients.filter(r => r.phone || r.Phone || r['Phone Number'] || r.Mobile).length;
    }

    let filtered = [...customers];
    if (form.audience === 'wholesale') filtered = filtered.filter(c => c.customer_type === 'Wholesale');
    if (form.audience === 'retail') filtered = filtered.filter(c => (c.customer_type || 'Retail') === 'Retail');
    return filtered.filter(c => c.phone || c.phoneNumber).length;
  };

  const smsRecipientCount = getSmsRecipientCount();
  const charCount = form.message?.length || 0;
  // Multi-part SMS logic: 1-160 chars = 1 SMS; >160 chars = Math.ceil(charCount / 153)
  const segmentsPerRecipient = charCount === 0 ? 0 : charCount <= 160 ? 1 : Math.ceil(charCount / 153);
  const totalSmsCreditsRequired = isSmsChannel ? (smsRecipientCount * segmentsPerRecipient) : 0;
  const isBalanceInsufficient = liveBalance !== null && isSmsChannel && totalSmsCreditsRequired > liveBalance;
  const remainingCreditsAfterSend = liveBalance !== null && isSmsChannel ? (liveBalance - totalSmsCreditsRequired) : null;


  const insertPlaceholder = (ph) => {
    setForm(prev => ({ ...prev, message: prev.message + ph }));
  };

  const applyTemplate = (e) => {
    const tId = e.target.value;
    if (!tId) return;
    const t = templates.find(t => t.id === tId);
    if (t) {
      setForm(prev => ({ ...prev, subject: t.subject, message: t.message }));
    }
  };

  const selectedList = contactLists.find(l => l.id === form.audience);
  const activeEventName = selectedList?.event_name || form.eventName || '';

  const generatePreview = (text) => {
    if (!text) return '';
    let output = text;
    
    // If individual recipient is selected, preview with their actual name
    const targetInd = customers.find(c => c.id === selectedIndividualId);
    output = output.replace(/\{\{Name\}\}/gi, targetInd?.full_name || targetInd?.name || 'Kofi Mensah');
    output = output.replace(/\{\{Event\}\}/gi, activeEventName || 'Forty Under 40 Summit 2026');
    output = output.replace(/\{\{Company\}\}/gi, 'Corporate Partner');
    output = output.replace(/\{\{Email\}\}/gi, targetInd?.email || 'kofi.mensah@example.com');
    output = output.replace(/\{\{Phone\}\}/gi, targetInd?.phone || targetInd?.phoneNumber || '+233 55 398 6269');
    output = output.replace(/\{\{CustomerType\}\}/gi, targetInd?.customer_type || 'Retail Client');
    output = output.replace(/\{\{Date\}\}/gi, new Date().toLocaleDateString());
    
    customPlaceholders.forEach(ph => {
      const cleanPh = ph.replace(/[\{\}]/g, '');
      const regex = new RegExp(`\\{\\{${cleanPh}\\}\\}`, 'gi');
      output = output.replace(regex, `[${cleanPh}]`);
    });
    return output;
  };

  const resolveRecipients = () => {
    if (form.audience === 'individual') {
      const targetInd = customers.find(c => c.id === selectedIndividualId);
      if (!targetInd) return [];
      return [{
        full_name: targetInd.full_name || targetInd.name || 'Valued Customer',
        email: targetInd.email || '',
        phone: targetInd.phone || targetInd.phoneNumber || '',
        event: activeEventName,
        customer_type: targetInd.customer_type || 'Retail'
      }];
    }

    if (selectedList && selectedList.recipients) {
      return selectedList.recipients.map(r => ({
        full_name: r.full_name || r.name || r.Name || r['Full Name'] || r['Customer Name'] || 'Guest',
        email: r.email || r.Email || r['Email Address'] || '',
        phone: r.phone || r.Phone || r['Phone Number'] || r.Mobile || '',
        event: r.event || r.Event || selectedList.event_name || activeEventName || '',
        company: r.company || r.Company || r.organization || '',
        customer_type: selectedList.event_name ? `Event: ${selectedList.event_name}` : (selectedList.name || 'Custom List')
      }));
    }

    let filtered = [...customers];
    if (form.audience === 'wholesale') filtered = filtered.filter(c => c.customer_type === 'Wholesale');
    if (form.audience === 'retail') filtered = filtered.filter(c => (c.customer_type || 'Retail') === 'Retail');

    if (form.channel === 'email') filtered = filtered.filter(c => c.email);
    if (form.channel === 'sms') filtered = filtered.filter(c => c.phone);
    if (form.channel === 'both') filtered = filtered.filter(c => c.email || c.phone);

    return filtered.map(c => ({
      full_name: c.full_name || c.name || 'Valued Customer',
      email: c.email || '',
      phone: c.phone || '',
      event: activeEventName,
      customer_type: c.customer_type || 'Retail'
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Subject and message are required.');
      return;
    }

    if (form.audience === 'individual' && !selectedIndividualId) {
      toast.error('Please search and select a customer.');
      return;
    }

    let scheduledDateISO = null;
    if (isScheduling) {
      if (!scheduledFor) {
        toast.error('Please select a date and time to schedule this broadcast.');
        return;
      }
      const parsedDate = new Date(scheduledFor);
      if (isNaN(parsedDate.getTime())) {
        toast.error('Please provide a valid date and time.');
        return;
      }
      scheduledDateISO = parsedDate.toISOString();
    }

    const resolvedList = resolveRecipients();
    if (resolvedList.length === 0) {
      toast.error('No valid recipients found for the selected audience and channel.');
      return;
    }

    const selectedIndCustomer = customers.find(c => c.id === selectedIndividualId);
    const audienceLabel = form.audience === 'individual' 
      ? `Individual: ${selectedIndCustomer?.full_name || selectedIndCustomer?.name || 'Customer'}`
      : form.audience;

    onSend({
      ...form,
      individualId: selectedIndividualId,
      audienceName: audienceLabel,
      status: isScheduling ? 'scheduled' : 'sent',
      scheduledFor: scheduledDateISO,
      recipientCount: resolvedList.length,
      recipientsData: resolvedList 
    });
  };

  const basePlaceholders = ['{{Name}}', '{{Event}}', '{{Company}}', '{{Phone}}', '{{Email}}', '{{Date}}'];
  const allPlaceholders = [...new Set([...basePlaceholders, ...customPlaceholders])];

  const filteredIndividualCustomers = customers.filter(c => {
    if (!individualSearch) return true;
    const q = individualSearch.toLowerCase();
    const name = (c.full_name || c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || c.phoneNumber || '').toLowerCase();
    const type = (c.customer_type || '').toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q) || type.includes(q);
  });

  const selectedCustomerObj = customers.find(c => c.id === selectedIndividualId);
  const eventLists = contactLists.filter(l => l.event_name);
  const generalLists = contactLists.filter(l => !l.event_name);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 overflow-hidden" 
      style={{ zIndex: 99999 }}
    >
      <div className="bg-white border border-gray-200 p-6 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col h-[90vh] max-h-[90vh] relative" style={{ zIndex: 100000 }}>
        <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-[#ffa200]" /> Compose Broadcast
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-grow min-h-0 pr-2 text-sm custom-scrollbar">
          <form id="composer-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Event List Highlight Banner */}
            {selectedList && selectedList.event_name && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Event Broadcast Active</span>
                    <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5 mt-0.5">
                      {selectedList.name} ({selectedList.event_name})
                    </h4>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-900 self-start sm:self-auto">
                    {selectedList.recipients?.length || 0} Event Contacts
                  </span>
                </div>

                <div className="pt-2 border-t border-amber-200/60 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-700 mr-1">Event Quick-Fills:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        subject: `Thank You for visiting The Honey Palace at ${selectedList.event_name}!`,
                        message: `Hi {{Name}},\n\nThank you for stopping by The Honey Palace at ${selectedList.event_name}! We hope you enjoyed tasting our 100% pure, raw, unpasteurized honey.\n\nAs a special gift, enjoy an exclusive 10% discount on your next order at https://thehoneypalaceafrica.com with discount code: HONEYVIP.\n\nStay healthy and sweet!\nWarm regards,\nThe Honey Palace Team`
                      }));
                      toast.success('Loaded Event Thank-You template!');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                  >
                    Booth Thank You
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        subject: `Exclusive Honey Tasting Invitation (${selectedList.event_name})`,
                        message: `Hi {{Name}},\n\nWe're delighted to invite you to an exclusive raw honey tasting by The Honey Palace at ${selectedList.event_name}!\n\nVisit our booth for a free sample of our seasonal single-origin raw honey.\n\nSee you there!\nThe Honey Palace Team`
                      }));
                      toast.success('Loaded Honey Tasting template!');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                  >
                    🍯 Tasting Invite
                  </button>
                </div>
              </div>
            )}

            {/* Template Selector */}
            {templates.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Load from Saved Template (Optional)</label>
                <select onChange={applyTemplate} className="w-full px-3 py-2 border border-[#d07b00]/30 bg-orange-50/30 rounded-xl text-sm text-black focus:ring-2 focus:ring-[#ffa200] outline-none">
                  <option value="">-- Select a template to autofill --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 font-bold block mb-1">Subject / Header</label>
              <input
                type="text"
                required
                placeholder="e.g. New Honey Arrivals!"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] outline-none"
              />
            </div>

            {/* Message Body with Preview Toggle */}
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 p-2 flex justify-between items-center">
                <div className="flex bg-gray-200/50 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode(false)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition ${!isPreviewMode ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode(true)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition ${isPreviewMode ? 'bg-[#ffa200]/20 text-[#d07b00]' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                </div>
                
                {!isPreviewMode && (
                  <div className="flex gap-1 overflow-x-auto max-w-[60%] hide-scrollbar">
                    {allPlaceholders.map(ph => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => insertPlaceholder(ph)}
                        className="px-2 py-1 bg-white border border-gray-200 hover:border-[#ffa200] hover:text-[#ffa200] rounded-md text-[10px] font-mono transition-colors shadow-sm flex-shrink-0 whitespace-nowrap cursor-pointer"
                        title={`Insert ${ph} placeholder`}
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isPreviewMode ? (
                <div className="p-4 bg-white min-h-[160px]">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[#d07b00] mb-2">Live Preview (With Sample Contact Data)</p>
                  <div className="text-gray-800 whitespace-pre-wrap font-sans text-sm">
                    {generatePreview(form.message) || <span className="text-gray-400 italic">No message content to preview.</span>}
                  </div>
                </div>
              ) : (
                <textarea
                  required
                  rows={6}
                  placeholder="Type your message here. Use the buttons above to insert dynamic placeholders like {{Name}} or {{Event}}..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-3 border-0 focus:ring-0 resize-none outline-none text-sm"
                />
              )}

              {/* Textarea status bar */}
              <div className="bg-gray-50 border-t border-gray-100 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                <span>
                  {charCount} character{charCount === 1 ? '' : 's'}
                </span>
                {isSmsChannel && (
                  <span className={`font-bold ${charCount > 160 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {segmentsPerRecipient} SMS segment{segmentsPerRecipient === 1 ? '' : 's'}/contact ({charCount === 0 ? '160 chars left in 1st SMS' : charCount <= 160 ? `${160 - charCount} chars left in 1st SMS` : `${charCount % 153 === 0 ? 0 : 153 - (charCount % 153)} chars left in segment`})
                  </span>
                )}
              </div>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Target Audience</label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] outline-none bg-white font-medium"
                >
                  <optgroup label="Direct Target">
                    <option value="individual">Individual Customer</option>
                    <option value="all">All Customers</option>
                    <option value="wholesale">Wholesale Only</option>
                    <option value="retail">Retail Only</option>
                  </optgroup>
                  {eventLists.length > 0 && (
                    <optgroup label="Event Contact Lists">
                      {eventLists.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.recipients?.length || 0} contacts)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {generalLists.length > 0 && (
                    <optgroup label="📁 General Contact Lists">
                      {generalLists.map(l => (
                        <option key={l.id} value={l.id}>
                          📁 {l.name} ({l.recipients?.length || 0} contacts)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Delivery Channel</label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] outline-none bg-white font-medium"
                >
                  <option value="sms">SMS Only (Arkesel Gateway)</option>
                  <option value="email">Email Only (Resend)</option>
                  <option value="both">Both (SMS + Email)</option>
                </select>
              </div>
            </div>

            {/* Smart Individual Customer Selection Sub-Panel */}
            {form.audience === 'individual' && (
              <div className="bg-amber-50/50 border border-[#d07b00]/20 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-900 font-bold flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-[#d07b00]" /> Search & Select Recipient
                  </label>
                  {selectedCustomerObj && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndividualId('');
                        setIndividualSearch('');
                      }}
                      className="text-[11px] text-[#d07b00] hover:underline font-bold"
                    >
                      Change Selected
                    </button>
                  )}
                </div>

                {selectedCustomerObj ? (
                  /* Active Selected Contact Card */
                  <div className="bg-white border border-[#ffa200] rounded-xl p-3 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#ffa200]/20 text-[#d07b00] flex items-center justify-center font-bold text-xs">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">{selectedCustomerObj.full_name || selectedCustomerObj.name}</p>
                        <p className="text-[11px] text-gray-500 font-medium">
                          {selectedCustomerObj.phone || selectedCustomerObj.phoneNumber || 'No Phone'} • {selectedCustomerObj.email || 'No Email'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-[#d07b00]">
                      {selectedCustomerObj.customer_type || 'Retail'}
                    </span>
                  </div>
                ) : (
                  /* Live Search Input & Results */
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name, phone, email, or customer type..."
                        value={individualSearch}
                        onChange={(e) => setIndividualSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffa200] outline-none font-medium"
                      />
                    </div>

                    {/* Live Matching Results List */}
                    {individualSearch.trim() !== '' && (
                      <div className="bg-white border border-gray-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-100 shadow-md">
                        {filteredIndividualCustomers.length === 0 ? (
                          <div className="p-4 text-center space-y-2">
                            <p className="text-xs text-gray-500 font-medium">No contact matching "{individualSearch}"</p>
                            <button
                              type="button"
                              onClick={handleOpenAddContact}
                              className="px-3 py-1.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add New Contact
                            </button>
                          </div>
                        ) : (
                          filteredIndividualCustomers.map(c => (
                            <div
                              key={c.id}
                              onClick={() => setSelectedIndividualId(c.id)}
                              className="p-2.5 hover:bg-amber-50 cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div>
                                <p className="text-xs font-bold text-gray-900">{c.full_name || c.name}</p>
                                <p className="text-[11px] text-gray-500 font-medium">
                                  {c.phone || c.phoneNumber || 'No phone'} • {c.email || 'No email'}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="p-1 rounded-lg text-[#d07b00] hover:bg-[#ffa200]/20"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Quick Add Button if searching or list empty */}
                    {individualSearch.trim() === '' && (
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-gray-500 text-[11px]">Type customer details above to search</span>
                        <button
                          type="button"
                          onClick={handleOpenAddContact}
                          className="text-[#d07b00] hover:underline font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Add New Contact
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Add Contact Modal Overlay */}
                {showAddContact && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-gray-200 p-5 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-[#d07b00]" /> Add New Customer Contact
                        </h4>
                        <button type="button" onClick={() => setShowAddContact(false)} className="text-gray-400 hover:text-gray-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="font-bold text-gray-700 block mb-1">Full Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Ama Serwaa"
                            value={newContactName}
                            onChange={(e) => setNewContactName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#ffa200]"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-gray-700 block mb-1">Phone Number</label>
                          <input
                            type="text"
                            placeholder="e.g. +233 55 123 4567"
                            value={newContactPhone}
                            onChange={(e) => setNewContactPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#ffa200]"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-gray-700 block mb-1">Email Address</label>
                          <input
                            type="email"
                            placeholder="e.g. ama@example.com"
                            value={newContactEmail}
                            onChange={(e) => setNewContactEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#ffa200]"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-gray-700 block mb-1">Customer Type</label>
                          <select
                            value={newContactType}
                            onChange={(e) => setNewContactType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white font-medium"
                          >
                            <option value="Retail">Retail</option>
                            <option value="Wholesale">Wholesale</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowAddContact(false)}
                          className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateNewContact}
                          disabled={isAddingContact}
                          className="flex-1 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold text-xs rounded-lg transition shadow-xs disabled:opacity-50"
                        >
                          {isAddingContact ? 'Saving...' : 'Save & Select Contact'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Scheduling Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#ffa200]" /> Schedule Send
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Send immediately or set a future date.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={isScheduling}
                    onChange={(e) => {
                      setIsScheduling(e.target.checked);
                      if (!e.target.checked) setScheduledFor('');
                    }}
                  />
                  <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#ffa200] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </div>
              
              {isScheduling && (
                <div className="mt-4 pt-3 border-t border-gray-200 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs text-gray-500 font-bold block mb-1">Select Date & Time</label>
                  <input
                    type="datetime-local"
                    required={isScheduling}
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#ffa200] outline-none"
                  />
                </div>
              )}
            </div>

            {/* Live SMS Credit Consumption & Audience Estimation Card */}
            {isSmsChannel ? (
              <div className={`rounded-2xl border p-4 space-y-3 transition shadow-xs ${
                isBalanceInsufficient
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-amber-50/60 border-amber-200'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isBalanceInsufficient ? 'bg-rose-100 text-rose-700' : 'bg-[#ffa200]/20 text-[#d07b00]'}`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">
                        Estimated SMS Credits Required
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        {smsRecipientCount} recipient{smsRecipientCount === 1 ? '' : 's'} with phone number × {segmentsPerRecipient} SMS segment{segmentsPerRecipient === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-black text-gray-900 block font-mono">
                      {totalSmsCreditsRequired} <span className="text-xs font-normal text-gray-600">Credits</span>
                    </span>
                  </div>
                </div>

                {/* Balance Comparison Bar */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/5 text-center text-xs">
                  <div className="bg-white/90 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Available</span>
                    <span className="font-bold text-gray-800">
                      {liveBalance !== null ? `${liveBalance} credits` : 'Loading...'}
                    </span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">To Deduct</span>
                    <span className="font-bold text-amber-600 font-mono">
                      -{totalSmsCreditsRequired}
                    </span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Remaining</span>
                    <span className={`font-bold font-mono ${
                      remainingCreditsAfterSend !== null && remainingCreditsAfterSend < 0
                        ? 'text-rose-600 font-black'
                        : 'text-emerald-600'
                    }`}>
                      {remainingCreditsAfterSend !== null ? `${remainingCreditsAfterSend}` : '—'}
                    </span>
                  </div>
                </div>

                {isBalanceInsufficient && (
                  <div className="flex items-start gap-2 p-2.5 bg-rose-100/80 border border-rose-300 rounded-xl text-xs text-rose-900 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Low Arkesel Balance:</strong> This broadcast requires <strong>{totalSmsCreditsRequired} credits</strong>, but your account has only <strong>{liveBalance} credits</strong>. Please reduce recipients, shorten your message, or top up before sending.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-orange-50 border border-[#d07b00]/20 rounded-xl p-3 text-xs text-gray-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#ffa200]" />
                <span>This broadcast will reach <strong className="text-black font-bold">{getRecipientCount()}</strong> recipient(s).</span>
              </div>
            )}

          </form>
        </div>

        <div className="pt-4 flex gap-3 flex-shrink-0 border-t border-gray-100 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition">
            Cancel
          </button>
          <button 
            form="composer-form"
            type="submit" 
            disabled={sending} 
            className="flex-1 py-2.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            <Send className="w-4 h-4" /> 
            {sending ? 'Processing...' : isScheduling ? 'Schedule Broadcast' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
