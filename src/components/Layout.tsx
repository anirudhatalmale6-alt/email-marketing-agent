'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/apollo': 'Apollo Lead Finder',
  '/leads': 'Leads',
  '/templates': 'Templates',
  '/campaigns': 'Campaigns',
  '/settings': 'Settings',
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();

  const pageTitle = Object.entries(pageTitles).find(
    ([path]) => pathname === path || pathname?.startsWith(path + '/')
  )?.[1] ?? 'MailAgent AI';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      {/* Main content area offset by sidebar width */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-md px-8 py-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Notifications */}
            <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>

            {/* Profile */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
              U
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
