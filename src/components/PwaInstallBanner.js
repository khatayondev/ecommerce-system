import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode (already installed)
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent || '';
    const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    setIsIOS(isAppleMobile);

    const dismissed = localStorage.getItem('thp_pwa_banner_dismissed');
    if (dismissed) return;

    // Check if the global listener already captured the prompt
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
    }

    // Always show the banner if not installed and not dismissed
    setShowBanner(true);

    if (!isAppleMobile) {
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        window.deferredPrompt = e;
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      console.log(`[PWA] User response to install prompt: ${outcome}`);
      setDeferredPrompt(null);
      window.deferredPrompt = null;
      setShowBanner(false);
    } else {
      // Fallback manual instructions for Chrome/Android if prompt event has not fired yet
      toast.success("To Install: Tap the browser menu (three dots ⋮) and select 'Add to Home screen' or 'Install App'!", {
        duration: 6000,
        icon: '📲'
      });
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('thp_pwa_banner_dismissed', 'true');
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-3 left-3 right-3 z-50 md:hidden animate-in slide-in-from-top duration-300">
      <div className="bg-black text-white p-4 rounded-2xl border border-white/10 shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 p-1.5 flex items-center justify-center flex-shrink-0">
            <img 
              src="/assets/honey-palace-logo.png" 
              alt="Honey Palace Icon"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h4 className="font-bold text-xs text-white leading-tight">Install Honey Palace App</h4>
            <p className="text-[10px] text-white/60">
              {isIOS 
                ? "Tap the Share button below and select 'Add to Home Screen' to enable notifications"
                : "Add to home screen for offline access and alerts"
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isIOS && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ffa200] hover:bg-[#e08f00] text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-sm whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              Install
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="p-1 text-white/50 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
