'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { 
  LayoutDashboard, 
  Calculator, 
  ShoppingCart, 
  Package, 
  Menu, 
  X, 
  DollarSign, 
  Users, 
  Megaphone, 
  Boxes, 
  Award, 
  Gift, 
  FileSpreadsheet, 
  Settings, 
  LogOut,
  FileText,
  ReceiptText,
  Newspaper,
  ShieldAlert
} from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();
  const { roles, user, logout } = useAuth();
  const [showDrawer, setShowDrawer] = useState(false);

  if (!user) return null; // Don't show bottom nav on unauthenticated pages

  const isDashboardActive = pathname === '/' || pathname === '/dashboard';

  const LEFT_TABS = [
    { name: 'Orders', href: '/orders', icon: ShoppingCart, perm: hasPermission(roles, 'order.view') },
    { name: 'POS', href: '/pos', icon: Calculator, perm: hasPermission(roles, 'sale.create') },
  ].filter(t => t.perm);

  const RIGHT_TABS = [
    { name: 'Inventory', href: '/inventory', icon: Package, perm: hasPermission(roles, 'stock.view') },
  ].filter(t => t.perm);

  const MORE_MENU_ITEMS = [
    { name: 'Invoices', href: '/invoices', icon: FileText, perm: hasPermission(roles, 'sale.view') },
    { name: 'Receipts', href: '/receipts', icon: ReceiptText, perm: hasPermission(roles, 'sale.view') },
    { name: 'Customers', href: '/customers', icon: Users, perm: hasPermission(roles, 'customer.view') },
    { name: 'Communications', href: '/communications', icon: Megaphone, perm: hasPermission(roles, 'customer.manage') },
    { name: 'Suppliers', href: '/suppliers', icon: Boxes, perm: hasPermission(roles, 'purchase.create') },
    { name: 'Events', href: '/exhibitions', icon: Award, perm: hasPermission(roles, 'exhibition.manage') },
    { name: 'Promos', href: '/promos', icon: Gift, perm: hasPermission(roles, 'promo.manage') },
    { name: 'Finances', href: '/finances', icon: DollarSign, perm: hasPermission(roles, 'purchase.create') || hasPermission(roles, 'expense.manage') },
    { name: 'Reports', href: '/reports', icon: FileSpreadsheet, perm: hasPermission(roles, 'report.view') },
    { name: 'Audit Logs', href: '/logs', icon: ShieldAlert, perm: true },
    { name: 'Blog & News', href: '/blog', icon: Newspaper, perm: hasPermission(roles, 'blog.manage') || hasPermission(roles, 'settings.manage') },
    { name: 'Settings', href: '/settings/users', icon: Settings, perm: hasPermission(roles, 'settings.manage') },
  ].filter(item => item.perm);

  return (
    <>
      {/* Slide-Up Navigation Drawer (Full Menu) */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowDrawer(false)} 
          />
          <div className="relative bg-white rounded-t-[32px] p-6 max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl z-10 animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center p-1.5 shadow-sm">
                  <img 
                    src="/assets/honey-palace-logo.png" 
                    alt="Honey Palace Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base leading-none">The Honey Palace</h3>
                  <p className="text-xs text-neutral-400 mt-1">{user?.full_name || 'Staff Member'}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDrawer(false)}
                className="p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              {MORE_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowDrawer(false)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center ${
                      isActive 
                        ? 'bg-[#ececec] border-neutral-300 text-neutral-900 font-semibold' 
                        : 'bg-[#fbf9fe] border-neutral-200/80 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div className={`p-2 rounded-xl mb-1.5 ${isActive ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 shadow-xs'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold tracking-tight line-clamp-1">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Logout Button */}
            <div className="pt-2 border-t border-neutral-100">
              <button
                onClick={() => {
                  setShowDrawer(false);
                  logout();
                }}
                className="w-full py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Capsule (Mobile Ergonomic Thumb-Zone Architecture) */}
      <div className="fixed bottom-3 left-3 right-3 z-40 bg-white/95 backdrop-blur-2xl border border-neutral-200/90 rounded-2xl px-2 py-2 flex items-center justify-between md:hidden shadow-lg font-sans">
        
        {/* Left Navigation Items */}
        <div className="flex items-center justify-around flex-1">
          {LEFT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                  isActive ? 'text-neutral-900 font-semibold' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-[#ececec] text-neutral-900 scale-105' : 'bg-transparent text-neutral-500'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[9px] font-medium mt-0.5 whitespace-nowrap ${isActive ? 'text-neutral-900 font-semibold' : 'text-neutral-500'}`}>
                  {tab.name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Elevated Center Hero Action Button (Dashboard / Central Command) */}
        <div className="relative -top-5 px-1 shrink-0">
          <Link
            href="/"
            className={`flex flex-col items-center group cursor-pointer transition-all ${
              isDashboardActive ? 'scale-110' : 'hover:scale-105 active:scale-95'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center ring-4 ring-white shadow-md relative transition-all">
              <LayoutDashboard className={`w-5 h-5 text-white transition-transform duration-300 ${isDashboardActive ? 'scale-110' : 'group-hover:scale-110'}`} />
            </div>
            <span className={`text-[10px] font-semibold tracking-tight mt-1 transition-all ${
              isDashboardActive ? 'text-neutral-900 font-bold' : 'text-neutral-600 group-hover:text-neutral-900'
            }`}>
              Dashboard
            </span>
          </Link>
        </div>

        {/* Right Navigation Items */}
        <div className="flex items-center justify-around flex-1">
          {RIGHT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                  isActive ? 'text-neutral-900 font-semibold' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-[#ececec] text-neutral-900 scale-105' : 'bg-transparent text-neutral-500'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[9px] font-medium mt-0.5 whitespace-nowrap ${isActive ? 'text-neutral-900 font-semibold' : 'text-neutral-500'}`}>
                  {tab.name}
                </span>
              </Link>
            );
          })}

          {/* More Menu Drawer Trigger */}
          <button
            onClick={() => setShowDrawer(true)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
              showDrawer ? 'text-neutral-900 font-semibold' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${showDrawer ? 'bg-[#ececec] text-neutral-900 scale-105' : 'bg-transparent text-neutral-500'}`}>
              <Menu className="w-4 h-4" />
            </div>
            <span className={`text-[9px] font-medium mt-0.5 whitespace-nowrap ${showDrawer ? 'text-neutral-900 font-semibold' : 'text-neutral-500'}`}>
              More
            </span>
          </button>
        </div>

      </div>
    </>
  );
}
