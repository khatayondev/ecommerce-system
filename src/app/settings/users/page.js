'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import AuthShield from '@/components/AuthShield';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { logAction } from '@/utils/logging';
import { toast } from 'react-hot-toast';
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldAlert, 
  Check, 
  X, 
  Trash2,
  Lock,
  Unlock,
  AlertCircle,
  Bell,
  Activity,
  Settings,
  ChevronDown,
  Mail,
  Smartphone,
  Key,
  Copy,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';

const AVAILABLE_ROLES = ['Admin', 'CEO', 'Manager', 'Order Staff', 'Sales Exec', 'Cashier', 'Inventory', 'Accountant'];

const MOCK_USERS = [
  { id: 'mock-admin', full_name: 'Admin CEO', email: 'admin@honeypalace.com', roles: ['Admin', 'CEO'], is_active: true },
  { id: 'mock-order-staff', full_name: 'Esi Order Staff', email: 'dispatch@honeypalace.com', roles: ['Order Staff'], is_active: true },
  { id: 'mock-sales', full_name: 'Kofi Mensah', email: 'sales@honeypalace.com', roles: ['Sales Exec'], is_active: true },
  { id: 'mock-cashier', full_name: 'Akua Cashier', email: 'cashier@honeypalace.com', roles: ['Cashier'], is_active: true },
  { id: 'mock-inventory', full_name: 'Ama Serwaa', email: 'inventory@honeypalace.com', roles: ['Inventory'], is_active: true },
  { id: 'mock-accountant', full_name: 'Yao Boateng', email: 'accountant@honeypalace.com', roles: ['Accountant'], is_active: true },
];

export default function UsersSettingsPage() {
  const { roles, user } = useAuth();
  const { showConfirm } = useUI();
  const [activeTab, setActiveTab] = useState('users');

  const [notificationPermission, setNotificationPermission] = useState('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    const { requestNotificationPermission } = await import('@/utils/pushNotifications');
    const status = await requestNotificationPermission();
    setNotificationPermission(status);
    if (status === 'granted') {
      toast.success("Push notifications enabled successfully!");
    } else if (status === 'denied') {
      toast.error("Permission denied. Enable notifications in browser settings.");
    } else if (status === 'unsupported') {
      toast.error("Push notifications are not supported on this device/browser.");
    }
  };
  
  const { 
    isStoreOpen, 
    isBusyMode, 
    settings: globalSettings, 
    toggleStoreOpen, 
    toggleBusyMode, 
    updateSettings 
  } = useStoreSettings();

  const [settingsForm, setSettingsForm] = useState({
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    momoNetwork: '',
    momoNumber: '',
    bankName: '',
    bankBranch: '',
    bankAccountName: '',
    bankAccountNo: '',
    lowStockThreshold: 10,
    alertEmail: '',
    alertPhone: ''
  });

  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (globalSettings) {
      setSettingsForm({
        companyName: globalSettings.companyName || '',
        companyEmail: globalSettings.companyEmail || '',
        companyPhone: globalSettings.companyPhone || '',
        companyAddress: globalSettings.companyAddress || '',
        momoNetwork: globalSettings.momoNetwork || '',
        momoNumber: globalSettings.momoNumber || '',
        bankName: globalSettings.bankName || '',
        bankBranch: globalSettings.bankBranch || '',
        bankAccountName: globalSettings.bankAccountName || '',
        bankAccountNo: globalSettings.bankAccountNo || '',
        lowStockThreshold: globalSettings.lowStockThreshold !== undefined ? globalSettings.lowStockThreshold : 10,
        alertEmail: globalSettings.alertEmail || '',
        alertPhone: globalSettings.alertPhone || ''
      });
    }
  }, [globalSettings]);

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      await updateSettings({
        ...settingsForm,
        lowStockThreshold: parseInt(settingsForm.lowStockThreshold) || 10
      });
      await logAction('Update System Settings', `Changed company configuration details`);
      toast.success('System configuration updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update system settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const [users, setUsers] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeDropdownUserId, setActiveDropdownUserId] = useState(null);

  const [notifs, setNotifs] = useState({
    emailSales: true,
    emailInvoices: true,
    smsLowStock: false,
    emailSuppliers: true,
  });

  const [dbLogs, setDbLogs] = useState([]);
  const MOCK_LOGS = [
    { id: '1', timestamp: new Date(Date.now() - 50000).toISOString(), userEmail: 'admin@honeypalace.com', userName: 'Admin CEO', action: 'Update Access Matrix', details: 'Added CEO role to kofi@honeypalace.com' },
    { id: '2', timestamp: new Date(Date.now() - 3600000).toISOString(), userEmail: 'sales@honeypalace.com', userName: 'Kofi Mensah', action: 'Generate Invoice', details: 'Created wholesale Invoice #MGL470249' },
  ];

  const [showSlideOut, setShowSlideOut] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    roles: ['Sales Exec'],
    is_active: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState({
    isOpen: false,
    user: null,
    newPassword: '',
    showPassword: false,
    loading: false,
  });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'HP@';
    for (let i = 0; i < 7; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser(prev => ({ ...prev, password: pass }));
  };

  const generateResetPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'HP@';
    for (let i = 0; i < 7; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetPasswordModal(prev => ({ ...prev, newPassword: pass }));
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    if (!db) {
      const stored = localStorage.getItem('mock_users');
      if (stored) {
        setUsers(JSON.parse(stored));
      } else {
        setUsers(MOCK_USERS);
        localStorage.setItem('mock_users', JSON.stringify(MOCK_USERS));
      }
      setIsMock(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (snapshot.empty) {
        setUsers([]);
        setIsMock(false);
      } else {
        const list = [];
        snapshot.forEach((doc) => list.push({ ...doc.data(), id: doc.id }));
        setUsers(list);
        setIsMock(false);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore error, using mock users:", err);
      setUsers(MOCK_USERS);
      setIsMock(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db) {
      const stored = localStorage.getItem('mock_logs');
      if (stored) {
        setDbLogs(JSON.parse(stored));
      } else {
        setDbLogs(MOCK_LOGS);
        localStorage.setItem('mock_logs', JSON.stringify(MOCK_LOGS));
      }
      return;
    }
    const unsubLogs = onSnapshot(collection(db, 'logs'), (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ ...doc.data(), id: doc.id }));
      list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      setDbLogs(list.length > 0 ? list : MOCK_LOGS);
    }, () => setDbLogs(MOCK_LOGS));
    return () => unsubLogs();
  }, []);

  const handleRoleToggle = async (userRecord, roleName) => {
    let updatedRoles = [...(userRecord.roles || [])];
    if (updatedRoles.includes(roleName)) {
      if (roleName === 'Admin' && userRecord.email === 'admin@honeypalace.com') {
        toast.error("Cannot remove Admin role from the primary admin account.");
        return;
      }
      updatedRoles = updatedRoles.filter(r => r !== roleName);
    } else {
      updatedRoles.push(roleName);
    }

    if (isMock) {
      const updated = users.map(u => u.id === userRecord.id ? { ...u, roles: updatedRoles } : u);
      setUsers(updated);
      localStorage.setItem('mock_users', JSON.stringify(updated));

      // Append mock log
      const logEntry = {
        id: `mock-log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'admin@thehoneypalaceafrica.com',
        userName: user?.full_name || user?.email?.split('@')[0] || 'Admin',
        action: 'Update Roles Matrix',
        details: `Updated roles for ${userRecord.email}`
      };
      const currentLogs = [logEntry, ...dbLogs];
      setDbLogs(currentLogs);
      localStorage.setItem('mock_logs', JSON.stringify(currentLogs));

      toast.success("Roles updated successfully (Sandbox)");
      return;
    }

    try {
      const docRef = doc(db, 'users', userRecord.id);
      await updateDoc(docRef, { role: updatedRoles, roles: updatedRoles });
      await logAction(user?.email || 'admin@thehoneypalaceafrica.com', user?.full_name || user?.email?.split('@')[0] || 'Admin', 'Update Roles Matrix', `Updated roles for ${userRecord.email}`);
      toast.success("Roles updated successfully");
    } catch (err) {
      console.error("Error updating user roles:", err);
      toast.error("Failed to update roles.");
    }
  };

  const handleStatusToggle = async (userRecord) => {
    if (userRecord.email === 'admin@honeypalace.com' || userRecord.email === 'thehoneypalace2022@gmail.com') {
      toast.error("Cannot deactivate primary admin account.");
      return;
    }

    const currentActiveState = userRecord.is_active !== undefined ? userRecord.is_active : (userRecord.active !== undefined ? userRecord.active : true);
    const nextActiveState = !currentActiveState;

    if (isMock) {
      const updated = users.map(u => u.id === userRecord.id ? { ...u, is_active: nextActiveState, active: nextActiveState } : u);
      setUsers(updated);
      localStorage.setItem('mock_users', JSON.stringify(updated));

      // Append mock log
      const logEntry = {
        id: `mock-log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userEmail: user?.email || 'admin@thehoneypalaceafrica.com',
        userName: user?.full_name || user?.email?.split('@')[0] || 'Admin',
        action: 'Toggle User Status',
        details: `${nextActiveState ? 'Activated' : 'Deactivated'} account for ${userRecord.email}`
      };
      const currentLogs = [logEntry, ...dbLogs];
      setDbLogs(currentLogs);
      localStorage.setItem('mock_logs', JSON.stringify(currentLogs));

      toast.success(`User ${nextActiveState ? 'activated' : 'deactivated'} successfully (Sandbox)`);
      return;
    }

    try {
      const docRef = doc(db, 'users', userRecord.id);
      await updateDoc(docRef, { active: nextActiveState, is_active: nextActiveState });
      await logAction(user?.email || 'admin@thehoneypalaceafrica.com', user?.full_name || user?.email?.split('@')[0] || 'Admin', 'Toggle User Status', `${nextActiveState ? 'Activated' : 'Deactivated'} account for ${userRecord.email}`);
      toast.success(`User ${nextActiveState ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      console.error("Error updating active status:", err);
      toast.error("Failed to change user status.");
    }
  };

  const handleDeleteUser = async (userRecord) => {
    const confirmed = await showConfirm({
      title: 'Delete User Account',
      message: `Permanently delete ${userRecord.full_name || userRecord.email}? This will remove them from Firebase Auth and Firestore and cannot be undone.`,
      confirmText: 'Delete',
      isDestructive: true
    });

    if (!confirmed) return;

    if (isMock) {
      const updated = users.filter(u => u.id !== userRecord.id);
      setUsers(updated);
      localStorage.setItem('mock_users', JSON.stringify(updated));
      toast.success('User deleted (Sandbox)');
      return;
    }

    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userRecord.id, email: userRecord.email })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (data.errors && data.errors.join(', ')) || 'Failed to delete user');
      }
      await logAction(user?.email || 'admin', user?.full_name || 'Admin', 'Delete User', `Deleted account for ${userRecord.email}`);
      toast.success('User account permanently deleted');
    } catch (err) {
      console.error('Delete user error:', err);
      toast.error(err.message || 'Failed to delete user account.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.email.trim() || !newUser.full_name.trim() || !newUser.password.trim()) {
      toast.error('Please enter Full Name, Email, and Password.');
      return;
    }
    if (newUser.password.trim().length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setIsInviting(true);

    const docId = newUser.email.trim().toLowerCase();
    const payload = {
      email: docId,
      password: newUser.password.trim(),
      full_name: newUser.full_name.trim(),
      role: newUser.roles,
      roles: newUser.roles,
      active: newUser.is_active,
      is_active: newUser.is_active,
      created_at: new Date().toISOString()
    };

    try {
      if (isMock) {
        const updated = [...users, { id: docId, ...payload }];
        setUsers(updated);
        localStorage.setItem('mock_users', JSON.stringify(updated));

        // Append mock log
        const logEntry = {
          id: `mock-log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userEmail: user?.email || 'admin@thehoneypalaceafrica.com',
          userName: user?.full_name || user?.email?.split('@')[0] || 'Admin',
          action: 'Create Staff Member',
          details: `Created account and roles for ${docId}`
        };
        const currentLogs = [logEntry, ...dbLogs];
        setDbLogs(currentLogs);
        localStorage.setItem('mock_logs', JSON.stringify(currentLogs));

        setCreatedCredentials({
          name: payload.full_name,
          email: payload.email,
          password: payload.password,
          roles: payload.roles
        });
        toast.success("Staff account created successfully (Sandbox)!");
        setShowSlideOut(false);
        setNewUser({ email: '', password: '', full_name: '', roles: ['Sales Exec'], is_active: true });
      } else {
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: payload.email,
            password: payload.password,
            full_name: payload.full_name,
            roles: payload.roles,
            is_active: payload.is_active
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to create user account');
        }

        await logAction(
          user?.email || 'admin@thehoneypalaceafrica.com',
          user?.full_name || user?.email?.split('@')[0] || 'Admin',
          'Create User',
          `Created staff account for ${payload.email} (${payload.roles.join(', ')})`
        );

        setCreatedCredentials({
          name: payload.full_name,
          email: payload.email,
          password: payload.password,
          roles: payload.roles,
          emailSent: data.emailSent !== false
        });

        if (data.emailSent) {
          toast.success(`Account created and credentials sent to ${payload.email}!`);
        } else {
          toast.success(`Account created for ${payload.email}!`);
        }
        setShowSlideOut(false);
        setNewUser({ email: '', password: '', full_name: '', roles: ['Sales Exec'], is_active: true });
      }
    } catch (err) {
      console.error("Error creating staff account:", err);
      toast.error(err.message || "Failed to create staff account.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPasswordModal.newPassword || resetPasswordModal.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setResetPasswordModal(prev => ({ ...prev, loading: true }));
    try {
      if (isMock) {
        toast.success(`Password reset for ${resetPasswordModal.user.email} (Sandbox)`);
        setResetPasswordModal({ isOpen: false, user: null, newPassword: '', showPassword: false, loading: false });
        return;
      }

      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: resetPasswordModal.user.id,
          email: resetPasswordModal.user.email,
          password: resetPasswordModal.newPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      if (data.emailSent) {
        toast.success(`Password reset and new credentials emailed to ${resetPasswordModal.user.email}!`);
      } else {
        toast.success(`Password reset for ${resetPasswordModal.user.email}`);
      }
      await logAction(
        user?.email || 'admin@thehoneypalaceafrica.com',
        user?.full_name || user?.email?.split('@')[0] || 'Admin',
        'Reset Password',
        `Reset password for ${resetPasswordModal.user.email}`
      );
      setResetPasswordModal({ isOpen: false, user: null, newPassword: '', showPassword: false, loading: false });
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error(err.message || "Failed to reset password");
      setResetPasswordModal(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <AuthShield requiredPermission="user.manage">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage staff roles, permissions, and system notifications.</p>
          </div>
          {activeTab === 'users' && (
            <button
              onClick={() => {
                generateRandomPassword();
                setShowSlideOut(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-all shadow-sm text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add Staff Member
            </button>
          )}
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex overflow-x-auto border-b border-black/5 gap-8 text-sm text-gray-500">
          <button 
            onClick={() => setActiveTab('users')} 
            className={`pb-3 font-semibold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === 'users' ? 'border-gray-900 text-gray-900' : 'border-transparent hover:text-gray-700'}`}
          >
            <Users className="w-4 h-4" />
            Team Access Matrix
          </button>
          <button 
            onClick={() => setActiveTab('profile')} 
            className={`pb-3 font-semibold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === 'profile' ? 'border-gray-900 text-gray-900' : 'border-transparent hover:text-gray-700'}`}
          >
            <Shield className="w-4 h-4" />
            My Profile
          </button>
          <button 
            onClick={() => setActiveTab('notifications')} 
            className={`pb-3 font-semibold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === 'notifications' ? 'border-gray-900 text-gray-900' : 'border-transparent hover:text-gray-700'}`}
          >
            <Bell className="w-4 h-4" />
            Notifications
          </button>
          <button 
            onClick={() => setActiveTab('logs')} 
            className={`pb-3 font-semibold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === 'logs' ? 'border-gray-900 text-gray-900' : 'border-transparent hover:text-gray-700'}`}
          >
            <Activity className="w-4 h-4" />
            Activity Logs
          </button>
          <button 
            onClick={() => setActiveTab('system')} 
            className={`pb-3 font-semibold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === 'system' ? 'border-gray-900 text-gray-900' : 'border-transparent hover:text-gray-700'}`}
          >
            <Settings className="w-4 h-4" />
            System Config
          </button>
        </div>

        {/* TAB 1: Team Access Matrix (User Cards) */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((u) => {
              const isActive = u.is_active !== false;
              return (
                <div key={u.id} className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-blue-600 text-lg">
                        {u.full_name ? u.full_name.substring(0, 2).toUpperCase() : 'ST'}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{u.full_name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{u.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 min-h-[40px]">
                    <div className="flex flex-wrap gap-1.5">
                      {(u.roles || u.role || []).map(r => (
                        <span key={r} className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-bold uppercase rounded-md tracking-wider">
                          {r}
                        </span>
                      ))}
                      {(!u.roles && !u.role || (u.roles || u.role || []).length === 0) && (
                        <span className="text-xs text-gray-400 italic">No roles assigned</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-black/5 pt-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}>
                      {isActive ? 'Active' : 'Deactivated'}
                    </span>

                    <div className="flex gap-2 relative">
                      <div className="relative">
                        <button
                          onClick={() => setActiveDropdownUserId(activeDropdownUserId === u.id ? null : u.id)}
                          className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                          title="Manage Roles"
                        >
                          <Shield className="w-4 h-4" />
                        </button>

                        {activeDropdownUserId === u.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownUserId(null)} />
                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-black/10 rounded-xl p-1.5 shadow-xl z-50">
                              <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider border-b border-black/5 text-gray-500 mb-1.5">
                                Assign Roles
                              </div>
                              {AVAILABLE_ROLES.map(role => {
                                const hasRole = (u.roles || []).includes(role);
                                return (
                                  <button
                                    key={role}
                                    onClick={() => handleRoleToggle(u, role)}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-gray-50 rounded-lg transition-colors text-left font-medium text-xs text-gray-700"
                                  >
                                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-all ${
                                      hasRole ? 'bg-blue-600 text-white' : 'border border-gray-300'
                                    }`}>
                                      {hasRole && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </div>
                                    <span>{role}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setResetPasswordModal({
                          isOpen: true,
                          user: u,
                          newPassword: '',
                          showPassword: false,
                          loading: false,
                        })}
                        className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all duration-300"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleStatusToggle(u)}
                        className={`p-2 border rounded-lg transition-all duration-300 ${
                          isActive
                            ? 'border-gray-200 text-gray-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                            : 'border-gray-200 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                        }`}
                        title={isActive ? 'Deactivate User' : 'Activate User'}
                      >
                        {isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>

                      {u.email !== 'admin@honeypalace.com' && u.email !== user?.email && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 border border-gray-200 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-300"
                          title="Delete User Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Slide-out Panel for Add Staff Member */}
        {showSlideOut && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowSlideOut(false)} />
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-black/10 flex flex-col animate-in slide-in-from-right duration-300">
              <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Staff Member</h3>
                  <p className="text-xs text-gray-500 mt-1">Create an active account with instant login credentials.</p>
                </div>
                <button onClick={() => setShowSlideOut(false)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form id="invite-form" onSubmit={handleCreateUser} className="space-y-6 text-sm">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        className="bg-white border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                        value={newUser.full_name}
                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. john@honeypalace.com"
                        className="bg-white border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Initial Password</label>
                        <button
                          type="button"
                          onClick={generateRandomPassword}
                          className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" /> Generate Password
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="At least 6 characters"
                          className="w-full bg-white border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-3 py-2.5 pr-10 rounded-lg text-gray-900 font-mono text-xs outline-none"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-gray-50 border border-gray-100 rounded-xl">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-600" /> Initial Roles
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_ROLES.map(role => {
                        const isSelected = newUser.roles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => {
                              const updated = isSelected 
                                ? newUser.roles.filter(r => r !== role) 
                                : [...newUser.roles, role];
                              setNewUser({ ...newUser, roles: updated });
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-150 ${
                              isSelected 
                                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center ${
                              isSelected ? 'bg-amber-600 text-white' : 'border border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-200/60 rounded-xl flex gap-3 text-amber-900 text-xs leading-relaxed">
                    <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Automatic Email Delivery</span>
                      Login credentials (email, temporary password, role, and direct dashboard link) will be <strong>sent straight to their email address</strong> automatically upon creation.
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-black/5 bg-gray-50">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSlideOut(false)}
                    className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="invite-form"
                    disabled={isInviting}
                    className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    {isInviting ? 'Creating & Sending...' : 'Create Staff Member'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Account Created Confirmation with Credentials */}
        {createdCredentials && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCreatedCredentials(null)} />
            <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-gray-100 z-10 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Account Created!</h3>
                  <p className="text-xs text-gray-500">Staff account is active and credentials have been dispatched.</p>
                </div>
              </div>

              {createdCredentials.emailSent ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 font-medium">
                  <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Login credentials have been emailed straight to <strong>{createdCredentials.email}</strong>.</span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800">
                  Account is active. Please copy the credentials below to share with the staff member.
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-sans font-medium">Name:</span>
                  <span className="font-bold text-gray-900 font-sans">{createdCredentials.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-sans font-medium">Role:</span>
                  <span className="font-bold text-amber-700 font-sans">{createdCredentials.roles?.join(', ')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-sans font-medium">Email:</span>
                  <span className="text-gray-900 font-semibold">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-sans font-medium">Password:</span>
                  <span className="bg-amber-100/80 text-amber-900 px-2 py-0.5 rounded font-bold">{createdCredentials.password}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 font-sans font-medium">Login URL:</span>
                  <span className="text-blue-600 truncate max-w-[200px]">https://inventory.thehoneypalaceafrica.com/login</span>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const text = `🍯 The Honey Palace Africa — Staff Login\nName: ${createdCredentials.name}\nRole: ${createdCredentials.roles?.join(', ')}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nLogin at: https://inventory.thehoneypalaceafrica.com/login`;
                    navigator.clipboard.writeText(text);
                    setCopiedCredentials(true);
                    toast.success('Credentials copied to clipboard!');
                    setTimeout(() => setCopiedCredentials(false), 2500);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-50 border border-amber-300 text-amber-900 font-semibold rounded-xl text-xs hover:bg-amber-100 transition"
                >
                  <Copy className="w-4 h-4" />
                  {copiedCredentials ? 'Copied!' : 'Copy Credentials'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedCredentials(null)}
                  className="py-2.5 px-5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl text-xs transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Reset Password */}
        {resetPasswordModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
              onClick={() => setResetPasswordModal({ isOpen: false, user: null, newPassword: '', showPassword: false, loading: false })} 
            />
            <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-gray-100 z-10 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
                    <p className="text-xs text-gray-500 font-mono">{resetPasswordModal.user?.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setResetPasswordModal({ isOpen: false, user: null, newPassword: '', showPassword: false, loading: false })}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-700 uppercase tracking-wide">New Password</label>
                    <button
                      type="button"
                      onClick={generateResetPassword}
                      className="text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Generate Password
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={resetPasswordModal.showPassword ? "text" : "password"}
                      required
                      placeholder="At least 6 characters"
                      className="w-full bg-white border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-3 py-2.5 pr-10 rounded-lg text-gray-900 font-mono outline-none"
                      value={resetPasswordModal.newPassword}
                      onChange={(e) => setResetPasswordModal({ ...resetPasswordModal, newPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setResetPasswordModal({ ...resetPasswordModal, showPassword: !resetPasswordModal.showPassword })}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      tabIndex={-1}
                    >
                      {resetPasswordModal.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetPasswordModal({ isOpen: false, user: null, newPassword: '', showPassword: false, loading: false })}
                    className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetPasswordModal.loading}
                    className="flex-1 py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition disabled:opacity-50"
                  >
                    {resetPasswordModal.loading ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: My Profile */}
        {activeTab === 'profile' && (
          <div className="bg-white border border-black/5 p-6 md:p-8 rounded-2xl shadow-sm space-y-8">
            <div className="flex items-center gap-6 border-b border-black/5 pb-6">
              <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center font-bold text-blue-600 text-2xl">
                {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'ST'}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{user?.full_name || 'Staff Member'}</h3>
                <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
                <div className="flex gap-2 mt-3">
                  {roles.map(r => (
                    <span key={r} className="px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-bold uppercase rounded-md tracking-wider">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); toast.success('Profile details saved successfully!'); }} className="space-y-6 max-w-md text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Display Name</label>
                  <input
                    type="text"
                    required
                    defaultValue={user?.full_name || ''}
                    className="bg-white border border-gray-200 focus:border-blue-500 px-3 py-2 rounded-lg text-gray-900 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Contact Phone</label>
                  <input
                    type="text"
                    defaultValue={user?.phone || ''}
                    placeholder="e.g. +233 54 883 4874"
                    className="bg-white border border-gray-200 focus:border-blue-500 px-3 py-2 rounded-lg text-gray-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">New Password</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  className="bg-white border border-gray-200 focus:border-blue-500 px-3 py-2 rounded-lg text-gray-900 outline-none"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-all shadow-sm"
              >
                Save Details
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: Notifications Settings */}
        {activeTab === 'notifications' && (
          <div className="bg-white border border-black/5 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">System Notification Rules</h3>
              <p className="text-sm text-gray-500 mt-1">Manage where and when email/SMS updates get dispatched.</p>
            </div>

            <div className="divide-y divide-black/5 border-t border-black/5 pt-2">
              <div className="flex items-center justify-between py-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Email Copies of Invoices</h4>
                  <p className="text-xs text-gray-500 mt-1">Automatically CC sales team when a client invoice is sent.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={notifs.emailInvoices}
                  onChange={(e) => { setNotifs({ ...notifs, emailInvoices: e.target.checked }); toast.success('Settings updated!'); }}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Low Honey Stock SMS Alerts</h4>
                  <p className="text-xs text-gray-500 mt-1">Alert production manager when stock quantities drop below 20 units.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={notifs.smsLowStock}
                  onChange={(e) => { setNotifs({ ...notifs, smsLowStock: e.target.checked }); toast.success('Settings updated!'); }}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">New Sale POS Email Logs</h4>
                  <p className="text-xs text-gray-500 mt-1">Send a digital receipt logs summary on point-of-sale checkout.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={notifs.emailSales}
                  onChange={(e) => { setNotifs({ ...notifs, emailSales: e.target.checked }); toast.success('Settings updated!'); }}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Device Push Notifications Panel */}
            <div className="border-t border-black/5 pt-6 mt-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Device Push Notifications</h3>
                <p className="text-sm text-gray-500 mt-1">Enable this device to receive real-time order alerts and audio chimes, even when the browser or app is in the background.</p>
              </div>
              
              <div className="mt-4 p-4 bg-[#ffa200]/5 rounded-2xl border border-[#ffa200]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-gray-900 text-sm">Real-time Order Alerts</h4>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Receive immediate screen notifications and sound alerts when customers place new honey orders online.</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Status:</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      notificationPermission === 'granted'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : notificationPermission === 'denied'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {notificationPermission === 'granted' ? 'Enabled' : notificationPermission === 'denied' ? 'Blocked' : 'Not Configured'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleEnableNotifications}
                  disabled={notificationPermission === 'granted'}
                  className={`px-4 py-2.5 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-sm whitespace-nowrap cursor-pointer ${
                    notificationPermission === 'granted'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 cursor-default'
                      : 'bg-[#ffa200] hover:bg-[#e08f00] text-black'
                  }`}
                >
                  {notificationPermission === 'granted' ? (
                    <>✓ Enabled on this Device</>
                  ) : (
                    <>
                      <Smartphone className="w-3.5 h-3.5" />
                      Enable on this Device
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Activity Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900">System Activity Logs</h3>
                <p className="text-xs text-gray-500">Recent audit activity across accounts and system operations</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/logs"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition active:scale-95"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Open Full Audit Center →</span>
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-black/5 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold">Timestamp</th>
                    <th className="p-4 font-bold">Module</th>
                    <th className="p-4 font-bold">User</th>
                    <th className="p-4 font-bold">Action</th>
                    <th className="p-4 font-bold">Target Ref</th>
                    <th className="p-4 font-bold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {dbLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
                          {log.module || 'SYSTEM'}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-gray-900 text-xs">{log.userName || 'System'}</p>
                        <p className="text-[11px] text-gray-400">{log.userEmail || ''}</p>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-xs font-semibold">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono text-xs">
                        {log.targetId ? (
                          <span className="bg-gray-100 text-gray-800 font-semibold px-2 py-0.5 rounded border border-gray-200">
                            #{log.targetId}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-700 text-xs max-w-xs leading-relaxed">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                  {dbLogs.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500 text-sm">
                        No recent activity logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: System Configuration Settings */}
        {activeTab === 'system' && (
          <form onSubmit={handleSaveSettings} className="space-y-8">
            {/* Store Operations */}
            <div className="bg-white border border-black/5 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Store Operations</h3>
                <p className="text-sm text-gray-500 mt-1">Control online shop visibility and ordering capacity.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="flex items-center justify-between p-4 bg-gray-50 border border-black/5 rounded-xl">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Online Shop Status</h4>
                    <p className="text-xs text-gray-500 mt-1">Toggle whether the public shop is open or closed.</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleStoreOpen}
                    className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${
                      isStoreOpen 
                        ? 'bg-emerald-150 text-emerald-800 border border-emerald-300' 
                        : 'bg-rose-150 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {isStoreOpen ? 'Open' : 'Closed'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 border border-black/5 rounded-xl">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Busy Mode</h4>
                    <p className="text-xs text-gray-500 mt-1">Display warning badge on frontend for delay in deliveries.</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleBusyMode}
                    className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${
                      isBusyMode 
                        ? 'bg-amber-150 text-amber-800 border border-amber-300' 
                        : 'bg-gray-150 text-gray-600 border border-gray-300'
                    }`}
                  >
                    {isBusyMode ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            </div>

            {/* Business Contact Info */}
            <div className="bg-white border border-black/5 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Business Details</h3>
                <p className="text-sm text-gray-500 mt-1">General business contact information rendered on customer correspondences.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Company Name</label>
                  <input
                    type="text"
                    required
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.companyName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Support Email</label>
                  <input
                    type="email"
                    required
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.companyEmail}
                    onChange={(e) => setSettingsForm({ ...settingsForm, companyEmail: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Company Phone</label>
                  <input
                    type="text"
                    required
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.companyPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, companyPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Warehouse / Office Address</label>
                <input
                  type="text"
                  required
                  className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                  value={settingsForm.companyAddress}
                  onChange={(e) => setSettingsForm({ ...settingsForm, companyAddress: e.target.value })}
                />
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-white border border-black/5 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Payment Accounts (Invoices)</h3>
                <p className="text-sm text-gray-500 mt-1">Configure the Mobile Money (MoMo) and bank accounts printed on customer invoices.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Mobile Money Network</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MTN Mobile Money"
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.momoNetwork}
                    onChange={(e) => setSettingsForm({ ...settingsForm, momoNetwork: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">MoMo Account Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +233 54 883 4874"
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.momoNumber}
                    onChange={(e) => setSettingsForm({ ...settingsForm, momoNumber: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">GCB Bank Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GCB Bank"
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.bankName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Bank Account Holder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The Honey Palace"
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.bankAccountName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountName: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Bank Branch</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Accra Branch"
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.bankBranch}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankBranch: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Bank Account Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1234567890123"
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.bankAccountNo}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountNo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Stock Alerts */}
            <div className="bg-white border border-black/5 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Inventory Stock Alerts</h3>
                <p className="text-sm text-gray-500 mt-1">Configure minimum stock quantities and target contact for automated alerts.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Low Stock Qty Threshold</label>
                  <input
                    type="number"
                    required
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.lowStockThreshold}
                    onChange={(e) => setSettingsForm({ ...settingsForm, lowStockThreshold: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Alert Email Address</label>
                  <input
                    type="email"
                    required
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.alertEmail}
                    onChange={(e) => setSettingsForm({ ...settingsForm, alertEmail: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Alert SMS Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 233548834874"
                    className="bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2.5 rounded-lg text-gray-900 outline-none"
                    value={settingsForm.alertPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, alertPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
              >
                {savingSettings ? 'Saving Settings...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthShield>
  );
}
