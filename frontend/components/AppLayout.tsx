'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { ProtectedRoute } from './ProtectedRoute';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden min-h-screen">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default AppLayout;

