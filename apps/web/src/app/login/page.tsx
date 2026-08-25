'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Input, Label } from '@/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/login', { email, password });
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold">Anmelden</h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Zugang zu deiner Task-Queue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>E-Mail</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Passwort</Label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[var(--color-failed)]">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Melde an …' : 'Anmelden'}
          </Button>
        </form>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Noch kein Konto?{' '}
          <Link href="/register" className="text-[var(--color-brand)] hover:underline">
            Registrieren
          </Link>
        </p>
      </Card>
    </main>
  );
}
