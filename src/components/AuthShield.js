'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function AuthShield({ children, requiredPermission = null, alternativePermission = null }) {
  const { user, roles, loading, is2FaVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPage = pathname === '/login';

  useEffect(() => {
    if (!loading && !isPublicPage) {
      if (!user) {
        router.push('/login');
      } else if (!is2FaVerified) {
        router.push('/login');
      }
    }
  }, [user, loading, is2FaVerified, pathname, router, isPublicPage]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-dark text-white flex-col gap-4">
        <RefreshCw className="w-8 h-8 text-gold animate-spin" />
        <p className="text-sm font-medium text-text-muted">Verifying secure session...</p>
      </div>
    );
  }

  // If not logged in or not 2FA verified, and not on a public page, show empty while redirecting
  if ((!user || !is2FaVerified) && !isPublicPage) {
    return null;
  }

  // Allow public pages (login, signup) to render without constraints
  if (isPublicPage) {
    return <>{children}</>;
  }

  // If a specific permission is required, check the user's roles
  const hasRequired = requiredPermission ? hasPermission(roles, requiredPermission) : true;
  const hasAlternative = alternativePermission ? hasPermission(roles, alternativePermission) : false;
  if (requiredPermission && !hasRequired && !hasAlternative) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] max-w-md mx-auto text-center space-y-4 p-8">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-display font-semibold text-white">Access Denied</h3>
        <p className="text-sm text-text-muted leading-relaxed">
          Your account roles <strong className="text-gold">({roles.join(', ')})</strong> do not hold the required permission <code className="bg-bg-card px-2 py-1 rounded text-rose-400 font-mono text-xs">{requiredPermission}</code> to view this module.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2.5 bg-gold hover:bg-gold-light text-bg-dark font-semibold rounded-xl text-sm transition-all duration-300 shadow-lg shadow-gold/20"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
