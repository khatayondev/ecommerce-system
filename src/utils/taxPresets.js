/**
 * Standard business tax presets for Ghana & general corporate invoicing.
 * Custom option is placed at the top as requested.
 */
export const PRESET_TAXES = [
  { id: '__custom__', label: 'Custom Tax (Type your own)', name: '', defaultRate: '0', isDeduction: false },
  
  // Standard Indirect Taxes (Added to Invoice)
  { id: 'vat_std', label: 'VAT - Standard Rate (15%)', name: 'VAT (Standard)', defaultRate: '15', isDeduction: false },
  { id: 'vat_flat', label: 'VAT - Flat Rate Scheme (3%)', name: 'VAT (Flat Rate)', defaultRate: '3', isDeduction: false },
  { id: 'nhil', label: 'NHIL - National Health Insurance (2.5%)', name: 'NHIL', defaultRate: '2.5', isDeduction: false },
  { id: 'getfund', label: 'GETFund Levy (2.5%)', name: 'GETFund Levy', defaultRate: '2.5', isDeduction: false },
  { id: 'covid', label: 'COVID-19 Health Recovery Levy (1%)', name: 'COVID-19 Levy', defaultRate: '1', isDeduction: false },
  { id: 'tourism', label: 'Tourism Levy (1%)', name: 'Tourism Levy', defaultRate: '1', isDeduction: false },
  { id: 'sales_tax', label: 'General Sales Tax (5%)', name: 'Sales Tax', defaultRate: '5', isDeduction: false },

  // Withholding Taxes (Deducted from Invoice / Net Payment)
  { id: 'wht_goods', label: 'Withholding Tax - Supply of Goods (3%)', name: 'Withholding Tax (Goods)', defaultRate: '3', isDeduction: true },
  { id: 'wht_services', label: 'Withholding Tax - Supply of Services (5%)', name: 'Withholding Tax (Services)', defaultRate: '5', isDeduction: true },
  { id: 'wht_mgmt', label: 'Withholding Tax - Technical / Management (7.5%)', name: 'Withholding Tax (Tech/Mgmt)', defaultRate: '7.5', isDeduction: true },
  { id: 'wht_contracts', label: 'Withholding Tax - Works / Contracts (5%)', name: 'Withholding Tax (Contracts)', defaultRate: '5', isDeduction: true },
  { id: 'wht_rent', label: 'Withholding Tax - Commercial Rent (10%)', name: 'Withholding Tax (Rent)', defaultRate: '10', isDeduction: true },
  { id: 'wht_general', label: 'Withholding Tax - General (WHT)', name: 'Withholding Tax (WHT)', defaultRate: '3', isDeduction: true },
];
