'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--color-text-muted)]">Lädt …</p>
      </main>
    );
  }

  const navItem = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        pathname === href
          ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: 'var(--color-brand)' }}
              />
              Claude Queue
            </Link>
            <nav className="flex items-center gap-1">
              {navItem('/dashboard', 'Projekte')}
              {navItem('/settings', 'Einstellungen')}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span className="font-[family-name:var(--font-mono)]">{user.email}</span>
            <button onClick={() => logout().then(() => router.push('/login'))} className="hover:text-[var(--color-text)]">
              Abmelden
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
