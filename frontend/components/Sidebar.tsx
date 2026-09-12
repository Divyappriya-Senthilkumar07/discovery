'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { ThemeToggle } from './ThemeToggle';
import {
  Rss,
  Building2,
  SlidersHorizontal,
  FileText,
  Globe2,
  Clock,
  Gauge,
  Settings,
  LogOut,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Discovery Feed', icon: Rss },
  { href: '/clients', label: 'Client DNA', icon: Building2 },
  { href: '/rules', label: 'Rule Engine', icon: SlidersHorizontal },
  { href: '/brief', label: 'Daily Briefs', icon: FileText },
  { href: '/sources', label: 'Source Intelligence', icon: Globe2 },
  { href: '/logs', label: 'Audit Timeline', icon: Clock },
  { href: '/benchmark', label: 'Benchmark Suite', icon: Gauge },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  if (pathname === '/login') {
    return null;
  }

  return (
    <aside className="w-64 bg-white dark:bg-[#0c1220] border-r border-slate-200 dark:border-slate-800/80 flex flex-col h-screen sticky top-0 z-30 select-none transition-colors duration-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">Discover</h1>
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">News Discovery Platform</p>
          </div>
        </div>
        <ThemeToggle variant="compact" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Badge & Logout */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm mb-2">
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{user?.email || 'analyst@discover.ai'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-cyan-500' : 'bg-indigo-500'}`} />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize font-medium">{user?.role || 'analyst'}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
