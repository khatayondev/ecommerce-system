'use client';

import React from 'react';
import { Database, AlertTriangle } from 'lucide-react';

export default function StagingBanner() {
  const isStaging = 
    process.env.NEXT_PUBLIC_USE_STAGING_FIREBASE === 'true' || 
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

  if (!isStaging) return null;

  return (
    <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-black text-[11px] font-bold px-3 py-1 text-center flex items-center justify-center gap-2 shadow-sm border-b border-amber-400/40 shrink-0 z-[9999]">
      <Database className="w-3.5 h-3.5 text-black animate-pulse shrink-0" />
      <span>STAGING ENVIRONMENT</span>
      <span className="opacity-60">•</span>
      <span className="font-mono bg-black/15 px-1.5 py-0.5 rounded text-[10px]">
        Project: thehoneypalace-staging
      </span>
      <span className="opacity-60">•</span>
      <span className="hidden sm:inline font-medium">Safe testing mode (live production database protected)</span>
    </div>
  );
}
