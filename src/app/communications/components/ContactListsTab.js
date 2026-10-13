import React, { useState, useMemo, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  Upload, 
  Trash2, 
  X, 
  Save, 
  Calendar, 
  Send, 
  Eye, 
  Search, 
  Phone, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Tag, 
  Building2,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const emptySubscribe = () => () => {};

export default function ContactListsTab({ 
  contactLists = [], 
  exhibitions = [], 
  onSaveList, 
  onDeleteList, 
  onStartCampaignForList 
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [isUploading, setIsUploading] = useState(false);
  const [listName, setListName] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [customEventName, setCustomEventName] = useState('');
  const [listTag, setListTag] = useState('Event Attendees');
  const [syncToCustomers, setSyncToCustomers] = useState(true);
  
  const [parsedRecipients, setParsedRecipients] = useState([]);
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [rawPreviewRows, setRawPreviewRows] = useState([]);
  
  // View contacts modal
  const [viewingList, setViewingList] = useState(null);
  const [contactSearch, setContactSearch] = useState('');

  // Lock background scroll and handle Escape key
  useEffect(() => {
    if (!isUploading && !viewingList) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsUploading(false);
        setViewingList(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUploading, viewingList]);

  // Filter lists by category/search
  const [filterCategory, setFilterCategory] = useState('all');
  const [listSearch, setListSearch] = useState('');

  // Smart header normalizer
  const normalizeRow = (headers, cols) => {
    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = cols[idx] || '';
    });

    // Find best match for Name
    let fullName = '';
    const nameKey = headers.find(h => /^(name|fullname|full[_\s]?name|customer[_\s]?name|attendee[_\s]?name|client[_\s]?name|first[_\s]?name)$/i.test(h.trim()));
    if (nameKey) {
      fullName = raw[nameKey];
    } else {
      // Look for First Name + Last Name
      const fKey = headers.find(h => /first[_\s]?name/i.test(h));
      const lKey = headers.find(h => /last[_\s]?name/i.test(h));
      if (fKey && raw[fKey]) {
        fullName = `${raw[fKey]} ${lKey && raw[lKey] ? raw[lKey] : ''}`.trim();
      }
    }

    // Find best match for Phone
    let phone = '';
    const phoneKey = headers.find(h => /^(phone|phonenumber|phone[_\s]?number|mobile|mobile[_\s]?number|contact|contact[_\s]?number|tel|telephone|cell)$/i.test(h.trim()));
    if (phoneKey && raw[phoneKey]) {
      phone = raw[phoneKey].toString().trim();
    }

    // Clean and normalize Ghana phone number
    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.length === 10 && cleanPhone.startsWith('0')) {
      cleanPhone = '233' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 9) {
      cleanPhone = '233' + cleanPhone;
    }

    // Find best match for Email
    let email = '';
    const emailKey = headers.find(h => /^(email|email[_\s]?address|e-mail|mail)$/i.test(h.trim()));
    if (emailKey && raw[emailKey]) {
      email = raw[emailKey].trim().toLowerCase();
    }

    // Find best match for Company / Org
    let company = '';
    const compKey = headers.find(h => /^(company|organization|organisation|business|work)$/i.test(h.trim()));
    if (compKey && raw[compKey]) {
      company = raw[compKey].trim();
    }

    return {
      ...raw,
      full_name: fullName || raw.name || raw.Name || 'Guest',
      phone: cleanPhone || phone,
      email: email,
      company: company
    };
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        toast.error("CSV file is empty or invalid.");
        return;
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      setParsedHeaders(headers);

      const list = [];
      const preview = [];

      for (let i = 1; i < lines.length; i++) {
        // Simple CSV splitter handling basic quoted values
        const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length === 0 || cols.every(c => !c)) continue;

        const normalized = normalizeRow(headers, cols);
        list.push(normalized);
        if (preview.length < 5) {
          preview.push(normalized);
        }
      }

      setParsedRecipients(list);
      setRawPreviewRows(preview);

      // Auto-suggest list name from filename if empty
      if (!listName) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setListName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }

      toast.success(`Successfully parsed ${list.length} contacts!`);
    };
    reader.readAsText(file);
  };

  const stats = useMemo(() => {
    const totalContacts = parsedRecipients.length;
    const withPhone = parsedRecipients.filter(r => r.phone && r.phone.length >= 9).length;
    const withEmail = parsedRecipients.filter(r => r.email && r.email.includes('@')).length;
    return { totalContacts, withPhone, withEmail };
  }, [parsedRecipients]);

  const handleSave = async () => {
    if (!listName.trim()) {
      toast.error('Please provide a name for this list.');
      return;
    }
    if (parsedRecipients.length === 0) {
      toast.error('Please upload a CSV with at least one recipient.');
      return;
    }

    let resolvedEventName = '';
    if (selectedEventId === 'custom') {
      resolvedEventName = customEventName.trim();
    } else if (selectedEventId) {
      const exh = exhibitions.find(e => e.id === selectedEventId);
      resolvedEventName = exh ? exh.name : '';
    }

    const payload = {
      name: listName.trim(),
      event_id: selectedEventId || null,
      event_name: resolvedEventName || null,
      tag: listTag,
      headers: parsedHeaders,
      recipients: parsedRecipients,
      recipientCount: parsedRecipients.length,
      smsCount: stats.withPhone,
      emailCount: stats.withEmail,
      createdAt: new Date().toISOString()
    };

    await onSaveList(payload, syncToCustomers);
    
    setIsUploading(false);
    setListName('');
    setSelectedEventId('');
    setCustomEventName('');
    setListTag('Event Attendees');
    setParsedRecipients([]);
    setParsedHeaders([]);
    setRawPreviewRows([]);
  };

  // Filtered lists
  const filteredLists = useMemo(() => {
    return contactLists.filter(list => {
      const matchesSearch = (list.name || '').toLowerCase().includes(listSearch.toLowerCase()) ||
                            (list.event_name || '').toLowerCase().includes(listSearch.toLowerCase()) ||
                            (list.tag || '').toLowerCase().includes(listSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (filterCategory === 'events') {
        return !!list.event_name;
      }
      if (filterCategory === 'general') {
        return !list.event_name;
      }
      return true;
    });
  }, [contactLists, listSearch, filterCategory]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50/60 border border-[#ffa200]/30 rounded-2xl p-5 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#ffa200]" /> Event & Campaign Contact Lists
          </h2>
          <p className="text-xs text-gray-600 mt-0.5 font-medium">
            Upload attendees, trade expo leads, or VIP customers to send personalized SMS & Email campaigns in one click.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsUploading(true)}
          className="px-5 py-2.5 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Upload className="w-4 h-4" /> Upload Event / Contact List
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-full sm:w-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterCategory === 'all' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            All Lists ({contactLists.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('events')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${filterCategory === 'events' ? 'bg-white shadow-xs text-amber-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Event Lists ({contactLists.filter(l => l.event_name).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('general')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterCategory === 'general' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            General Lists ({contactLists.filter(l => !l.event_name).length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search saved lists..."
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:border-[#ffa200] outline-none"
          />
        </div>
      </div>

      {/* Upload Modal Drawer */}
      {isUploading && mounted && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsUploading(false);
              setParsedRecipients([]);
            }
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 overflow-hidden" 
          style={{ zIndex: 99999 }}
        >
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#ffa200]" /> Upload Event Contact List
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Upload a CSV file containing event leads, booth visitors, or attendees.</p>
              </div>
              <button 
                type="button"
                onClick={() => { setIsUploading(false); setParsedRecipients([]); }} 
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-xs font-medium">
              <div>
                <label className="text-gray-700 font-bold block mb-1">List Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Forty Under 40 Summit 2026 - Booth Attendees"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:border-[#ffa200] outline-none text-gray-800"
                />
              </div>

              {/* Event Link Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 font-bold block mb-1">Associate with Event (Optional)</label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:border-[#ffa200] outline-none text-gray-800 bg-white"
                  >
                    <option value="">-- Select Event / Exhibition --</option>
                    {exhibitions.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                    <option value="custom">✏️ Custom Event Name...</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-700 font-bold block mb-1">List Tag / Category</label>
                  <select
                    value={listTag}
                    onChange={(e) => setListTag(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:border-[#ffa200] outline-none text-gray-800 bg-white"
                  >
                    <option value="Event Attendees">Event Attendees</option>
                    <option value="VIP Leads">⭐ VIP Leads</option>
                    <option value="Tasting Booth Leads">🍯 Tasting Booth Leads</option>
                    <option value="Exhibitors & Partners">🤝 Exhibitors & Partners</option>
                    <option value="General Customers">👥 General Customers</option>
                  </select>
                </div>
              </div>

              {selectedEventId === 'custom' && (
                <div>
                  <label className="text-gray-700 font-bold block mb-1">Custom Event Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ghana Food & Beverages Expo 2026"
                    value={customEventName}
                    onChange={(e) => setCustomEventName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-amber-300 rounded-xl focus:border-[#ffa200] outline-none text-gray-800 bg-amber-50/30"
                  />
                </div>
              )}

              {/* Drag / File Box */}
              <div className="bg-gray-50/80 border-2 border-dashed border-gray-200 hover:border-[#ffa200] transition rounded-2xl p-6 text-center space-y-2">
                <Upload className="w-8 h-8 text-[#ffa200] mx-auto" />
                <p className="text-xs font-bold text-gray-800">
                  {parsedRecipients.length > 0 ? `${parsedRecipients.length} contacts loaded successfully` : 'Click below to choose a CSV file'}
                </p>
                <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                  Smart detection matches columns like <b>Name, Phone, Email, and Company</b>. Ghanaian numbers are automatically formatted for SMS!
                </p>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="mx-auto block text-xs cursor-pointer pt-2 text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#ffa200]/20 file:text-[#a05a00] hover:file:bg-[#ffa200]/30"
                />
              </div>

              {/* Real-time Parsed Stats & Preview Table */}
              {parsedRecipients.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-100/70 p-2.5 rounded-xl">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Rows</p>
                      <p className="text-sm font-black text-gray-900 mt-0.5">{stats.totalContacts}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-xl">
                      <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                        <Phone className="w-3 h-3" /> Ready for SMS
                      </p>
                      <p className="text-sm font-black text-emerald-800 mt-0.5">{stats.withPhone}</p>
                    </div>
                    <div className="bg-sky-50 border border-sky-200/60 p-2.5 rounded-xl">
                      <p className="text-[10px] text-sky-700 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                        <Mail className="w-3 h-3" /> Ready for Email
                      </p>
                      <p className="text-sm font-black text-sky-800 mt-0.5">{stats.withEmail}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">
                        {stats.totalContacts} Contacts Ready
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {stats.withPhone} SMS-ready • {stats.withEmail} Email-ready
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#ffa200] text-black">
                      Parsed Successfully
                    </span>
                  </div>

                  {/* Snippet preview table */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-gray-50 px-3 py-1.5 font-bold text-gray-500 text-[10px] uppercase border-b border-gray-200 flex justify-between">
                      <span>Preview (First 5 rows)</span>
                      <span>Total: {parsedRecipients.length}</span>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-36 overflow-y-auto">
                      {rawPreviewRows.map((r, idx) => (
                        <div key={idx} className="px-3 py-1.5 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-gray-900 truncate max-w-[140px]">{r.full_name}</span>
                          <span className="font-mono text-gray-600 truncate max-w-[120px]">{r.phone || '—'}</span>
                          <span className="text-gray-500 truncate max-w-[140px]">{r.email || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sync to customers checkbox */}
                  <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={syncToCustomers}
                      onChange={(e) => setSyncToCustomers(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#ffa200] focus:ring-[#ffa200] border-gray-300 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-gray-900 block">
                        Sync contacts to master Customers directory in Firebase
                      </span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        Enables POS cashiers to search these contacts by name or phone and associate orders.
                      </span>
                    </div>
                  </label>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setIsUploading(false); setParsedRecipients([]); }}
                      className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-5 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" /> Save {parsedRecipients.length} Contacts
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Contact Lists Grid */}
      {filteredLists.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-3xl p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#d07b00] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm">No contact lists found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Upload a spreadsheet of attendees or leads to easily send them targeted SMS updates and email newsletters.
          </p>
          <button
            type="button"
            onClick={() => setIsUploading(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> Upload First List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLists.map(list => {
            const hasEvent = !!list.event_name;
            const smsCount = list.smsCount || list.recipients?.filter(r => r.phone)?.length || 0;
            const emailCount = list.emailCount || list.recipients?.filter(r => r.email)?.length || 0;
            const total = list.recipientCount || list.recipients?.length || 0;

            return (
              <div 
                key={list.id} 
                onClick={() => { setViewingList(list); setContactSearch(''); }}
                className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition shadow-xs hover:shadow-md cursor-pointer group hover:-translate-y-0.5 ${
                  hasEvent ? 'border-amber-200/80 hover:border-[#ffa200]' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Badge Row */}
                  <div className="flex items-center justify-between gap-2">
                    {hasEvent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-[#a05a00] border border-amber-200/60 truncate max-w-[200px]">
                        {list.event_name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        📁 General List
                      </span>
                    )}

                    {list.tag && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
                        {list.tag}
                      </span>
                    )}
                  </div>

                  {/* Name & Stats */}
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-black text-gray-900 text-sm leading-snug group-hover:text-[#d07b00] transition-colors">{list.name}</h3>
                      <span className="text-[11px] font-semibold text-gray-400 group-hover:text-[#d07b00] transition-colors flex items-center gap-1 shrink-0">
                        <Eye className="w-3.5 h-3.5" /> View List
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 font-medium">
                      Uploaded {list.createdAt ? new Date(list.createdAt).toLocaleDateString() : 'Recently'}
                    </p>
                  </div>

                  {/* Channel Readiness Pills */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-gray-700 flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-400" /> {total} Contacts
                    </span>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center gap-1" title="Contacts with valid phone numbers">
                      <Phone className="w-3 h-3" /> {smsCount} SMS
                    </span>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 flex items-center gap-1" title="Contacts with email addresses">
                      <Mail className="w-3 h-3" /> {emailCount} Email
                    </span>
                  </div>
                </div>

                {/* Actions Row */}
                <div 
                  className="flex items-center gap-2 pt-4 mt-4 border-t border-gray-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartCampaignForList(list);
                    }}
                    className="flex-1 py-2 px-3 bg-[#ffa200] hover:bg-[#d07b00] text-black text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Send Campaign
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation();
                      setViewingList(list); 
                      setContactSearch(''); 
                    }}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                    title="View Contacts"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteList(list.id);
                    }} 
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition cursor-pointer"
                    title="Delete List"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Contacts Modal */}
      {viewingList && mounted && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingList(null);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 overflow-hidden" 
          style={{ zIndex: 99999 }}
        >
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 h-[88vh] max-h-[88vh] flex flex-col relative" style={{ zIndex: 100000 }}>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#ffa200]" /> {viewingList.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {viewingList.recipients?.length || 0} total contacts {viewingList.event_name && `• Linked to ${viewingList.event_name}`}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setViewingList(null)} 
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search within contacts */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search within this list by name, phone, email..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:border-[#ffa200] outline-none"
              />
            </div>

            {/* Contacts Table */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Phone (SMS)</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Company / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewingList.recipients || [])
                    .filter(r => {
                      const q = contactSearch.toLowerCase();
                      return (r.full_name || r.name || '').toLowerCase().includes(q) ||
                             (r.phone || '').includes(q) ||
                             (r.email || '').toLowerCase().includes(q) ||
                             (r.company || '').toLowerCase().includes(q);
                    })
                    .map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/60">
                        <td className="px-4 py-2 font-bold text-gray-900">{r.full_name || r.name || 'Guest'}</td>
                        <td className="px-4 py-2 font-mono text-gray-700">
                          {r.phone ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              <Phone className="w-2.5 h-2.5" /> {r.phone}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">No phone</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {r.email ? (
                            <span className="inline-flex items-center gap-1 text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full font-medium text-[10px]">
                              <Mail className="w-2.5 h-2.5" /> {r.email}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">No email</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500">{r.company || r.organization || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">
                {viewingList.recipients?.length || 0} total recipients
              </span>
              <button
                type="button"
                onClick={() => {
                  const targetList = viewingList;
                  setViewingList(null);
                  onStartCampaignForList(targetList);
                }}
                className="px-5 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" /> Launch Campaign for this List
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
