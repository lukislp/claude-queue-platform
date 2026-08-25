'use client';

import { useEffect, useState, FormEvent, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { TaskTicket } from '@/components/task-ticket';
import { api, ModelOption, Project, Task, TaskStatus } from '@/lib/api';

// Aktive Tasks oben (Laufendes zuerst), beendete unten.
const STATUS_ORDER: Record<TaskStatus, number> = {
  RUNNING: 0,
  PAUSED_RATE_LIMIT: 1,
  QUEUED: 2,
  PAUSED: 3,
  FAILED: 4,
  CANCELED: 5,
  COMPLETED: 6,
};
const FINISHED: TaskStatus[] = ['COMPLETED', 'FAILED', 'CANCELED'];
import { getSocket } from '@/lib/socket';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  const loadTasks = useCallback(async () => {
    const list = await api.get<Task[]>(`/tasks?projectId=${id}`);
    setTasks(list);
  }, [id]);

  useEffect(() => {
    api.get<Project>(`/projects/${id}`).then(setProject);
    api
      .get<{ source: string; models: ModelOption[] }>('/connection/models')
      .then((res) => setModels(res.models))
      .catch(() => setModels([]));
    loadTasks();
  }, [id, loadTasks]);

  useEffect(() => {
    const socket = getSocket();

    function onTaskUpdate(task: Task) {
      if (task.projectId !== id) return;
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === task.id);
        return exists ? prev.map((t) => (t.id === task.id ? { ...t, ...task } : t)) : [...prev, task];
      });
    }
    function onRefresh() {
      loadTasks();
    }

    socket.on('task:update', onTaskUpdate);
    socket.on('task:refresh', onRefresh);
    return () => {
      socket.off('task:update', onTaskUpdate);
      socket.off('task:refresh', onRefresh);
    };
  }, [id, loadTasks]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/tasks', { projectId: id, prompt, model: model || undefined });
      setPrompt('');
      await loadTasks();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(taskId: string) {
    await api.delete(`/tasks/${taskId}`);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  async function handleTaskAction(taskId: string, action: 'cancel' | 'pause' | 'resume' | 'retry') {
    const updated = await api.post<Task>(`/tasks/${taskId}/${action}`);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
  }

  function startEditingProject() {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description ?? '');
    setEditing(true);
  }

  async function handleSaveProject(e: FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSavingProject(true);
    try {
      const updated = await api.patch<Project>(`/projects/${id}`, {
        name: editName,
        description: editDescription,
      });
      setProject((prev) => (prev ? { ...prev, ...updated } : updated));
      setEditing(false);
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    if (!window.confirm(`"${project.name}" wirklich löschen? Alle Tasks darin gehen dabei verloren.`)) return;
    await api.delete(`/projects/${id}`);
    router.push('/dashboard');
  }

  const ordered = [...tasks].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    // Aktive in Queue-Reihenfolge (älteste zuerst), beendete mit den neuesten oben.
    return FINISHED.includes(a.status)
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt);
  });

  return (
    <AppShell>
      <div className="mb-6">
        {editing ? (
          <form onSubmit={handleSaveProject} className="max-w-md space-y-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Projektname" />
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Beschreibung (optional)"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={savingProject || !editName.trim()}>
                {savingProject ? 'Speichere …' : 'Speichern'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Abbrechen
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{project?.name ?? '…'}</h1>
              {project?.description && (
                <p className="text-sm text-[var(--color-text-muted)]">{project.description}</p>
              )}
              {project && (
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
                  Arbeitsordner: {project.workingDirectory}
                </p>
              )}
            </div>
            {project && (
              <div className="flex shrink-0 gap-3 text-xs text-[var(--color-text-muted)]">
                <button onClick={startEditingProject} className="hover:text-[var(--color-text)]">
                  Bearbeiten
                </button>
                <button onClick={handleDeleteProject} className="hover:text-[var(--color-failed)]">
                  Löschen
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Card className="mb-8 p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            rows={3}
            placeholder="Was soll Claude tun? Wird der Queue hinzugefügt und automatisch abgearbeitet …"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              Modell
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-text)]"
              >
                <option value="">Standard (CLI-/Konto-Default)</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={submitting || !prompt.trim()}>
              {submitting ? 'Reihe ein …' : 'Zur Queue hinzufügen'}
            </Button>
          </div>
        </form>
      </Card>

      {ordered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--color-text-muted)]">
          Noch keine Tasks in der Queue.
        </Card>
      ) : (
        <div className="space-y-3">
          {ordered.map((t) => (
            <TaskTicket
              key={t.id}
              task={t}
              onDelete={handleDelete}
              onCancel={(id) => handleTaskAction(id, 'cancel')}
              onPause={(id) => handleTaskAction(id, 'pause')}
              onResume={(id) => handleTaskAction(id, 'resume')}
              onRetry={(id) => handleTaskAction(id, 'retry')}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
