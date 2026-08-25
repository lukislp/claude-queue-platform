'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--color-text-muted)]">
        Lädt …
      </p>
    </main>
  );
}
