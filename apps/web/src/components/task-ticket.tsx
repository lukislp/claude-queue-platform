'use client';

import { useEffect, useRef, useState } from 'react';
import { api, Task, TaskStatus } from '@/lib/api';
import { getSocket } from '@/lib/socket';

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; pulse?: boolean }> = {
  QUEUED: { label: 'Wartet', color: 'var(--color-queued)' },
  RUNNING: { label: 'Läuft', color: 'var(--color-running)', pulse: true },
  PAUSED_RATE_LIMIT: { label: 'Pausiert (Limit)', color: 'var(--color-paused)', pulse: true },
  PAUSED: { label: 'Pausiert', color: 'var(--color-paused)' },
  CANCELED: { label: 'Abgebrochen', color: 'var(--color-text-muted)' },
  COMPLETED: { label: 'Fertig', color: 'var(--color-completed)' },
  FAILED: { label: 'Fehlgeschlagen', color: 'var(--color-failed)' },
};

export function StatusDot({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.pulse ? 'status-dot-running' : ''}`}
      style={{ backgroundColor: cfg.color, color: cfg.color }}
    />
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${cfg.color} 16%, transparent)`, color: cfg.color }}
    >
      <StatusDot status={status} />
      {cfg.label}
    </span>
  );
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
}

/** Übersetzt eine rohe stream-json-Logzeile in eine lesbare Darstellung (null = ausblenden). */
function describeLogLine(message: string): string | null {
  if (message.startsWith('[stderr]')) return message;
  try {
    const p = JSON.parse(message);
    if (p.type === 'system' && p.subtype === 'init') {
      return `▶ Session gestartet · Modell: ${p.model ?? 'Standard'} · Ordner: ${p.cwd ?? '?'}`;
    }
    if (p.type === 'assistant' && Array.isArray(p.message?.content)) {
      const parts: string[] = [];
      for (const block of p.message.content) {
        if (block.type === 'text' && block.text?.trim()) parts.push(block.text.trim());
        if (block.type === 'tool_use') {
          const target = block.input?.file_path ?? block.input?.command ?? '';
          parts.push(`🔧 ${block.name}${target ? `: ${String(target).slice(0, 120)}` : ''}`);
        }
      }
      return parts.length ? parts.join('\n') : null;
    }
    if (p.type === 'result') {
      const u = p.usage;
      const tokens = u ? ` · Tokens: ${u.input_tokens ?? 0} rein / ${u.output_tokens ?? 0} raus` : '';
      const cost = typeof p.total_cost_usd === 'number' ? ` · Kosten: $${p.total_cost_usd.toFixed(4)}` : '';
      const dur = typeof p.duration_ms === 'number' ? ` · Dauer: ${Math.round(p.duration_ms / 1000)}s` : '';
      return `${p.is_error ? '✖ Fehler' : '✔ Abgeschlossen'}${tokens}${cost}${dur}`;
    }
    return null; // sonstige Events (Tool-Ergebnisse, Deltas) ausblenden
  } catch {
    return message;
  }
}

/** Modal mit Live-Logs eines Tasks: lädt die Historie und streamt neue Zeilen per WebSocket. */
function TaskLogsModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api.get<Task>(`/tasks/${task.id}`).then((full) => {
      if (!active) return;
      setLines((full.logs ?? []).map((l) => l.message));
      setLoaded(true);
    });
    const socket = getSocket();
    function onLog(body: { taskId: string; message: string }) {
      if (body.taskId !== task.id) return;
      setLines((prev) => [...prev, body.message]);
    }
    socket.on('task:log', onLog);
    return () => {
      active = false;
      socket.off('task:log', onLog);
    };
  }, [task.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const rendered = lines.map(describeLogLine).filter((l): l is string => !!l);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-muted)]">
              #{task.id.slice(0, 6)}
            </span>
          </div>
          <button onClick={onClose} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            Schließen ✕
          </button>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-[var(--color-text)]"
        >
          {!loaded ? (
            'Lade Logs …'
          ) : rendered.length === 0 ? (
            'Noch keine Logs vorhanden.'
          ) : (
            rendered.map((l, i) => (
              <div key={i} className="mb-2 border-b border-dashed border-[var(--color-border)] pb-2 last:border-b-0">
                {l}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface TaskTicketProps {
  task: Task;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

/** Eine Task-Zeile im "Ticket/Manifest"-Look: Stub mit kurzer ID links, Inhalt rechts. */
export function TaskTicket({ task, onDelete, onCancel, onPause, onResume }: TaskTicketProps) {
  const [showLogs, setShowLogs] = useState(false);
  const cfg = STATUS_CONFIG[task.status];
  return (
    <div
      className="flex overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ borderLeftColor: cfg.color, borderLeftWidth: '3px' }}
    >
      <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] py-3 font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
        <StatusDot status={task.status} />
        <span>#{task.id.slice(0, 6)}</span>
      </div>
      <div className="flex-1 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-snug text-[var(--color-text)]">{task.prompt}</p>
          <StatusBadge status={task.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
          {task.model && <span>Modell {task.model}</span>}
          <span>erstellt {formatTime(task.createdAt)}</span>
          {task.startedAt && <span>gestartet {formatTime(task.startedAt)}</span>}
          {task.completedAt && <span>beendet {formatTime(task.completedAt)}</span>}
          {task.retryAt && task.status === 'PAUSED_RATE_LIMIT' && (
            <span style={{ color: 'var(--color-paused)' }}>Retry {formatTime(task.retryAt)}</span>
          )}
        </div>
        {task.error && (
          <p className="mt-2 rounded-md bg-[var(--color-failed)]/10 px-2 py-1.5 text-xs text-[var(--color-failed)]">
            {task.error}
          </p>
        )}
        {task.result && (
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-[var(--color-surface-2)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-xs text-[var(--color-text)]">
            {task.result}
          </p>
        )}
        {(() => {
          const isActive = ['QUEUED', 'RUNNING', 'PAUSED_RATE_LIMIT'].includes(task.status);
          return (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              <button
                onClick={() => setShowLogs(true)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                📜 Logs
              </button>
              {isActive && onPause && (
                <button
                  onClick={() => onPause(task.id)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-paused)]"
                >
                  ⏸ Pausieren
                </button>
              )}
              {task.status === 'PAUSED' && onResume && (
                <button
                  onClick={() => onResume(task.id)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-running)]"
                >
                  ▶ Fortsetzen
                </button>
              )}
              {(isActive || task.status === 'PAUSED') && onCancel && (
                <button
                  onClick={() => onCancel(task.id)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-failed)]"
                >
                  ✖ Abbrechen
                </button>
              )}
              {!isActive && task.status !== 'PAUSED' && onDelete && (
                <button
                  onClick={() => onDelete(task.id)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-failed)]"
                >
                  Entfernen
                </button>
              )}
            </div>
          );
        })()}
      </div>
      {showLogs && <TaskLogsModal task={task} onClose={() => setShowLogs(false)} />}
    </div>
  );
}
