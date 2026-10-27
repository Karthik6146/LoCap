'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/app', label: 'Dashboard', path: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
  { href: '/app/projects', label: 'Projects', path: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' },
  { href: '/app/clips', label: 'AI Clips', path: 'M4 3l16 18 M4 21L20 3 M7 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M7 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0' },
  { href: '/app/exports', label: 'Exports', path: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5' },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  function closeMenu() { setSidebarOpen(false); menuButton.current?.focus(); }
  useEffect(() => {
    if (!sidebarOpen) return;
    closeButton.current?.focus();
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [sidebarOpen]);
  return (
    <div className="min-h-screen flex">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {/* Sidebar */}
      <aside onKeyDown={e => {
        if (e.key !== 'Tab' || !sidebarOpen || window.innerWidth >= 1024) return;
        const controls = e.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }} id="app-navigation" className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-surface border-r border-border transform transition-transform duration-200 lg:hidden ${sidebarOpen ? "translate-x-0 visible" : "-translate-x-full invisible"}`}>
        <button ref={closeButton} className="btn btn-ghost lg:hidden m-2" onClick={closeMenu}>Close menu</button>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border">
            <Link href="/app" className="flex items-center gap-2">
              <svg className="h-8 w-8 text-primary" viewBox="0 0 32 32" fill="currentColor">
                <rect x="2" y="2" width="28" height="28" rx="6" />
                <polygon points="10,10 22,16 10,22" className="text-white" />
              </svg>
              <span className="font-display font-bold text-xl">LoCap</span>
            </Link>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                onClick={closeMenu}
                href={item.href}
                aria-current={(item.href === '/app' ? pathname === item.href : pathname.startsWith(item.href)) ? 'page' : undefined}
                className={'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ' + ((item.href === '/app' ? pathname === item.href : pathname.startsWith(item.href)) ? 'bg-primary/10 text-white border border-primary/20' : 'text-gray-400 hover:text-white hover:bg-surface2 border border-transparent')}
              >
                <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={item.path} /></svg>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2 mb-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                U
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Local workspace</p>
                <p className="text-xs text-gray-500 truncate">Your creative space</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-0 min-w-0">
        <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-surface2"
              onClick={() => setSidebarOpen(true)}
              ref={menuButton}
              aria-expanded={sidebarOpen}
              aria-controls="app-navigation"
              aria-label="Open menu"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <Link href="/app" className="font-display font-bold text-xl mr-auto ml-3 lg:ml-0">Lo<span className="text-primary">Cap</span></Link>
            <nav className="workspace-nav hidden lg:flex" aria-label="Main navigation">{NAV.map(item => <Link key={item.href} href={item.href} aria-current={(item.href === '/app' ? pathname === item.href : pathname.startsWith(item.href)) ? 'page' : undefined}>{item.label}</Link>)}</nav>
            <div className="flex items-center gap-4 ml-auto">
              <Link href="/app/projects/new" className="btn btn-primary">+ Create New</Link>
            </div>
          </div>
        </header>
        <div id="main-content" tabIndex={-1} className="p-4 lg:p-8 max-w-[1800px] mx-auto outline-none">{children}</div>
      </main>
    </div>
  );
}