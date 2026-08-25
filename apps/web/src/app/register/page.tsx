'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Input, Label } from '@/components/ui';

export default function RegisterPage() {
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
      await api.post('/auth/register', { email, password });
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registrierung fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold">Konto erstellen</h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Eigenes Konto für diese Plattform - unabhängig von deinem Claude-Zugang.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>E-Mail</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Passwort (mind. 8 Zeichen)</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[var(--color-failed)]">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Erstelle Konto …' : 'Konto erstellen'}
          </Button>
        </form>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Schon registriert?{' '}
          <Link href="/login" className="text-[var(--color-brand)] hover:underline">
            Anmelden
          </Link>
        </p>
      </Card>
    </main>
  );
}
