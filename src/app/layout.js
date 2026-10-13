'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { AuthProvider } from "@/context/AuthContext";
import { StoreSettingsProvider } from "@/context/StoreSettingsContext";
import { UIProvider } from '@/context/UIContext';
import GlobalConfirmModal from '@/components/GlobalConfirmModal';
import { Toaster } from 'react-hot-toast';
import AuthShield from "@/components/AuthShield";
import TopNav from "@/components/TopNav";
import PwaRegister from "@/components/PwaRegister";
import MobileNav from "@/components/MobileNav";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import StagingBanner from "@/components/StagingBanner";


export default function RootLayout({ children }) {
  const pathname = usePathname();
  const isPublicPage = pathname === '/login';

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePrompt = (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  return (
    <html lang="en" className="h-full antialiased font-sans" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffa200" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full bg-bg-light text-[#111111] font-sans h-screen overflow-hidden flex flex-col" suppressHydrationWarning>
        <StagingBanner />
        <PwaRegister />
        <PwaInstallBanner />
        <AuthProvider>
          <StoreSettingsProvider>
            <UIProvider>
              <AuthShield>
                {isPublicPage ? (
                  <main className="w-full h-full overflow-y-auto login-page-main">
                    {children}
                  </main>
                ) : (
                  <div className="flex gap-2 md:gap-4 p-2 md:p-4 h-screen w-screen overflow-hidden bg-bg-light">
                    <Sidebar />
                    <main className="flex-1 h-full flex flex-col overflow-hidden bg-transparent rounded-2xl">
                      <TopNav />
                      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-36 md:pb-0">
                        {children}
                      </div>
                    </main>
                    <MobileNav />
                  </div>
                )}
              </AuthShield>
              <GlobalConfirmModal />
              <Toaster 
                position="bottom-right"
                containerClassName="toast-container-always-on-top"
                containerStyle={{
                  zIndex: 2147483647,
                }}
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#1A1C23',
                    color: '#fff',
                    border: '1px solid rgba(255,162,0,0.15)',
                    zIndex: 2147483647,
                  },
                  success: {
                    iconTheme: {
                      primary: '#FFD700',
                      secondary: '#000',
                    },
                  },
                }}
              />
            </UIProvider>
          </StoreSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
