'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Boxes,
  Calculator,
  Award,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  FileText,
  ReceiptText,
  Megaphone,
  Gift,
  DollarSign,
  Settings,
  Newspaper,
  ShieldAlert,
  LogOut
} from 'lucide-react';

const MENU_ITEMS = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { roles, user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const displayMenuItems = [...MENU_ITEMS];

  if (hasPermission(roles, 'sale.create')) {
    displayMenuItems.push({ name: 'Point of Sale', href: '/pos', icon: Calculator });
  }

  if (hasPermission(roles, 'order.view')) {
    displayMenuItems.push({ name: 'Online Orders', href: '/orders', icon: ShoppingCart });
  }

  if (hasPermission(roles, 'sale.view')) {
    displayMenuItems.push({ name: 'Invoices', href: '/invoices', icon: FileText });
    displayMenuItems.push({ name: 'Receipts', href: '/receipts', icon: ReceiptText });
  }

  if (hasPermission(roles, 'customer.view')) {
    displayMenuItems.push({ name: 'Customers', href: '/customers', icon: Users });
  }

  if (hasPermission(roles, 'customer.manage')) {
    displayMenuItems.push({ name: 'Communications', href: '/communications', icon: Megaphone });
  }

  if (hasPermission(roles, 'stock.view')) {
    displayMenuItems.push({ name: 'Inventory', href: '/inventory', icon: Package });
  }

  if (hasPermission(roles, 'purchase.create')) {
    displayMenuItems.push({ name: 'Suppliers', href: '/suppliers', icon: Boxes });
  }

  if (hasPermission(roles, 'exhibition.manage')) {
    displayMenuItems.push({ name: 'Events', href: '/exhibitions', icon: Award });
  }

  if (hasPermission(roles, 'promo.manage')) {
    displayMenuItems.push({ name: 'Promos', href: '/promos', icon: Gift });
  }

  if (hasPermission(roles, 'purchase.create') || hasPermission(roles, 'expense.manage')) {
    displayMenuItems.push({ name: 'Finances', href: '/finances', icon: DollarSign });
  }

  if (hasPermission(roles, 'report.view')) {
    displayMenuItems.push({ name: 'Reports', href: '/reports', icon: FileSpreadsheet });
  }

  // Audit Logs placed prominently right after Reports
  displayMenuItems.push({ name: 'Audit Logs', href: '/logs', icon: ShieldAlert });

  if (hasPermission(roles, 'blog.manage') || hasPermission(roles, 'settings.manage')) {
    displayMenuItems.push({ name: 'Blog & News', href: '/blog', icon: Newspaper });
  }

  if (hasPermission(roles, 'settings.manage')) {
    displayMenuItems.push({ name: 'Settings', href: '/settings', icon: Settings });
  }

  return (
    <aside className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-64'} transition-all duration-300 ease-in-out bg-black flex-col justify-between h-full rounded-2xl z-40 border border-white/5 font-sans p-4 relative`}>
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-black border border-white/10 text-white rounded-full p-1 hover:bg-white/10 z-50 shadow-md"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
        {/* Brand Header */}
        <div className={`p-3 border-b border-white/5 flex items-center gap-3 mb-4 ${isCollapsed ? 'justify-center px-0' : ''}`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white/5">
            <img 
              src="/assets/honey-palace-logo.png" 
              alt="The Honey Palace Logo"
              className="w-full h-full object-contain"
            />
          </div>
          {!isCollapsed && (
            <div className="whitespace-nowrap transition-opacity duration-300">
              <h1 className="font-display font-bold text-white tracking-wide leading-none text-base">
                HONEY PALACE
              </h1>
              <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">
                Inventory App
              </span>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {displayMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 group ${
                  isActive
                    ? 'bg-[#ffa200] text-black shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${
                  isActive ? 'text-black' : 'text-[#ffa200]'
                }`} />
                {!isCollapsed && (
                  <span className="whitespace-nowrap">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Desktop Shell: Bottom Profile & Role Scope Badge */}
      <div className="pt-3 border-t border-white/10 mt-2 shrink-0">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#ffa200] text-black font-bold text-xs flex items-center justify-center shrink-0">
              {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'HP'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">{user?.full_name || 'Staff Member'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                    {roles?.[0] || 'Staff'}
                  </span>
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/50 hover:text-rose-400 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
