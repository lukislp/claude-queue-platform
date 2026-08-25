'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, Card, Input, Label } from '@/components/ui';
import { api, Project } from '@/lib/api';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setProjects(await api.get<Project[]>('/projects'));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post('/projects', { name, description: description || undefined });
      setName('');
      setDescription('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projekte</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Jedes Projekt hat seine eigene Task-Queue.
          </p>
        </div>
      </div>

      <Card className="mb-8 p-4">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label>Projektname</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Blog-Automatisierung" />
          </div>
          <div className="flex-1">
            <Label>Beschreibung (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kurze Notiz" />
          </div>
          <Button type="submit" disabled={creating || !name.trim()}>
            {creating ? 'Erstelle …' : '+ Projekt anlegen'}
          </Button>
        </form>
      </Card>

      {projects === null ? (
        <p className="text-sm text-[var(--color-text-muted)]">Lädt …</p>
      ) : projects.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--color-text-muted)]">
          Noch keine Projekte. Leg oben dein erstes Projekt an, um Tasks in eine Queue zu schreiben.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full p-4 transition-colors hover:border-[var(--color-brand)]">
                <div className="flex items-start justify-between">
                  <h2 className="font-medium">{p.name}</h2>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-muted)]">
                    {p.taskCount ?? 0} Tasks
                  </span>
                </div>
                {p.description && (
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{p.description}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
