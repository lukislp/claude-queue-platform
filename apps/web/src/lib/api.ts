export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Fehler ${res.status}`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? message;
    } catch {
      // Antwort war kein JSON - Standardmeldung verwenden.
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface User {
  userId: string;
  email: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  workingDirectory: string;
  createdAt: string;
  taskCount?: number;
}

export type TaskStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED_RATE_LIMIT'
  | 'PAUSED'
  | 'CANCELED'
  | 'COMPLETED'
  | 'FAILED';

export interface Task {
  id: string;
  projectId: string;
  userId: string;
  prompt: string;
  model: string | null;
  status: TaskStatus;
  assignedDeviceId: string | null;
  claudeSessionId: string | null;
  result: string | null;
  error: string | null;
  retryAt: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  logs?: { id: string; timestamp: string; message: string }[];
}

export interface ClaudeConnection {
  id: string;
  userId: string;
  type: 'API_KEY' | 'LOCAL_CLI';
  concurrencyLimit: number;
  isActive: boolean;
  hasApiKey: boolean;
  updatedAt: string;
}

export interface ModelOption {
  id: string;
  displayName: string;
}

export interface Device {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  lastSeenAt: string | null;
  createdAt: string;
}
