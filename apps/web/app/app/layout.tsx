'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, Folder, LayoutGrid, Menu, Plus, Scissors, X } from 'lucide-react';
import { Logo } from '@/components/ui';

const NAV = [
  { href: '/app', label: 'Dashboard', Icon: LayoutGrid },
  { href: '/app/projects', label: 'Projects', Icon: Folder },
  { href: '/app/clips', label: 'Clips', Icon: Scissors },
  { href: '/app/exports', label: 'Exports', Icon: Download },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isActive = (href: string) => (href === '/app' ? pathname === href : pathname.startsWith(href));

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
      {/* Mobile navigation drawer */}
      <aside onKeyDown={e => {
        if (e.key !== 'Tab' || !sidebarOpen || window.innerWidth >= 1024) return;
        const controls = e.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }} id="app-navigation" className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-surface border-r border-border transition-transform duration-200 lg:hidden ${sidebarOpen ? 'translate-x-0 visible' : '-translate-x-full invisible'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <Link href="/app" aria-label="LoCap dashboard" onClick={closeMenu}><Logo /></Link>
            <button ref={closeButton} className="btn-text w-10" onClick={closeMenu} aria-label="Close menu">
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto" aria-label="Main navigation">
            {NAV.map(({ href, label, Icon }) => (
              <Link
                key={href}
                onClick={closeMenu}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={'flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors ' + (isActive(href) ? 'bg-surface2 text-gray-100' : 'text-gray-400 hover:text-gray-100 hover:bg-surface2')}
              >
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" className={isActive(href) ? 'text-primary' : ''} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-border flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-surface3 flex items-center justify-center text-sm text-gray-400" aria-hidden="true">L</div>
            <div className="min-w-0">
              <p className="text-sm text-gray-100 truncate">Local workspace</p>
              <p className="text-xs text-gray-500 truncate">On this computer</p>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={closeMenu} aria-hidden="true" />
      )}

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-xl border-b border-border">
          <div className="flex justify-between lg:grid lg:grid-cols-[1fr_auto_1fr] items-center h-16 px-4 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                className="btn-text w-10 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                ref={menuButton}
                aria-expanded={sidebarOpen}
                aria-controls="app-navigation"
                aria-label="Open menu"
              >
                <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <Link href="/app" aria-label="LoCap dashboard"><Logo /></Link>
            </div>
            <nav className="workspace-nav hidden lg:flex" aria-label="Main navigation">
              {NAV.map(({ href, label }) => <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}>{label}</Link>)}
            </nav>
            <div className="flex items-center justify-end">
              <Link href="/app/projects/new" className="btn btn-secondary px-3 sm:px-4" aria-label="New project">
                <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="hidden sm:inline">New project</span>
              </Link>
            </div>
          </div>
        </header>
        <div id="main-content" tabIndex={-1} className="enter px-4 py-8 lg:px-8 max-w-[1600px] mx-auto outline-none">{children}</div>
      </main>
    </div>
  );
}
