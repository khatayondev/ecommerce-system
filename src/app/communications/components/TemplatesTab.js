import React, { useState } from 'react';
import { FileText, Plus, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TemplatesTab({ templates, onSaveTemplate, onDeleteTemplate }) {
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', subject: '', message: '' });

  const handleEdit = (t) => {
    setEditingTemplate(t);
    setForm({ name: t.name, subject: t.subject, message: t.message });
  };

  const handleCreate = () => {
    setEditingTemplate({ id: 'new' });
    setForm({ name: '', subject: '', message: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error('All fields are required');
      return;
    }
    
    await onSaveTemplate({
      id: editingTemplate.id === 'new' ? null : editingTemplate.id,
      ...form
    });
    setEditingTemplate(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-black flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#ffa200]" /> Message Templates
        </h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Template
        </button>
      </div>

      {editingTemplate && (
        <div className="bg-white border border-[#d07b00]/20 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-black">{editingTemplate.id === 'new' ? 'New Template' : 'Edit Template'}</h3>
            <button onClick={() => setEditingTemplate(null)} className="text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Template Name (Internal)</label>
              <input
                type="text"
                required
                placeholder="e.g. Christmas Promo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Merry Christmas!"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Message Body</label>
              <textarea
                required
                rows={4}
                placeholder="Write the template message here..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-5 py-2 bg-[#ffa200] hover:bg-[#d07b00] text-black font-bold rounded-xl text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Template
              </button>
            </div>
          </form>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#d07b00]/10 rounded-2xl">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-text-muted-dark font-medium">No templates saved yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#ffa200]/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-black">{t.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(t)} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold px-2 py-1 bg-blue-50 rounded">Edit</button>
                  <button onClick={() => onDeleteTemplate(t.id)} className="text-red-600 hover:text-red-800 text-[11px] font-bold px-2 py-1 bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-1">Subject: {t.subject}</p>
              <p className="text-sm text-gray-600 line-clamp-2">{t.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
