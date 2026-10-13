import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Users, Mail, MessageSquare, RotateCcw, FilePlus, UserCheck, Calendar, Send } from 'lucide-react';

const emptySubscribe = () => () => {};

export default function BroadcastPreviewModal({
  announcement,
  onClose,
  onEditAndResend,
  onSaveAsTemplate,
  onSendScheduledNow
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Lock background scroll and handle Escape key
  useEffect(() => {
    if (!announcement) return;
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
  }, [announcement, onClose]);

  if (!announcement || !mounted) return null;

  return createPortal(
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 overflow-hidden" 
      style={{ zIndex: 99999 }}
    >
      <div className="bg-white border border-gray-200 p-6 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col h-[90vh] max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#ffa200]/10 rounded-xl text-[#d07b00]">
              {announcement.channel === 'sms' ? (
                <MessageSquare className="w-5 h-5" />
              ) : (
                <Mail className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Broadcast Details</h3>
              <p className="text-xs text-gray-500 font-medium">Review announcement parameters</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-grow space-y-5 pr-1 text-sm custom-scrollbar">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Status</span>
              <span className={`inline-block mt-0.5 text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                announcement.status === 'scheduled' 
                  ? (announcement.scheduledFor && new Date(announcement.scheduledFor) <= new Date()
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-yellow-100 text-yellow-700')
                  : 'bg-[#ffa200]/15 text-[#D07B00]'
              }`}>
                {announcement.status === 'scheduled' 
                  ? (announcement.scheduledFor && new Date(announcement.scheduledFor) <= new Date() ? 'Due to Send' : 'Scheduled')
                  : 'Sent'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Channel</span>
              <span className="inline-block mt-0.5 text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">
                {announcement.channel === 'both' ? 'Email + SMS' : announcement.channel?.toUpperCase()}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Audience</span>
              <span className="text-xs font-bold text-gray-800 mt-0.5 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#d07b00]" />
                {announcement.audience === 'all' ? 'All Customers' : 
                 announcement.audience === 'wholesale' ? 'Wholesale Only' : 
                 announcement.audience === 'retail' ? 'Retail Only' : 
                 announcement.audienceName || announcement.audience}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Recipients</span>
              <span className="text-xs font-bold text-gray-800 mt-0.5 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                {announcement.recipientCount || 0} Contacts
              </span>
            </div>

            <div className="col-span-2 pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {announcement.status === 'scheduled' 
                  ? `Scheduled: ${new Date(announcement.scheduledFor).toLocaleString('en-GB')}` 
                  : (announcement.sentAt || announcement.createdAt)
                    ? `Sent: ${new Date(announcement.sentAt || announcement.createdAt).toLocaleString('en-GB')}`
                    : 'Sent'}
              </span>
              <span>By {announcement.sentBy || 'Admin'}</span>
            </div>
          </div>

          {/* Subject / Header */}
          <div>
            <label className="text-xs text-gray-500 font-bold block mb-1">Subject / Header</label>
            <div className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900">
              {announcement.subject}
            </div>
          </div>

          {/* Message Body */}
          <div>
            <label className="text-xs text-gray-500 font-bold block mb-1">Message Content</label>
            <div className="w-full p-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 whitespace-pre-wrap leading-relaxed min-h-[140px] font-sans">
              {announcement.message}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row gap-2.5 flex-shrink-0 border-t border-gray-100 mt-4">
          {announcement.status === 'scheduled' && onSendScheduledNow && (
            <button
              type="button"
              onClick={() => onSendScheduledNow(announcement.id)}
              className="flex-1 py-2.5 px-4 bg-[#ffa200] hover:bg-[#d07b00] text-black font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" /> Send Now
            </button>
          )}

          <button
            type="button"
            onClick={() => onSaveAsTemplate(announcement)}
            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-gray-200 cursor-pointer"
          >
            <FilePlus className="w-4 h-4 text-gray-600" /> Save as Template
          </button>
          
          <button
            type="button"
            onClick={() => onEditAndResend(announcement)}
            className="flex-1 py-2.5 px-4 bg-[#ffa200]/15 hover:bg-[#ffa200]/25 text-[#d07b00] font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-[#ffa200]/20 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Edit & Resend
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
