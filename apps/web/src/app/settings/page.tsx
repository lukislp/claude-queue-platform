'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Card, Input, Label } from '@/components/ui';
import { api, ClaudeConnection, Device } from '@/lib/api';

export default function SettingsPage() {
  const [connection, setConnection] = useState<ClaudeConnection | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [concurrency, setConcurrency] = useState(2);
  const [mode, setMode] = useState<'API_KEY' | 'LOCAL_CLI'>('API_KEY');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [pairing, setPairing] = useState<{ code: string; expiresInSeconds: number } | null>(null);

  async function loadConnection() {
    const c = await api.get<ClaudeConnection>('/connection');
    setConnection(c);
    setMode(c.type);
    setConcurrency(c.concurrencyLimit);
  }

  async function loadDevices() {
    setDevices(await api.get<Device[]>('/devices'));
  }

  useEffect(() => {
    loadConnection();
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSavedMsg(null);
    try {
      await api.put('/connection', {
        type: mode,
        apiKey: apiKey || undefined,
        concurrencyLimit: concurrency,
      });
      setApiKey('');
      await loadConnection();
      setSavedMsg('Gespeichert.');
    } finally {
      setSaving(false);
    }
  }

  async function startPairing() {
    const res = await api.post<{ code: string; expiresInSeconds: number }>('/devices/pair/init');
    setPairing(res);
  }

  async function removeDevice(id: string) {
    await api.delete(`/devices/${id}`);
    await loadDevices();
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-xl font-semibold">Einstellungen</h1>

      <Card className="mb-6 p-5">
        <h2 className="mb-1 font-medium">Claude-Verbindung</h2>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          Entscheide, wie Tasks ausgeführt werden - mit deinem eigenen API-Key (serverseitig, rund
          um die Uhr) oder über einen lokalen Client mit deinem eigenen Claude-Abo (läuft nur,
          solange dein Gerät online ist).
        </p>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setMode('API_KEY')}
            className={`rounded-lg border p-4 text-left transition-colors ${
              mode === 'API_KEY'
                ? 'border-[var(--color-brand)] bg-[var(--color-surface-2)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            }`}
          >
            <p className="font-medium">API-Key</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Läuft serverseitig, unabhängig von deinem Gerät.
            </p>
            {connection?.hasApiKey && mode === 'API_KEY' && (
              <p className="mt-2 text-xs text-[var(--color-running)]">Key hinterlegt</p>
            )}
          </button>
          <button
            onClick={() => setMode('LOCAL_CLI')}
            className={`rounded-lg border p-4 text-left transition-colors ${
              mode === 'LOCAL_CLI'
                ? 'border-[var(--color-brand)] bg-[var(--color-surface-2)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            }`}
          >
            <p className="font-medium">Lokaler Client</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Nutzt dein Claude-Abo über den lokalen Agenten auf deinem Gerät.
            </p>
          </button>
        </div>

        {mode === 'API_KEY' && (
          <div className="mb-4">
            <Label>Anthropic API-Key</Label>
            <Input
              type="password"
              placeholder={connection?.hasApiKey ? '•••••••••••••• (hinterlegt, zum Ändern neu eingeben)' : 'sk-ant-…'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        )}

        <div className="mb-4">
          <Label>Parallele Tasks ({concurrency})</Label>
          <input
            type="range"
            min={1}
            max={4}
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="w-full accent-[var(--color-brand)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere …' : 'Speichern'}
          </Button>
          {savedMsg && <span className="text-sm text-[var(--color-running)]">{savedMsg}</span>}
        </div>
      </Card>

      {mode === 'LOCAL_CLI' && (
        <Card className="p-5">
          <h2 className="mb-1 font-medium">Geräte</h2>
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            Installiere den lokalen Agenten auf deinem Rechner und kopple ihn mit einem Code.
          </p>

          {pairing ? (
            <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <p className="text-xs text-[var(--color-text-muted)]">Pairing-Code (5 Minuten gültig)</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-2xl tracking-widest text-[var(--color-brand)]">
                {pairing.code}
              </p>
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">Auf deinem Rechner ausführen:</p>
              <code className="mt-1 block overflow-x-auto rounded bg-black/30 p-2 font-[family-name:var(--font-mono)] text-xs">
                npx claude-queue-agent pair --url {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'} --code {pairing.code}
              </code>
            </div>
          ) : (
            <Button variant="secondary" onClick={startPairing} className="mb-4">
              + Neues Gerät koppeln
            </Button>
          )}

          <div className="space-y-2">
            {devices?.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${d.status === 'ONLINE' ? 'status-dot-running' : ''}`}
                    style={{ backgroundColor: d.status === 'ONLINE' ? 'var(--color-running)' : 'var(--color-text-muted)' }}
                  />
                  <span className="text-sm">{d.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {d.status === 'ONLINE' ? 'Online' : 'Offline'}
                  </span>
                  <button
                    onClick={() => removeDevice(d.id)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-failed)]"
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            ))}
            {devices?.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">Noch keine Geräte gekoppelt.</p>
            )}
          </div>
        </Card>
      )}
    </AppShell>
  );
}
