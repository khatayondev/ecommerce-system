'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '@/context/UIContext';
import { AlertCircle, Trash2 } from 'lucide-react';

export default function GlobalConfirmModal() {
  const { confirmConfig } = useUI();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText,
    cancelText,
    isDestructive,
  } = confirmConfig;

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 no-scrollbar"
      style={{ zIndex: 2147483640, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel();
      }}
    >
      <div 
        className="bg-white border-2 border-gray-100 p-6 rounded-3xl w-full max-w-sm space-y-4 text-sm text-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200 no-scrollbar"
        style={{ zIndex: 2147483641, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2.5 ${isDestructive ? 'text-red-600' : 'text-gray-900'}`}>
          {isDestructive ? (
            <span className="p-2 bg-red-50 text-red-600 rounded-xl border border-red-100 shrink-0">
              <Trash2 className="w-5 h-5" />
            </span>
          ) : (
            <span className="p-2 bg-amber-50 text-[#d07b00] rounded-xl border border-amber-100 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </span>
          )}
          <span>{title}</span>
        </h3>
        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs sm:text-sm font-semibold border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 text-xs sm:text-sm rounded-xl font-bold shadow-md transition cursor-pointer ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-[#ffa200] text-black hover:bg-[#d07b00]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
