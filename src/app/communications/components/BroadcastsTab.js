import React from 'react';
import { Search, Plus, MessageSquare, Clock, Users, Eye, RotateCcw, FilePlus, Send } from 'lucide-react';

export default function BroadcastsTab({ 
  announcements, 
  customers, 
  search, 
  setSearch, 
  setShowComposer,
  liveBalance,
  onCancelScheduled,
  onPreviewBroadcast,
  onEditAndResend,
  onSaveAsTemplate,
  onSendScheduledNow
}) {
  const filtered = announcements.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.subject?.toLowerCase().includes(s) || a.message?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-row items-center gap-3 w-full sm:w-auto sm:ml-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-[#d07b00]/15 bg-white text-sm w-full sm:w-56 focus:outline-none focus:ring-1 focus:ring-[#ffa200]"
            />
          </div>
          <button
            onClick={() => setShowComposer(true)}
            className="px-4 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold rounded-xl text-sm flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> New Broadcast
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-white border border-[#d07b00]/10 rounded-xl p-3 md:p-4 min-w-0 shadow-2xs">
          <p className="text-[10px] md:text-xs text-text-muted-dark font-medium truncate">Total Sent</p>
          <p className="text-lg md:text-2xl font-bold text-black mt-0.5 truncate">{announcements.filter(a => a.status === 'sent').length}</p>
        </div>
        <div className="bg-white border border-[#d07b00]/10 rounded-xl p-3 md:p-4 min-w-0 shadow-2xs">
          <p className="text-[10px] md:text-xs text-text-muted-dark font-medium truncate">Total Customers</p>
          <p className="text-lg md:text-2xl font-bold text-[#ffa200] mt-0.5 truncate">{customers.length}</p>
        </div>
        <div className="bg-white border border-[#d07b00]/10 rounded-xl p-3 md:p-4 min-w-0 shadow-2xs">
          <p className="text-[10px] md:text-xs text-text-muted-dark font-medium truncate">With Email</p>
          <p className="text-lg md:text-2xl font-bold text-blue-600 mt-0.5 truncate">{customers.filter(c => c.email).length}</p>
        </div>
        <div className="bg-white border border-[#d07b00]/10 rounded-xl p-3 md:p-4 min-w-0 shadow-2xs">
          <p className="text-[10px] md:text-xs text-text-muted-dark font-medium truncate">Scheduled</p>
          <p className="text-lg md:text-2xl font-bold text-purple-600 mt-0.5 truncate">{announcements.filter(a => a.status === 'scheduled').length}</p>
        </div>
        <div className="bg-white border border-[#d07b00]/10 rounded-xl p-3 md:p-4 min-w-0 shadow-2xs">
          <p className="text-[10px] md:text-xs text-text-muted-dark font-medium truncate">SMS Credits</p>
          <p className={`text-lg md:text-2xl font-bold mt-0.5 truncate ${
            liveBalance === null ? 'text-gray-400' : liveBalance > 50 ? 'text-emerald-600' : liveBalance > 10 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {liveBalance !== null ? liveBalance.toLocaleString() : '—'}
          </p>
        </div>
      </div>


      {/* Announcement History */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#d07b00]/10 rounded-2xl">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-text-muted-dark font-medium">No announcements found.</p>
          <p className="text-xs text-text-muted-dark mt-1">Start a broadcast to reach your customers.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ann) => (
            <div key={ann.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#ffa200]/30 transition-all shadow-xs">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-bold text-black text-base">{ann.subject}</h3>
                    
                    {/* Status Badge */}
                    {ann.status === 'scheduled' ? (
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        ann.scheduledFor && new Date(ann.scheduledFor) <= new Date()
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {ann.scheduledFor && new Date(ann.scheduledFor) <= new Date() ? 'Due to Send' : 'Scheduled'}
                      </span>
                    ) : ann.status === 'processing' ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">
                        Sending...
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#ffa200]/15 text-[#D07B00]">
                        Sent
                      </span>
                    )}

                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${ann.channel === 'email' ? 'bg-blue-100 text-blue-600' : ann.channel === 'sms' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'}`}>
                      {ann.channel === 'both' ? 'Email + SMS' : ann.channel?.toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${ann.audience === 'wholesale' ? 'bg-amber-100 text-amber-700' : ann.audience === 'retail' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-700'}`}>
                      {ann.audienceName || (ann.audience === 'all' ? 'All Customers' : ann.audience === 'csv' ? 'CSV List' : ann.audience)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3 leading-relaxed">{ann.message}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> 
                      {ann.status === 'scheduled' 
                        ? `Scheduled for: ${new Date(ann.scheduledFor).toLocaleString('en-GB')}` 
                        : (ann.sentAt || ann.createdAt)
                          ? `Sent: ${new Date(ann.sentAt || ann.createdAt).toLocaleString('en-GB')}`
                          : 'Sent'}
                    </span>
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gray-400" /> {ann.recipientCount || 0} recipients</span>
                    <span>by {ann.sentBy || 'Admin'}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 flex-shrink-0">
                  {ann.status === 'scheduled' && onSendScheduledNow && (
                    <button
                      onClick={() => onSendScheduledNow(ann.id)}
                      className="px-3 py-1.5 text-xs font-bold text-black bg-[#ffa200] hover:bg-[#d07b00] rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Dispatch this scheduled broadcast now"
                    >
                      <Send className="w-3.5 h-3.5" /> Send Now
                    </button>
                  )}

                  {onPreviewBroadcast && (
                    <button
                      onClick={() => onPreviewBroadcast(ann)}
                      className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center gap-1.5 border border-gray-200 cursor-pointer"
                      title="Preview announcement details"
                    >
                      <Eye className="w-3.5 h-3.5 text-gray-500" /> Preview
                    </button>
                  )}

                  {onEditAndResend && (
                    <button
                      onClick={() => onEditAndResend(ann)}
                      className="px-3 py-1.5 text-xs font-bold text-[#d07b00] bg-[#ffa200]/15 hover:bg-[#ffa200]/25 rounded-xl transition flex items-center gap-1.5 border border-[#ffa200]/20 cursor-pointer"
                      title="Edit and resend message"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#d07b00]" /> Resend
                    </button>
                  )}

                  {onSaveAsTemplate && (
                    <button
                      onClick={() => onSaveAsTemplate(ann)}
                      className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition flex items-center gap-1.5 border border-gray-200 cursor-pointer"
                      title="Save message as reusable template"
                    >
                      <FilePlus className="w-3.5 h-3.5 text-gray-500" /> Template
                    </button>
                  )}

                  {ann.status === 'scheduled' && onCancelScheduled && (
                    <button 
                      onClick={() => onCancelScheduled(ann.id)}
                      className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

