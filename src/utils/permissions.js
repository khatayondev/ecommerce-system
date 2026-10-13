// RBAC Matrix mapping roles to permission codes (based on URD Section 6.2)
const ROLE_PERMISSIONS = {
  Admin: [
    'user.manage', 'role.assign', 'user.view', 'category.manage',
    'product.create', 'product.edit', 'product.delete', 'product.view', 'product.view_cost',
    'stock.view', 'stock.adjust',
    'sale.create', 'sale.discount', 'sale.void', 'sale.view',
    'payment.record', 'payment.refund', 'customer.manage', 'customer.view',
    'supplier.manage', 'supplier.view', 'purchase.create', 'purchase.approve', 'purchase.receive',
    'exhibition.manage', 'expense.manage', 'report.view', 'data.export', 'settings.manage',
    'order.view', 'order.accept', 'order.process', 'order.assign_delivery', 'order.cancel', 'order.refund', 'store.toggle',
    'promo.manage', 'blog.manage'
  ],
  CEO: [
    'user.view', 'category.manage', 'product.create', 'product.edit', 'product.delete', 'product.view', 'product.view_cost',
    'stock.view', 'stock.adjust',
    'sale.create', 'sale.discount', 'sale.void', 'sale.view',
    'payment.record', 'payment.refund', 'customer.manage', 'customer.view',
    'supplier.manage', 'supplier.view', 'purchase.create', 'purchase.approve', 'purchase.receive',
    'exhibition.manage', 'expense.manage', 'report.view', 'data.export',
    'order.view', 'order.accept', 'order.process', 'order.assign_delivery', 'order.cancel', 'order.refund', 'store.toggle',
    'promo.manage', 'blog.manage'
  ],
  Manager: [
    'user.view', 'category.manage', 'product.create', 'product.edit', 'product.delete', 'product.view', 'product.view_cost',
    'stock.view', 'stock.adjust',
    'sale.create', 'sale.discount', 'sale.void', 'sale.view',
    'payment.record', 'payment.refund', 'customer.manage', 'customer.view',
    'supplier.manage', 'supplier.view', 'purchase.create', 'purchase.approve', 'purchase.receive',
    'exhibition.manage', 'report.view',
    'order.view', 'order.accept', 'order.process', 'order.assign_delivery', 'order.cancel', 'order.refund', 'store.toggle',
    'promo.manage', 'blog.manage'
  ],
  'Sales Exec': [
    'product.view', 'sale.create', 'sale.view', 
    'payment.record', 'customer.manage', 'customer.view',
    'order.view', 'order.accept', 'order.process', 'order.assign_delivery'
  ],
  'Order Staff': [
    'order.view', 'order.accept', 'order.process', 'order.assign_delivery', 'product.view'
  ],
  Cashier: [
    'product.view', 'sale.create', 'payment.record'
  ],
  Inventory: [
    'product.view', 'stock.view', 'stock.adjust', 
    'supplier.manage', 'supplier.view', 'purchase.create', 'purchase.receive',
    'order.view', 'order.process'
  ],
  Accountant: [
    'product.view', 'product.view_cost', 'sale.view',
    'supplier.view', 'expense.manage', 'report.view', 'data.export',
    'order.view', 'order.refund'
  ]
};

/**
 * Check if the user's assigned roles carry a specific permission code.
 * @param {string[]} userRoles - List of roles assigned to the user (e.g. ['Sales Exec'])
 * @param {string} permission - The permission code to verify (e.g. 'product.view_cost')
 * @returns {boolean}
 */
export function hasPermission(userRoles, permission) {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  
  // Admin has absolute access to every permission
  if (userRoles.some(r => String(r).toLowerCase() === 'admin')) return true;

  // Check if any assigned role contains the target permission code
  return userRoles.some(role => {
    const matchedKey = Object.keys(ROLE_PERMISSIONS).find(
      k => k.toLowerCase() === String(role).toLowerCase()
    );
    const permissions = ROLE_PERMISSIONS[matchedKey] || ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  });
}
