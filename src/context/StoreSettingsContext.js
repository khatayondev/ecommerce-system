'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const StoreSettingsContext = createContext({});

export const DEFAULT_DELIVERY_ZONES = [
  {
    id: 'accra_local',
    name: 'Amrahia, Adenta, Oyibi, Madina, Dodowa, Oyarifa',
    region: 'Greater Accra Local',
    fee: 20,
    eta: 'Same Day / Next Day',
    isActive: true
  },
  {
    id: 'accra_metro',
    name: 'East Legon, Airport, Dzorwulu, Cantonments, Osu, Labone, Spintex',
    region: 'Accra Core Metro',
    fee: 35,
    eta: 'Next Day Dispatch',
    isActive: true
  },
  {
    id: 'accra_west',
    name: 'Achimota, Dome, Lapaz, Dansoman, Kaneshie, Weija, Kasoa',
    region: 'Greater Accra West',
    fee: 45,
    eta: '1 – 2 Business Days',
    isActive: true
  },
  {
    id: 'tema_region',
    name: 'Tema (Comm 1–25), Ashaiman, Kpone, Dawhenya, Prampram',
    region: 'Tema & Industrial',
    fee: 40,
    eta: 'Next Day Dispatch',
    isActive: true
  },
  {
    id: 'regional_express',
    name: 'Kumasi, Takoradi, Cape Coast, Sunyani, Ho, Koforidua',
    region: 'Inter-Regional VIP Courier',
    fee: 65,
    eta: '2 – 3 Business Days',
    isActive: true
  }
];

const DEFAULT_SETTINGS = {
  companyName: "The Honey Palace Africa",
  companyEmail: "info@thehoneypalace.com",
  companyPhone: "+233 54 883 4874",
  companyAddress: "Amrahia, Greater Accra, Ghana",
  momoNetwork: "MTN Mobile Money",
  momoNumber: "+233 54 883 4874",
  bankName: "GCB Bank",
  bankBranch: "Accra Branch",
  bankAccountName: "The Honey Palace",
  bankAccountNo: "1234567890123",
  lowStockThreshold: 10,
  alertEmail: "hello@thehoneypalaceafrica.com",
  alertPhone: "233000000000",
  freeShippingThreshold: 300,
  deliveryZones: DEFAULT_DELIVERY_ZONES
};

export function StoreSettingsProvider({ children }) {
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [isBusyMode, setIsBusyMode] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    const forceSandbox = process.env.NEXT_PUBLIC_FORCE_SANDBOX === 'true';

    if (!db || forceSandbox) {
      console.log(forceSandbox ? "Sandbox Mode forced via env variable for store settings." : "Firebase DB not available. Running in sandbox store settings mode.");
      setIsMock(true);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'store_settings', 'main');
    
    // Listen for real-time changes
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsStoreOpen(data.isStoreOpen !== undefined ? data.isStoreOpen : true);
        setIsBusyMode(data.isBusyMode !== undefined ? data.isBusyMode : false);
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      } else {
        // Initialize if doesn't exist (catch permission errors if unauthenticated)
        try {
          setDoc(docRef, { isStoreOpen: true, isBusyMode: false, settings: DEFAULT_SETTINGS });
        } catch (e) {
          console.warn("[StoreSettingsContext] Could not seed initial store settings:", e.message);
        }
        setIsStoreOpen(true);
        setIsBusyMode(false);
        setSettings(DEFAULT_SETTINGS);
      }
      setIsMock(false);
      setLoading(false);
    }, (err) => {
      console.warn("[StoreSettingsContext] Permission/Load warning:", err.message);
      setIsMock(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleStoreOpen = async () => {
    const newVal = !isStoreOpen;
    setIsStoreOpen(newVal);
    if (!isMock && db) {
      try {
        const docRef = doc(db, 'store_settings', 'main');
        await setDoc(docRef, { isStoreOpen: newVal }, { merge: true });
      } catch (err) {
        console.error("Failed to update store status on DB:", err);
      }
    }
  };

  const toggleBusyMode = async () => {
    const newVal = !isBusyMode;
    setIsBusyMode(newVal);
    if (!isMock && db) {
      try {
        const docRef = doc(db, 'store_settings', 'main');
        await setDoc(docRef, { isBusyMode: newVal }, { merge: true });
      } catch (err) {
        console.error("Failed to update busy mode on DB:", err);
      }
    }
  };

  const updateSettings = async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    if (!isMock && db) {
      try {
        const docRef = doc(db, 'store_settings', 'main');
        await setDoc(docRef, { settings: merged }, { merge: true });
      } catch (err) {
        console.error("Failed to update configuration on DB:", err);
        throw err;
      }
    }
  };

  return (
    <StoreSettingsContext.Provider value={{
      isStoreOpen,
      isBusyMode,
      settings,
      loading,
      toggleStoreOpen,
      toggleBusyMode,
      updateSettings
    }}>
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  return useContext(StoreSettingsContext);
}
