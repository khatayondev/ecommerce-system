import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Universal Activity & Audit Logger
 * Supports multiple invocation patterns:
 * 1. Object signature:
 *    logAction({ module: 'INVOICES', action: 'CREATE_INVOICE', details: '...', targetId: 'MGL123', severity: 'success', userEmail, userName, metadata })
 * 2. Positional signature (4-5 args):
 *    logAction(userEmail, userName, action, details, { module, targetId, severity, metadata })
 * 3. Shorthand positional signature (2-3 args):
 *    logAction(action, details, { module, targetId, severity, userEmail, userName, metadata })
 */
export async function logAction(arg1, arg2, arg3, arg4, arg5 = {}) {
  if (!db) return;

  try {
    let payload = {};

    if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && !arg2) {
      // 1. Single object argument
      const {
        userEmail = 'admin@thehoneypalaceafrica.com',
        userName = 'Staff Member',
        module = 'SYSTEM',
        action = 'ACTION',
        details = '',
        targetId = null,
        severity = 'info',
        metadata = {}
      } = arg1;

      payload = {
        timestamp: new Date().toISOString(),
        userEmail,
        userName,
        module: String(module).toUpperCase(),
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        targetId: targetId ? String(targetId) : null,
        severity: ['info', 'success', 'warning', 'danger'].includes(severity?.toLowerCase())
          ? severity.toLowerCase()
          : 'info',
        metadata: typeof metadata === 'object' ? metadata : {},
      };
    } else if (typeof arg1 === 'string' && typeof arg2 === 'string' && typeof arg3 === 'string') {
      // 2. Positional: (userEmail, userName, action, details, options)
      const userEmail = arg1;
      const userName = arg2;
      const action = arg3;
      const details = arg4 || '';
      const options = (arg5 && typeof arg5 === 'object') ? arg5 : {};

      payload = {
        timestamp: new Date().toISOString(),
        userEmail: userEmail || 'system@thehoneypalaceafrica.com',
        userName: userName || 'Staff Member',
        module: String(options.module || inferModuleFromAction(action)).toUpperCase(),
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        targetId: options.targetId ? String(options.targetId) : null,
        severity: options.severity || inferSeverityFromAction(action),
        metadata: options.metadata || {},
      };
    } else if (typeof arg1 === 'string') {
      // 3. Shorthand: (action, details, options)
      const action = arg1;
      const details = arg2 || '';
      const options = (arg3 && typeof arg3 === 'object') ? arg3 : {};

      payload = {
        timestamp: new Date().toISOString(),
        userEmail: options.userEmail || 'admin@thehoneypalaceafrica.com',
        userName: options.userName || 'Admin',
        module: String(options.module || inferModuleFromAction(action)).toUpperCase(),
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        targetId: options.targetId ? String(options.targetId) : null,
        severity: options.severity || inferSeverityFromAction(action),
        metadata: options.metadata || {},
      };
    }

    if (payload.action) {
      await addDoc(collection(db, 'logs'), payload);
    }
  } catch (err) {
    console.error("Error logging action to Firestore:", err);
  }
}

/**
 * Intelligent module inference for backward-compatibility with older calls
 */
function inferModuleFromAction(action = '') {
  const act = action.toLowerCase();
  if (act.includes('invoice') || act.includes('proforma') || act.includes('quote')) return 'INVOICES';
  if (act.includes('order') || act.includes('delivery') || act.includes('courier')) return 'ORDERS';
  if (act.includes('stock') || act.includes('product') || act.includes('catalog')) return 'INVENTORY';
  if (act.includes('pos') || act.includes('cashier') || act.includes('receipt') || act.includes('checkout')) return 'POS';
  if (act.includes('role') || act.includes('user') || act.includes('account') || act.includes('password') || act.includes('auth')) return 'USERS';
  if (act.includes('message') || act.includes('sms') || act.includes('email') || act.includes('campaign') || act.includes('comm')) return 'COMMUNICATIONS';
  if (act.includes('expense') || act.includes('purchase') || act.includes('payment') || act.includes('finance')) return 'FINANCES';
  if (act.includes('setting') || act.includes('config')) return 'SETTINGS';
  return 'GENERAL';
}

/**
 * Intelligent severity inference for backward-compatibility
 */
function inferSeverityFromAction(action = '') {
  const act = action.toLowerCase();
  if (act.includes('delete') || act.includes('void') || act.includes('cancel') || act.includes('deactivate')) return 'danger';
  if (act.includes('alert') || act.includes('warning') || act.includes('fail') || act.includes('threshold')) return 'warning';
  if (act.includes('paid') || act.includes('create') || act.includes('complete') || act.includes('deliver') || act.includes('success')) return 'success';
  return 'info';
}
