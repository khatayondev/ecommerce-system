'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

// Fallback Mock Users for Sandbox Mode
const MOCK_ACCOUNTS = {
  'thehoneypalace2022@gmail.com': { uid: 'mock-admin', full_name: 'Admin CEO', email: 'thehoneypalace2022@gmail.com', roles: ['Admin', 'CEO'], is_active: true },
  'sales@honeypalace.com': { uid: 'mock-sales', full_name: 'Kofi Mensah', email: 'sales@honeypalace.com', roles: ['Sales Exec'], is_active: true },
  'cashier@honeypalace.com': { uid: 'mock-cashier', full_name: 'Akua Cashier', email: 'cashier@honeypalace.com', roles: ['Cashier'], is_active: true },
  'inventory@honeypalace.com': { uid: 'mock-inventory', full_name: 'Ama Serwaa', email: 'inventory@honeypalace.com', roles: ['Inventory'], is_active: true },
  'accountant@honeypalace.com': { uid: 'mock-accountant', full_name: 'Yao Boateng', email: 'accountant@honeypalace.com', roles: ['Accountant'], is_active: true },
  'manager@honeypalace.com': { uid: 'mock-manager', full_name: 'Operations Manager', email: 'manager@honeypalace.com', roles: ['Manager'], is_active: true },
};

const getMockAccounts = () => {
  if (typeof window === 'undefined') return MOCK_ACCOUNTS;
  const stored = localStorage.getItem('mock_users');
  if (stored) {
    try {
      const list = JSON.parse(stored);
      const accounts = {};
      list.forEach(u => {
        accounts[u.email.toLowerCase()] = {
          uid: u.id,
          full_name: u.full_name,
          email: u.email,
          roles: u.roles,
          is_active: u.is_active !== false
        };
      });
      return accounts;
    } catch (e) {
      console.error("Error parsing mock_users from localStorage:", e);
    }
  }
  return MOCK_ACCOUNTS;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [is2FaVerified, setIs2FaVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    if (user) {
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      let verified = false;

      if (typeof window !== 'undefined') {
        const localVal = localStorage.getItem(`hp_2fa_verified_${user.uid}`);
        const sessionVal = sessionStorage.getItem(`hp_2fa_verified_${user.uid}`);
        
        const checkValid = (val) => {
          if (!val) return false;
          if (val === 'true') return true; // backward compatibility
          const ts = Number(val);
          return !isNaN(ts) && (Date.now() - ts) < TWENTY_FOUR_HOURS;
        };

        verified = checkValid(sessionVal) || checkValid(localVal);
      }
      setIs2FaVerified(verified);
    } else {
      setIs2FaVerified(false);
    }
  }, [user]);

  useEffect(() => {
    // Restore persistent session from localStorage immediately on mount
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('hp_persistent_user') || localStorage.getItem('sandbox_user');
      const savedRoles = localStorage.getItem('hp_persistent_roles') || localStorage.getItem('sandbox_roles');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          let parsedRoles = savedRoles ? JSON.parse(savedRoles) : ['Admin', 'CEO'];
          const emailLower = (parsedUser.email || '').toLowerCase().trim();
          const isStagingEnv = 
            process.env.NEXT_PUBLIC_USE_STAGING_FIREBASE === 'true' || 
            process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

          if ((emailLower === 'thehoneypalace2022@gmail.com' || emailLower.includes('admin') || isStagingEnv) && 
              !parsedRoles.includes('Admin') && !parsedRoles.includes('CEO')) {
            parsedRoles = ['Admin', 'CEO'];
            localStorage.setItem('hp_persistent_roles', JSON.stringify(parsedRoles));
          }
          setUser(parsedUser);
          setRoles(parsedRoles);
        } catch (e) {}
      }
    }

    if (auth) {
      setPersistence(auth, browserLocalPersistence).catch(err => 
        console.warn("[AuthContext] Could not set browser local persistence:", err.message)
      );
    }

    const forceSandbox = process.env.NEXT_PUBLIC_FORCE_SANDBOX === 'true';
    
    // If Firebase Auth is not initialized/accessible, or sandbox is forced, use Sandbox Mode
    if (!auth || !db || forceSandbox) {
      console.log(forceSandbox ? "Sandbox Mode forced via env variable." : "Firebase Auth or DB not available. Running in sandbox auth mode.");
      setSandbox(true);
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('sandbox_user') || localStorage.getItem('hp_persistent_user');
        const storedRoles = localStorage.getItem('sandbox_roles') || localStorage.getItem('hp_persistent_roles');
        if (storedUser && storedRoles) {
          setUser(JSON.parse(storedUser));
          setRoles(JSON.parse(storedRoles));
        }
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          let userDoc = await getDoc(userDocRef);
          
          let userData = null;

          if (userDoc.exists()) {
            userData = userDoc.data();
            
            // Self-healing migration for existing duplicates:
            const emailDocRef = doc(db, 'users', firebaseUser.email);
            const emailDoc = await getDoc(emailDocRef);
            if (emailDoc.exists()) {
              const seedData = emailDoc.data();
              const seedRoles = seedData.role || seedData.roles || [];
              const currentRoles = userData.role || userData.roles || ['Sales Exec'];
              
              if (seedRoles.length > 0 && (currentRoles.includes('Sales Exec') && currentRoles.length === 1)) {
                console.log(`[SELF-HEALING] Merging seed roles ${seedRoles} into UID doc for ${firebaseUser.email}`);
                userData.role = seedRoles;
                userData.roles = seedRoles;
                userData.active = seedData.active !== undefined ? seedData.active : (seedData.is_active !== undefined ? seedData.is_active : true);
                userData.is_active = userData.active;
                await setDoc(userDocRef, userData);
              }
              await deleteDoc(emailDocRef);
            }
          } else {
            const emailDocRef = doc(db, 'users', firebaseUser.email);
            const emailDoc = await getDoc(emailDocRef);
            if (emailDoc.exists()) {
              userData = emailDoc.data();
              userData.uid = firebaseUser.uid;
              
              const resolvedRoles = userData.role || userData.roles || ['Sales Exec'];
              const resolvedActive = userData.active !== undefined ? userData.active : (userData.is_active !== undefined ? userData.is_active : true);
              
              userData.role = resolvedRoles;
              userData.roles = resolvedRoles;
              userData.active = resolvedActive;
              userData.is_active = resolvedActive;
              
              await setDoc(userDocRef, userData);
              await deleteDoc(emailDocRef);
            }
          }

          const emailLower = (firebaseUser.email || '').toLowerCase().trim();
          const isStagingEnv = 
            process.env.NEXT_PUBLIC_USE_STAGING_FIREBASE === 'true' || 
            process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

          const shouldBeAdmin = 
            emailLower === 'thehoneypalace2022@gmail.com' ||
            emailLower.includes('admin') ||
            isStagingEnv;

          if (userData) {
            if (userData.active === false || userData.is_active === false) {
              await signOut(auth);
              setUser(null);
              setRoles([]);
              toast.error("Your account is deactivated. Contact an administrator.");
            } else {
              let resolvedRoles = userData.role || userData.roles || ['Sales Exec'];
              
              // Automatically promote owner or staging user to Admin + CEO
              if (shouldBeAdmin && (!resolvedRoles.includes('Admin') && !resolvedRoles.includes('CEO'))) {
                console.log(`[AUTH] Elevating ${firebaseUser.email} to Admin & CEO roles.`);
                resolvedRoles = ['Admin', 'CEO'];
                userData.role = resolvedRoles;
                userData.roles = resolvedRoles;
                try {
                  await setDoc(userDocRef, { role: resolvedRoles, roles: resolvedRoles }, { merge: true });
                } catch (elevateErr) {
                  console.warn("Could not save elevated roles to Firestore:", elevateErr.message);
                }
              }

              const emailPrefix = (firebaseUser.email || '').split('@')[0].replace(/[._-]/g, ' ');
              const dynamicFallbackName = emailPrefix
                ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
                : (shouldBeAdmin ? 'Admin' : 'Staff');

              const userObj = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                full_name: userData.full_name || firebaseUser.displayName || dynamicFallbackName,
              };
              setUser(userObj);
              setRoles(resolvedRoles);

              if (typeof window !== 'undefined') {
                localStorage.setItem('hp_persistent_user', JSON.stringify(userObj));
                localStorage.setItem('hp_persistent_roles', JSON.stringify(resolvedRoles));
              }
            }
          } else {
            const emailPrefix = (firebaseUser.email || '').split('@')[0].replace(/[._-]/g, ' ');
            const dynamicFallbackName = emailPrefix
              ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
              : (shouldBeAdmin ? 'Admin' : 'Staff');
            const defaultRoles = shouldBeAdmin ? ['Admin', 'CEO'] : ['Sales Exec'];
            const defaultUser = {
              full_name: firebaseUser.displayName || dynamicFallbackName,
              email: firebaseUser.email,
              role: defaultRoles,
              roles: defaultRoles,
              active: true,
              created_at: new Date().toISOString()
            };
            try {
              await setDoc(userDocRef, defaultUser);
            } catch (createErr) {
              console.warn("Could not save initial user to Firestore:", createErr.message);
            }
            const userObj = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              full_name: defaultUser.full_name,
            };
            setUser(userObj);
            setRoles(defaultRoles);

            if (typeof window !== 'undefined') {
              localStorage.setItem('hp_persistent_user', JSON.stringify(userObj));
              localStorage.setItem('hp_persistent_roles', JSON.stringify(defaultRoles));
            }
          }
        } catch (error) {
          console.error("Error loading user profile from Firestore:", error);
          const emailLower = (firebaseUser.email || '').toLowerCase().trim();
          const fallbackRoles = (emailLower === 'thehoneypalace2022@gmail.com' || emailLower.includes('admin'))
            ? ['Admin', 'CEO'] 
            : ['Sales Exec'];
          const emailPrefix = (firebaseUser.email || '').split('@')[0].replace(/[._-]/g, ' ');
          const dynamicFallbackName = emailPrefix
            ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
            : 'Staff';
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, full_name: dynamicFallbackName });
          setRoles(fallbackRoles);
        }
      } else {
        setUser(null);
        setRoles([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    let cleanEmail = email ? email.trim().toLowerCase() : '';
    if (cleanEmail && !cleanEmail.includes('@')) {
      if (cleanEmail === 'thehoneypalace2022' || cleanEmail === 'admin') {
        cleanEmail = 'thehoneypalace2022@gmail.com';
      } else {
        cleanEmail = `${cleanEmail}@honeypalaceafrica.com`;
      }
    } else if (cleanEmail === 'thehoneypalace2022@honeypalaceafrica.com' || cleanEmail === 'admin@honeypalaceafrica.com') {
      cleanEmail = 'thehoneypalace2022@gmail.com';
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('sandbox_user');
      localStorage.removeItem('sandbox_roles');
    }

    const forceSandbox = process.env.NEXT_PUBLIC_FORCE_SANDBOX === 'true';

    if (auth && !forceSandbox) {
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        setSandbox(false);
        return true;
      } catch (error) {
        if (
          process.env.NODE_ENV === 'development' &&
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ) {
          const mockAccounts = getMockAccounts();
          const mockAcc = mockAccounts[cleanEmail] || mockAccounts['thehoneypalace2022@gmail.com'];
          if (mockAcc && (password === 'admin123' || password === 'admin' || password === '123456')) {
            if (mockAcc.is_active === false) {
              setUser(null);
              setLoading(false);
              throw new Error("Your account is deactivated. Contact an administrator.");
            }
            console.log("Development fallback: Switching to Sandbox Mode for mock credentials.");
            setSandbox(true);
            const loggedUser = { uid: mockAcc.uid, email: mockAcc.email, full_name: mockAcc.full_name };
            setUser(loggedUser);
            setRoles(mockAcc.roles);
            localStorage.setItem('sandbox_user', JSON.stringify(loggedUser));
            localStorage.setItem('sandbox_roles', JSON.stringify(mockAcc.roles));
            setLoading(false);
            return true;
          }
        }
        setUser(null);
        setRoles([]);
        setLoading(false);
        throw error;
      }
    }

    const mockAccounts = getMockAccounts();
    const mockAcc = mockAccounts[cleanEmail] || mockAccounts['thehoneypalace2022@gmail.com'];
    if (mockAcc && (password === 'admin123' || password === 'admin' || password === '123456')) {
      if (mockAcc.is_active === false) {
        setUser(null);
        setLoading(false);
        throw new Error("Your account is deactivated. Contact an administrator.");
      }
      setSandbox(true);
      const loggedUser = { uid: mockAcc.uid, email: mockAcc.email, full_name: mockAcc.full_name };
      setUser(loggedUser);
      setRoles(mockAcc.roles);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sandbox_user', JSON.stringify(loggedUser));
        localStorage.setItem('sandbox_roles', JSON.stringify(mockAcc.roles));
      }
      setLoading(false);
      return true;
    }

    setUser(null);
    setRoles([]);
    setLoading(false);
    throw new Error("Invalid email or password.");
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    if (sandbox) {
      // In sandbox mode, login as Admin CEO
      const mockAccounts = getMockAccounts();
      const mockAcc = mockAccounts['thehoneypalace2022@gmail.com'] || MOCK_ACCOUNTS['thehoneypalace2022@gmail.com'];
      const loggedUser = { uid: mockAcc.uid, email: mockAcc.email, full_name: mockAcc.full_name };
      setUser(loggedUser);
      setRoles(mockAcc.roles);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sandbox_user', JSON.stringify(loggedUser));
        localStorage.setItem('sandbox_roles', JSON.stringify(mockAcc.roles));
      }
      setLoading(false);
      return true;
    }

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return true;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    if (typeof window !== 'undefined') {
      if (user) {
        sessionStorage.removeItem(`hp_2fa_verified_${user.uid}`);
        localStorage.removeItem(`hp_2fa_verified_${user.uid}`);
      }
      localStorage.removeItem('hp_persistent_user');
      localStorage.removeItem('hp_persistent_roles');
      localStorage.removeItem('sandbox_user');
      localStorage.removeItem('sandbox_roles');
    }
    setUser(null);
    setRoles([]);
    if (!sandbox && auth) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, roles, loading, sandbox, is2FaVerified, setIs2FaVerified, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
