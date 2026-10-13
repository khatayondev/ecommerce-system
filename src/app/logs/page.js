'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import AuthShield from '@/components/AuthShield';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Calendar,
  RefreshCw,
  Clock,
  User,
  Tag,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  FileText,
  ShoppingCart,
  Package,
  Calculator,
  DollarSign,
  Users,
  Megaphone,
  Settings,
  ChevronDown,
  Eye,
  Copy,
  Check,
  ExternalLink,
  SlidersHorizontal,
  X
} from 'lucide-react';

const MODULES = [
  { id: 'ALL', label: 'All Modules', icon: SlidersHorizontal },
  { id: 'INVOICES', label: 'Invoices', icon: FileText, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'ORDERS', label: 'Online Orders', icon: ShoppingCart, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'INVENTORY', label: 'Inventory & Stock', icon: Package, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'POS', label: 'Point of Sale', icon: Calculator, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'FINANCES', label: 'Finances', icon: DollarSign, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'USERS', label: 'Users & Roles', icon: Users, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'COMMUNICATIONS', label: 'Comms & SMS', icon: Megaphone, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { id: 'SETTINGS', label: 'Settings', icon: Settings, color: 'text-zinc-600 bg-zinc-50 border-zinc-200' },
];

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [dateRange, setDateRange] = useState('all'); // 'all' | 'today' | '7days' | '30days'
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);

  // Real-time listener for Firestore logs
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(500));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedLogs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setLogs(fetchedLogs);
          setLoading(false);
        },
        (err) => {
          console.warn('[AuditLogs] Fallback query without index:', err);
          // Fallback if timestamp composite index is pending
          const fallbackUnsub = onSnapshot(collection(db, 'logs'), (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
            setLogs(list);
            setLoading(false);
          });
          return fallbackUnsub;
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.error('[AuditLogs] Error setting up listener:', e);
      setLoading(false);
    }
  }, []);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Module filter
      if (selectedModule !== 'ALL') {
        const logMod = (log.module || '').toUpperCase();
        if (logMod !== selectedModule) return false;
      }

      // 2. Severity filter
      if (selectedSeverity !== 'ALL') {
        const logSev = (log.severity || 'info').toLowerCase();
        if (logSev !== selectedSeverity.toLowerCase()) return false;
      }

      // 3. Date range filter
      if (dateRange !== 'all') {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        if (dateRange === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (dateRange === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < sevenDaysAgo) return false;
        } else if (dateRange === '30days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < thirtyDaysAgo) return false;
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const action = (log.action || '').toLowerCase();
        const details = (typeof log.details === 'string' ? log.details : JSON.stringify(log.details || '')).toLowerCase();
        const userEmail = (log.userEmail || '').toLowerCase();
        const userName = (log.userName || '').toLowerCase();
        const targetId = (log.targetId || '').toLowerCase();
        const module = (log.module || '').toLowerCase();

        return (
          action.includes(q) ||
          details.includes(q) ||
          userEmail.includes(q) ||
          userName.includes(q) ||
          targetId.includes(q) ||
          module.includes(q)
        );
      }

      return true;
    });
  }, [logs, selectedModule, selectedSeverity, dateRange, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const invoices = logs.filter((l) => (l.module || '').toUpperCase() === 'INVOICES').length;
    const orders = logs.filter((l) => (l.module || '').toUpperCase() === 'ORDERS').length;
    const pos = logs.filter((l) => (l.module || '').toUpperCase() === 'POS').length;
    const security = logs.filter((l) => ['USERS', 'SETTINGS'].includes((l.module || '').toUpperCase())).length;
    return { total, invoices, orders, pos, security };
  }, [logs]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Format Helpers
  const formatTime = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const getRelativeTime = (isoString) => {
    if (!isoString) return '';
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffSecs = Math.floor((now - past) / 1000);
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const getModuleBadge = (mod) => {
    const moduleUpper = (mod || 'GENERAL').toUpperCase();
    const config = MODULES.find((m) => m.id === moduleUpper) || {
      id: moduleUpper,
      label: moduleUpper,
      color: 'text-gray-700 bg-gray-100 border-gray-200',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${config.color || 'text-gray-700 bg-gray-100 border-gray-200'}`}>
        {config.label || moduleUpper}
      </span>
    );
  };

  const getSeverityBadge = (sev) => {
    const s = (sev || 'info').toLowerCase();
    switch (s) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Success
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      case 'danger':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Critical
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Info className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No logs match current filter to export.');
      return;
    }

    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Module', 'Action', 'Target ID', 'Severity', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp || ''}"`,
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      `"${(l.userEmail || '').replace(/"/g, '""')}"`,
      `"${l.module || 'GENERAL'}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.targetId || '').replace(/"/g, '""')}"`,
      `"${l.severity || 'info'}"`,
      `"${(typeof l.details === 'string' ? l.details : JSON.stringify(l.details || '')).replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HoneyPalace_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredLogs.length} audit records to CSV!`);
  };

  const handleCopyPayload = (payload) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    toast.success('Log payload copied to clipboard');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <AuthShield>
      <div className="space-y-6 pb-16 font-sans">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight">Audit & Activity Logs</h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Sync
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Trace system events, invoice generation, order updates, stock alterations, and administrative operations.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold shadow-xs hover:shadow-md transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              Export Audit CSV
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Total System Logs</span>
              <span className="p-1.5 rounded-lg bg-gray-100 text-gray-700">
                <FileText className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{stats.total}</p>
            <span className="text-[11px] text-gray-400">All recorded audit trails</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-600">Invoices & Billing</span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <FileText className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{stats.invoices}</p>
            <span className="text-[11px] text-gray-400">Invoices, quotes & pro-formas</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600">Online & POS Sales</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <ShoppingCart className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{stats.orders + stats.pos}</p>
            <span className="text-[11px] text-gray-400">{stats.orders} web orders · {stats.pos} POS</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-indigo-600">Admin & Security</span>
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <ShieldAlert className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{stats.security}</p>
            <span className="text-[11px] text-gray-400">User management & settings</span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by action, details, user email, invoice # (e.g. #MGL726959), or order ID..."
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Severity Filter */}
            <div className="w-full md:w-44">
              <select
                value={selectedSeverity}
                onChange={(e) => {
                  setSelectedSeverity(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
              >
                <option value="ALL">All Severities</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="danger">Critical / Danger</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="w-full md:w-44">
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="today">Today Only</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Module Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const isSelected = selectedModule === mod.id;
              const count =
                mod.id === 'ALL'
                  ? logs.length
                  : logs.filter((l) => (l.module || '').toUpperCase() === mod.id).length;

              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    setSelectedModule(mod.id);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-white font-semibold shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{mod.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing <strong className="text-gray-900">{filteredLogs.length}</strong> event{filteredLogs.length !== 1 ? 's' : ''}
              {selectedModule !== 'ALL' && ` in ${selectedModule}`}
            </span>
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 font-medium"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Ref</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-center">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                        <span>Synchronizing activity records...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                          <Search className="w-5 h-5" />
                        </div>
                        <p className="font-semibold text-gray-700">No log records found</p>
                        <p className="text-xs text-gray-400">
                          No audit entries match the current filter or search criteria.
                        </p>
                        {(searchQuery || selectedModule !== 'ALL' || selectedSeverity !== 'ALL' || dateRange !== 'all') && (
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setSelectedModule('ALL');
                              setSelectedSeverity('ALL');
                              setDateRange('all');
                            }}
                            className="mt-2 text-xs font-semibold text-amber-600 hover:text-amber-700 underline"
                          >
                            Reset filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => {
                    const relative = getRelativeTime(log.timestamp);
                    const formatted = formatTime(log.timestamp);
                    const isTargetIdPresent = Boolean(log.targetId);

                    return (
                      <tr key={log.id} className="hover:bg-amber-50/20 transition group">
                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{formatted}</div>
                          {relative && <div className="text-[10px] text-gray-400">{relative}</div>}
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-[10px]">
                              {(log.userName || log.userEmail || 'A')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{log.userName || 'System'}</div>
                              <div className="text-[10px] text-gray-400">{log.userEmail || 'automatic'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Module */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getModuleBadge(log.module)}
                        </td>

                        {/* Action & Severity */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="font-bold text-gray-800">{log.action}</span>
                            {getSeverityBadge(log.severity)}
                          </div>
                        </td>

                        {/* Target ID / Resource Ref */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isTargetIdPresent ? (
                            <button
                              onClick={() => {
                                setSearchQuery(log.targetId);
                                setCurrentPage(1);
                              }}
                              title="Click to filter by this resource ID"
                              className="font-mono text-xs font-semibold bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 px-2 py-0.5 rounded border border-gray-200 transition"
                            >
                              #{log.targetId}
                            </button>
                          ) : (
                            <span className="text-gray-300 font-mono">—</span>
                          )}
                        </td>

                        {/* Details */}
                        <td className="py-3 px-4 max-w-md">
                          <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                          </p>
                        </td>

                        {/* Inspection Modal Trigger */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                            title="Inspect full event metadata"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 bg-gray-50/50">
              <span>
                Page <strong className="text-gray-900">{currentPage}</strong> of <strong className="text-gray-900">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Inspection Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getModuleBadge(selectedLog.module)}
                    {getSeverityBadge(selectedLog.severity)}
                  </div>
                  <h3 className="text-lg font-black text-gray-900">{selectedLog.action}</h3>
                  <p className="text-xs text-gray-400 font-mono">{selectedLog.timestamp}</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Event Attributes Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block mb-0.5">Performed By</span>
                  <span className="font-semibold text-gray-900 block">{selectedLog.userName || 'System'}</span>
                  <span className="text-[11px] text-gray-500 font-mono">{selectedLog.userEmail || 'automatic'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Target Resource ID</span>
                  <span className="font-mono font-semibold text-amber-700 block">
                    {selectedLog.targetId ? `#${selectedLog.targetId}` : 'None'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block mb-0.5">Event Description</span>
                  <p className="text-gray-800 leading-relaxed font-sans">{selectedLog.details || 'No summary text.'}</p>
                </div>
              </div>

              {/* JSON Metadata Payload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Raw Payload Data</span>
                  <button
                    onClick={() => handleCopyPayload(selectedLog)}
                    className="inline-flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-semibold"
                  >
                    {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPayload ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-52 border border-gray-800">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthShield>
  );
}
