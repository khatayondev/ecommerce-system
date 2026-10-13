'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, updateDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { LogOut, Bell, Users, Settings, Search, Loader2, Wifi, WifiOff, Smartphone, ShieldAlert } from 'lucide-react';
import { requestNotificationPermission, showNativeNotification, playNotificationSound } from '@/utils/pushNotifications';
import toast from 'react-hot-toast';

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { roles, user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);

  // Refs for closing dropdowns when clicking outside
  const notificationsRef = React.useRef(null);
  const profileMenuRef = React.useRef(null);
  const searchContainerRef = React.useRef(null);

  // Network Status
  const [isOnline, setIsOnline] = React.useState(typeof window !== 'undefined' ? navigator.onLine : true);

  // Click outside detector
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Universal Search State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState({ products: [], sales: [] });
  const [isSearching, setIsSearching] = React.useState(false);

  React.useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults({ products: [], sales: [] });
      return;
    }
    const doSearch = async () => {
      setIsSearching(true);
      if (!db) {
        setIsSearching(false);
        return;
      }
      try {
        const prodSnap = await getDocs(query(collection(db, 'products')));
        const salesSnap = await getDocs(query(collection(db, 'sales')));
        
        let products = [];
        prodSnap.forEach(d => {
          const data = d.data();
          if (data.name?.toLowerCase().includes(searchQuery.toLowerCase()) || d.id.toLowerCase().includes(searchQuery.toLowerCase())) {
            products.push({ ...data, id: d.id });
          }
        });
        
        let sales = [];
        salesSnap.forEach(d => {
          const data = d.data();
          if (data.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) || d.id.toLowerCase().includes(searchQuery.toLowerCase())) {
            sales.push({ ...data, id: d.id });
          }
        });
        setSearchResults({ products: products.slice(0,5), sales: sales.slice(0,5) });
      } catch (e) {
        console.error('Search failed', e);
      }
      setIsSearching(false);
    };
    
    const timeoutId = setTimeout(doSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  React.useEffect(() => {
    if (!db) return;
    try {
      const pageLoadTime = new Date().toISOString();
      const q = query(collection(db, 'notifications'), orderBy('time', 'desc'), limit(15));
      const unsub = onSnapshot(q, (snap) => {
        const list = [];
        let hasNewAlert = false;
        let latestNotif = null;

        snap.forEach(d => {
          const notif = { ...d.data(), id: d.id };
          list.push(notif);

          // Trigger native notification if document is unread and created after page loaded
          if (notif.unread && notif.time > pageLoadTime) {
            const alreadyAlerted = localStorage.getItem(`alerted-${notif.id}`);
            if (!alreadyAlerted) {
              hasNewAlert = true;
              latestNotif = notif;
              localStorage.setItem(`alerted-${notif.id}`, 'true');
            }
          }
        });

        setNotifications(list);

        // Update App Icon Badge
        const unreadCount = list.filter(n => n.unread).length;
        if (typeof window !== 'undefined' && 'setAppBadge' in navigator) {
          if (unreadCount > 0) {
            navigator.setAppBadge(unreadCount).catch(() => {});
          } else {
            navigator.clearAppBadge().catch(() => {});
          }
        }

        if (hasNewAlert && latestNotif) {
          playNotificationSound();
          showNativeNotification(latestNotif.title, latestNotif.message, latestNotif.link || '/orders');
        }
      }, (err) => {
        console.warn("[TopNav] Notification snapshot permission warning:", err.message);
      });
      return () => unsub();
    } catch (e) {
      console.warn("[TopNav] Notification query error:", e.message);
    }
  }, []);

  // Dynamic headers based on route
  const getPageHeader = () => {
    switch (pathname) {
      case '/inventory': return { title: 'Inventory Management', desc: 'Manage your product catalog, track stock levels, and organize your inventory.' };
      case '/customers': return { title: 'Customer CRM', desc: 'Manage your customer database, bulk import contacts, and track relationships.' };
      case '/communications': return { title: 'Communications & Marketing', desc: 'Manage broadcasts, templates, and contact lists.' };
      case '/pos': return { title: 'Point of Sale', desc: 'Process orders and checkout customers.' };
      case '/orders': return { title: 'Order Management', desc: 'Track and process customer orders.' };
      case '/finances': return { title: 'Financial Overview', desc: 'Track revenue, expenses, and business health.' };
      case '/settings/users': return { title: 'Settings & Users', desc: 'Manage system settings and user access.' };
      case '/suppliers': return { title: 'Suppliers Network', desc: 'Manage apiary partners, wholesale honey suppliers, and vendors.' };
      case '/exhibitions': return { title: 'Exhibition & Event Registry', desc: 'Create events, allocate stock, and track event sales.' };
      case '/reports': return { title: 'Business Reports', desc: 'Generate and download structured CSV spreadsheets.' };
      case '/': return null; // Handled dynamically in page.js
      default: return { title: 'The Honey Palace', desc: '' };
    }
  };

  const header = getPageHeader();

  const hasUnread = notifications.some(n => n.unread);

  const handleNotificationClick = async (notif) => {
    if (notif.unread) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { unread: false });
      } catch (e) {
        console.error('Failed to mark unread', e);
      }
    }
    if (notif.link) {
      router.push(notif.link);
    }
    setShowNotifications(false);
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => n.unread);
    if (unreadNotifs.length === 0) return;
    try {
      const batch = writeBatch(db);
      unreadNotifs.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { unread: false });
      });
      await batch.commit();

      // Clear App Icon Badge
      if (typeof window !== 'undefined' && 'clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 md:px-8 pt-0 pb-2 md:pb-4">
      <div className="w-full flex justify-between items-center z-40 relative bg-white rounded-full p-2 border border-gray-200 shadow-sm pl-3 md:pl-4 pr-2">
        
        {/* Mobile Brand Logo */}
        <Link href="/" className="flex items-center gap-2 md:hidden">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <img 
              src="/assets/honey-palace-logo.png" 
              alt="Honey Palace Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-display font-bold text-gray-900 text-xs tracking-tight">Honey Palace</span>
        </Link>

        {/* Left Side: Header & Search */}
        <div className="flex items-center gap-4 flex-1">
          {/* Dynamic Page Header */}
          {header && (
            <div className="whitespace-nowrap border-r border-gray-200 pr-4 hidden lg:block">
              <h1 className="text-lg font-display font-bold text-gray-900 leading-none">{header.title}</h1>
              {header.desc && <p className="text-[10px] text-gray-500 mt-1">{header.desc}</p>}
            </div>
          )}

          {/* Universal Search Bar */}
          <div className="relative w-full max-w-lg hidden md:block" ref={searchContainerRef}>
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search products, orders, customers..."
              className="w-full bg-[#fbf9fe] border border-neutral-200/90 rounded-xl pl-10 pr-10 py-2.5 text-xs md:text-sm font-semibold text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all shadow-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <Loader2 className="absolute right-3.5 top-3 w-4 h-4 text-[#d07b00] animate-spin" />
            )}

            {/* Non-Disruptive Floating Absolute Overlay Popover */}
            {searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 top-full mt-2 w-[440px] z-50 bg-white/98 backdrop-blur-xl border border-neutral-200 rounded-2xl p-2.5 shadow-2xl max-h-80 overflow-y-auto space-y-2 animate-in fade-in zoom-in-95 duration-150">
                {searchResults.products.length === 0 && searchResults.sales.length === 0 && !isSearching ? (
                  <div className="p-4 text-center text-neutral-400 text-xs font-medium">No records matching &quot;{searchQuery}&quot;</div>
                ) : (
                  <div className="p-1 space-y-3">
                    {searchResults.products.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-2 mb-1.5">Products</h4>
                        <div className="space-y-1">
                          {searchResults.products.map(p => (
                            <Link 
                              href="/inventory" 
                              key={p.id} 
                              onClick={() => setSearchQuery('')}
                              className="p-2.5 rounded-xl bg-[#fbf9fe] hover:bg-neutral-100 border border-neutral-100 flex items-center justify-between gap-3 transition"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {p.image ? (
                                  <img src={p.image} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-neutral-200 shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0">{p.name.charAt(0)}</div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-neutral-900 text-xs truncate">{p.name}</p>
                                  <p className="text-[10px] text-neutral-400 font-mono truncate">{p.stockLevel || 0} in stock • ₵{(p.sellingPrice || 0).toFixed(2)}</p>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[10px] rounded-lg transition shrink-0 shadow-xs">
                                View ↵
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchResults.sales.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-2 mb-1.5">Orders & Sales</h4>
                        <div className="space-y-1">
                          {searchResults.sales.map(s => (
                            <Link
                              href="/orders"
                              key={s.id}
                              onClick={() => setSearchQuery('')}
                              className="p-2.5 rounded-xl bg-[#fbf9fe] hover:bg-neutral-100 border border-neutral-100 flex items-center justify-between gap-3 transition"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-neutral-900 text-xs truncate">{s.id}</p>
                                <p className="text-[10px] text-neutral-400 font-mono truncate">{s.customer_name || 'Walk-in Customer'}</p>
                              </div>
                              <span className="font-bold font-mono text-xs text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                                ₵{(s.totalAmount || s.total || 0).toFixed(2)}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      {/* Right Side: Online/Offline Badge, Notification & Profile */}
      <div className="flex items-center gap-3">
        {/* Network Status Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-xs transition-all ${
          isOnline 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
        }`}
        title={isOnline ? "Network Connected" : "Offline Mode (Pop-up Stand)"}
        >
          {isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </div>        {/* Notification Button */}
        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
            className="relative p-2 rounded-full hover:bg-gray-50 text-gray-700 transition-colors" 
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-gray-700" />
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
            )}
          </button>
 
          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="fixed top-16 left-3 right-3 md:absolute md:top-14 md:right-0 md:left-auto md:w-80 w-auto bg-white border border-gray-100 rounded-2xl p-0 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden z-[60]">
              <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-gray-900">Notifications</h3>
                <span onClick={markAllAsRead} className="text-xs text-[#d07b00] font-bold cursor-pointer hover:underline">Mark all as read</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length > 0 ? notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer flex gap-3 ${notif.unread ? 'bg-orange-50/20' : ''}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.unread ? 'bg-red-500' : 'bg-transparent'}`}></div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{notif.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">{notif.time}</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-gray-400 text-sm">No new notifications</div>
                )}
              </div>
              <div className="p-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                <Link 
                  href="/settings/users?tab=notifications"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-bold text-[#d07b00] hover:underline flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Notification Settings
                </Link>
                <button onClick={() => setShowNotifications(false)} className="text-xs font-bold text-gray-500 hover:text-black py-1">Close</button>
              </div>
            </div>
          )}
        </div>
 
        <div className="w-[1px] h-8 bg-gray-200 mx-1 hidden sm:block"></div>
 
        {/* Profile Button */}
        <div className="relative" ref={profileMenuRef}>
          <button 
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
            className="flex items-center gap-3 p-1.5 pr-4 rounded-full hover:bg-gray-50 text-gray-800 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-[#ffa200]/10 border border-[#ffa200]/30 flex-shrink-0 flex items-center justify-center font-bold text-[#ffa200] text-sm">
              {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'ST'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold truncate leading-none">{user?.full_name || 'Guest User'}</p>
              <p className="text-[10px] text-gray-500 truncate font-medium mt-1 uppercase tracking-wider">{roles.join(', ')}</p>
            </div>
          </button>
 
          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div className="fixed top-16 right-3 left-auto md:absolute md:top-14 md:right-0 md:w-48 w-48 bg-white border border-gray-100 rounded-xl p-2 shadow-xl space-y-1 text-sm text-gray-700 animate-in fade-in slide-in-from-top-2 duration-200 z-[60]">
              <Link 
                href="/settings/users?tab=profile" 
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-gray-700 hover:text-black transition-colors"
              >
                <Users className="w-4 h-4 text-[#ffa200]" />
                <span>My Profile</span>
              </Link>
              <Link 
                href="/settings/users?tab=users" 
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-gray-700 hover:text-black transition-colors"
              >
                <Settings className="w-4 h-4 text-[#ffa200]" />
                <span>Settings Panel</span>
              </Link>
              <Link 
                href="/logs" 
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg text-gray-700 hover:text-black transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-[#ffa200]" />
                <span>Audit Logs</span>
              </Link>
              <hr className="border-gray-100 my-1" />
              <button 
                onClick={() => { setShowProfileMenu(false); logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-600 transition-colors text-left font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
