import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X, Search, Mail, MessageSquare, AlertCircle, CheckCircle2, UserCheck, Users, Send, Clock, ChevronRight, Zap, AlertTriangle } from 'lucide-react';

const emptySubscribe = () => () => {};

export default function BroadcastConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  payload,
  sending,
  liveBalance = null
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndices, setSelectedIndices] = useState(() => new Set());
  const [agreedCredits, setAgreedCredits] = useState(false);

  const [prevPayload, setPrevPayload] = useState(payload);
  if (payload !== prevPayload) {
    setPrevPayload(payload);
    if (isOpen && payload?.recipientsData) {
      setSelectedIndices(new Set(payload.recipientsData.map((_, i) => i)));
      setSearchTerm('');
      setAgreedCredits(false);
    }
  }

  // Lock background scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  if (!isOpen || !payload || !mounted || typeof document === 'undefined') return null;

  const { subject = '', message = '', channel = 'sms', audience = 'all', status = 'sent', scheduledFor = null, recipientsData = [] } = payload;

  // Toggle single recipient check
  const toggleRecipient = (index) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedIndices.size === recipientsData.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(recipientsData.map((_, i) => i)));
    }
  };

  // Filtered recipient list for search
  const filteredRecipients = recipientsData.filter((r, idx) => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return true;
    const name = (r.full_name || r.name || '').toLowerCase();
    const email = (r.email || '').toLowerCase();
    const phone = (r.phone || '').toLowerCase();
    return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower);
  });

  const activeRecipientsList = recipientsData.filter((_, i) => selectedIndices.has(i));
  const activeSmsCount = activeRecipientsList.filter(r => r.phone).length;
  const activeEmailCount = activeRecipientsList.filter(r => r.email).length;

  // Calculate SMS segments & credits accurately
  const isSmsChannel = channel === 'sms' || channel === 'both';
  const charCount = message ? message.length : 0;
  const estimatedSmsSegments = charCount === 0 ? 0 : charCount <= 160 ? 1 : Math.ceil(charCount / 153);
  const totalSmsUnits = isSmsChannel ? (activeSmsCount * estimatedSmsSegments) : 0;
  const isBalanceInsufficient = liveBalance !== null && isSmsChannel && totalSmsUnits > liveBalance;
  const remainingBalance = liveBalance !== null && isSmsChannel ? (liveBalance - totalSmsUnits) : null;
  const canConfirm = !sending && activeRecipientsList.length > 0 && (!isSmsChannel || totalSmsUnits === 0 || agreedCredits);

  // Render message preview for a sample recipient
  const sampleRecipient = activeRecipientsList[0] || { full_name: 'Jane Doe', email: 'jane.doe@example.com', phone: '+233 55 123 4567' };
  const sampleMessage = (message || '')
    .replace(/\{\{Name\}\}/gi, sampleRecipient.full_name || sampleRecipient.name || 'Jane Doe')
    .replace(/\{\{Email\}\}/gi, sampleRecipient.email || 'jane.doe@example.com')
    .replace(/\{\{Phone\}\}/gi, sampleRecipient.phone || '+233 55 123 4567')
    .replace(/\{\{Date\}\}/gi, new Date().toLocaleDateString());

  const handleFinalConfirm = () => {
    if (activeRecipientsList.length === 0) {
      alert('Please select at least one recipient to receive this broadcast.');
      return;
    }
    onConfirm({
      ...payload,
      recipientCount: activeRecipientsList.length,
      recipientsData: activeRecipientsList
    });
  };

  return createPortal(
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 overflow-hidden" 
      style={{ zIndex: 99999 }}
    >
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-[92vh] max-h-[92vh] overflow-hidden">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#1c1917] to-[#292524] text-white px-6 py-5 flex items-center justify-between flex-shrink-0 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ffa200]/20 border border-[#ffa200]/40 flex items-center justify-center text-[#ffa200]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-white">Review & Confirm Broadcast</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#ffa200] text-black">
                  {status === 'scheduled' ? 'Scheduled' : 'Live Ready'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium">Verify recipient contacts and message layout before dispatching.</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 text-sm custom-scrollbar bg-gray-50/50">
          
          {/* Summary Badges & Delivery Specs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Channel Info */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className={`p-3 rounded-xl ${channel === 'sms' ? 'bg-emerald-50 text-emerald-600' : channel === 'email' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                {channel === 'sms' ? <MessageSquare className="w-5 h-5" /> : channel === 'email' ? <Mail className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Channel</span>
                <span className="text-sm font-extrabold text-gray-900 capitalize">
                  {channel === 'both' ? 'Email + SMS' : channel.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Recipients Summary */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Selected Audience</span>
                <span className="text-sm font-extrabold text-gray-900">
                  {activeRecipientsList.length} of {recipientsData.length} Contacts
                </span>
              </div>
            </div>

            {/* Delivery Schedule */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Timing</span>
                <span className="text-sm font-extrabold text-gray-900">
                  {status === 'scheduled' && scheduledFor ? new Date(scheduledFor).toLocaleString() : 'Immediate Dispatch'}
                </span>
              </div>
            </div>

          </div>

          {/* Message Content Review */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#ffa200]" /> Message Content
              </h4>
              
              {(channel === 'sms' || channel === 'both') && (
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {charCount} chars • ~{estimatedSmsSegments} SMS segment(s)/contact (Total ~{totalSmsUnits} SMS)
                </span>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">SUBJECT / TITLE</label>
              <div className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold text-sm">
                {subject}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">LIVE SAMPLE PREVIEW (Personalized for {sampleRecipient.full_name || sampleRecipient.name || 'Recipient'})</label>
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-gray-800 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                {sampleMessage}
              </div>
            </div>
          </div>

          {/* Recipient Contacts List & Search */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#ffa200]" /> Target Recipients ({activeRecipientsList.length})
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">Review phone numbers and email addresses. You can uncheck contacts to exclude them.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 border border-gray-200 hover:border-gray-400 rounded-xl text-xs font-bold text-gray-700 transition bg-gray-50"
                >
                  {selectedIndices.size === recipientsData.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search recipient by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#ffa200]"
              />
            </div>

            {/* Recipient List Table / Cards */}
            <div className="max-h-[260px] overflow-y-auto border border-gray-100 rounded-xl custom-scrollbar divide-y divide-gray-100">
              {filteredRecipients.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs italic">
                  No contacts found matching &quot;{searchTerm}&quot;.
                </div>
              ) : (
                filteredRecipients.map((recipient, originalIdx) => {
                  const actualIdx = recipientsData.indexOf(recipient);
                  const isChecked = selectedIndices.has(actualIdx);

                  return (
                    <div 
                      key={actualIdx}
                      onClick={() => toggleRecipient(actualIdx)}
                      className={`p-3.5 flex items-center justify-between gap-4 transition cursor-pointer hover:bg-orange-50/40 ${isChecked ? 'bg-white' : 'bg-gray-50/80 opacity-60'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div onClick
                          className="w-4 h-4 rounded text-[#ffa200] focus:ring-[#ffa200] border-gray-300 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-xs truncate">
                              {recipient.full_name || recipient.name || 'Valued Customer'}
                            </span>
                            {recipient.customer_type && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold">
                                {recipient.customer_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contact Badges */}
                      <div className="flex items-center gap-3 text-xs flex-shrink-0">
                        {(channel === 'sms' || channel === 'both') && (
                          <div className={`flex items-center gap-1 font-mono text-[11px] px-2.5 py-1 rounded-lg border ${recipient.phone ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                            <MessageSquare className="w-3 h-3" />
                            <span>{recipient.phone || 'No Phone'}</span>
                          </div>
                        )}

                        {(channel === 'email' || channel === 'both') && (
                          <div className={`flex items-center gap-1 font-mono text-[11px] px-2.5 py-1 rounded-lg border ${recipient.email ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{recipient.email || 'No Email'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Counter Bar */}
            <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
              <span>Sending via <strong className="text-gray-900">{channel === 'both' ? 'Email & SMS' : channel.toUpperCase()}</strong></span>
              <span className="font-semibold text-gray-700">
                {activeSmsCount} SMS Target(s) • {activeEmailCount} Email Target(s)
              </span>
            </div>

          </div>

          {/* SMS Credit Agreement Card */}
          {isSmsChannel && totalSmsUnits > 0 && (
            <div className={`rounded-2xl border-2 p-5 space-y-4 shadow-sm transition ${
              agreedCredits 
                ? 'bg-amber-500/10 border-[#ffa200]' 
                : 'bg-amber-50/70 border-amber-300'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#ffa200]/20 flex items-center justify-center text-[#d07b00]">
                    <Zap className="w-4 h-4 text-[#d07b00]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-900">
                      SMS Credit Deduction Summary
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Arkesel SMS Gateway charges 1 credit per 160 characters per recipient
                    </p>
                  </div>
                </div>

                <span className="font-mono text-xs font-black px-3 py-1 rounded-full bg-[#ffa200] text-black shadow-2xs">
                  {totalSmsUnits} Credits Required
                </span>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Available Balance</span>
                  <span className="text-base font-extrabold text-gray-900">
                    {liveBalance !== null ? `${liveBalance.toLocaleString()}` : '—'}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Will Deduct</span>
                  <span className="text-base font-extrabold text-amber-600 font-mono">
                    -{totalSmsUnits.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Balance After Send</span>
                  <span className={`text-base font-extrabold font-mono ${
                    remainingBalance !== null && remainingBalance < 0
                      ? 'text-rose-600 font-black'
                      : 'text-emerald-600'
                  }`}>
                    {remainingBalance !== null ? `${remainingBalance.toLocaleString()}` : '—'}
                  </span>
                </div>
              </div>

              {isBalanceInsufficient && (
                <div className="flex items-start gap-2.5 p-3 bg-rose-100/90 border border-rose-300 rounded-xl text-xs text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Warning: Low Arkesel SMS Balance.</strong> This send requires <strong>{totalSmsUnits} credits</strong>, but only <strong>{liveBalance} credits</strong> are currently available on your account. Some recipients may fail to deliver unless balance is topped up.
                  </span>
                </div>
              )}

              {/* Explicit Mandatory Agreement Checkbox */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition select-none ${
                agreedCredits 
                  ? 'bg-white border-[#ffa200] shadow-xs' 
                  : 'bg-white/80 border-gray-200 hover:border-amber-300'
              }`}>
                <input
                  type="checkbox"
                  checked={agreedCredits}
                  onChange={(e) => setAgreedCredits(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#ffa200] focus:ring-[#ffa200] border-gray-300 cursor-pointer"
                />
                <div className="text-xs text-gray-800 leading-relaxed">
                  <span className="font-extrabold text-gray-900">I confirm and agree</span> to consume <strong className="text-amber-700 font-mono">{totalSmsUnits} SMS credit(s)</strong> from our Arkesel balance for {activeSmsCount} recipient(s) ({estimatedSmsSegments} segment{estimatedSmsSegments === 1 ? '' : 's'}/contact).
                </div>
              </label>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="bg-white border-t border-gray-100 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Back to Edit
          </button>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
            {isSmsChannel && totalSmsUnits > 0 && !agreedCredits && (
              <span className="text-xs text-amber-700 font-bold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 text-center">
                Please check the credit agreement above to proceed
              </span>
            )}
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleFinalConfirm}
              className="w-full sm:w-auto px-6 py-3 bg-[#ffa200] hover:bg-[#d07b00] text-black font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shadow-orange-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <span>Dispatching...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    Confirm & {status === 'scheduled' ? 'Schedule' : 'Dispatch'} to {activeRecipientsList.length} Contacts
                    {isSmsChannel && totalSmsUnits > 0 ? ` (${totalSmsUnits} SMS Credits)` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>


      </div>
    </div>,
    document.body
  );
}
