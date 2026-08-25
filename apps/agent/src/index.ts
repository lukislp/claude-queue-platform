#!/usr/bin/env node
import { io, Socket } from 'socket.io-client';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { loadConfig, saveConfig, AgentConfig, configPath } from './config';
import { runClaudeTask, resolveClaudeInvocation, abortRun } from './claude-runner';

// Ausstehende Rate-Limit-Retries pro Task, damit sie bei Abbruch/Pause storniert werden können.
const pendingRetries = new Map<string, NodeJS.Timeout>();

const args = process.argv.slice(2);
const command = args[0];

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function checkClaudeInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const invocation = resolveClaudeInvocation();
      const check = spawn(invocation.cmd, [...invocation.argPrefix, '--version']);
      check.on('error', () => resolve(false));
      check.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

async function pair() {
  const url = getArg('url');
  const code = getArg('code');
  const name = getArg('name') ?? os.hostname();
  if (!url || !code) {
    console.error(
      'Nutzung: claude-queue-agent pair --url <backend-url> --code <PAIRING-CODE> [--name "Mein Laptop"] [--baseDir <Pfad>]',
    );
    process.exit(1);
  }

  const res = await fetch(`${url.replace(/\/$/, '')}/devices/pair/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, deviceName: name }),
  });
  if (!res.ok) {
    console.error('Pairing fehlgeschlagen:', await res.text());
    process.exit(1);
  }
  const data = (await res.json()) as { deviceId: string; deviceToken: string };
  const config: AgentConfig = {
    backendUrl: url,
    deviceId: data.deviceId,
    deviceToken: data.deviceToken,
    baseDir: getArg('baseDir') ?? process.cwd(),
  };
  saveConfig(config);
  console.log(`Gerät "${name}" erfolgreich gekoppelt (gespeichert in ${configPath()}).`);
  console.log('Starte den Agenten mit: claude-queue-agent start');
}

interface TaskAssignPayload {
  taskId: string;
  prompt: string;
  workingDirectory: string;
  resumeSessionId?: string;
  model?: string;
}

async function handleTask(socket: Socket, config: AgentConfig, payload: TaskAssignPayload) {
  const cwd = path.isAbsolute(payload.workingDirectory)
    ? payload.workingDirectory
    : path.join(config.baseDir, payload.workingDirectory);

  if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });

  console.log(`[Task ${payload.taskId}] Starte Ausführung in ${cwd}${payload.resumeSessionId ? ' (Fortsetzung nach Pause)' : ''}`);
  socket.emit('agent:status', { taskId: payload.taskId, status: 'RUNNING' });

  const result = await runClaudeTask(payload.taskId, payload.prompt, cwd, payload.resumeSessionId, payload.model, (line) => {
    socket.emit('agent:log', { taskId: payload.taskId, message: line });
  });

  if (result.status === 'aborted') {
    if (result.abortReason === 'pause') {
      // Session-ID mitgeben, damit "Fortsetzen" die Claude-Session wieder aufnehmen kann.
      socket.emit('agent:status', {
        taskId: payload.taskId,
        status: 'PAUSED',
        claudeSessionId: result.sessionId,
      });
    }
    console.log(
      `[Task ${payload.taskId}] ${result.abortReason === 'pause' ? 'Pausiert' : 'Abgebrochen'} auf Nutzerwunsch.`,
    );
    return;
  }

  if (result.status === 'completed') {
    socket.emit('agent:status', {
      taskId: payload.taskId,
      status: 'COMPLETED',
      result: result.result,
      claudeSessionId: result.sessionId,
    });
    console.log(`[Task ${payload.taskId}] Abgeschlossen.`);
    return;
  }

  if (result.status === 'rate_limited') {
    const retryAt = result.retryAt!;
    socket.emit('agent:status', {
      taskId: payload.taskId,
      status: 'PAUSED_RATE_LIMIT',
      claudeSessionId: result.sessionId,
      retryAt: retryAt.toISOString(),
    });
    const delay = Math.max(retryAt.getTime() - Date.now(), 1000);
    console.log(
      `[Task ${payload.taskId}] Usage-/Rate-Limit erreicht. Automatischer Retry um ${retryAt.toLocaleString()} - kein Eingreifen nötig.`,
    );
    const timer = setTimeout(() => {
      pendingRetries.delete(payload.taskId);
      handleTask(socket, config, { ...payload, resumeSessionId: result.sessionId ?? payload.resumeSessionId });
    }, delay);
    pendingRetries.set(payload.taskId, timer);
    return;
  }

  socket.emit('agent:status', {
    taskId: payload.taskId,
    status: 'FAILED',
    error: result.error,
    claudeSessionId: result.sessionId,
  });
  console.log(`[Task ${payload.taskId}] Fehlgeschlagen: ${result.error}`);
}

async function start() {
  const config = loadConfig();
  if (!config) {
    console.error('Kein gekoppeltes Gerät gefunden. Zuerst ausführen: claude-queue-agent pair --url <backend-url> --code <CODE>');
    process.exit(1);
  }

  const claudeOk = await checkClaudeInstalled();
  if (!claudeOk) {
    console.warn(
      '⚠️  "claude" CLI wurde nicht gefunden. Bitte Claude Code installieren und "claude login" ausführen, ' +
        'bevor Tasks zugewiesen werden. Der Agent verbindet sich trotzdem, Tasks würden aber fehlschlagen.',
    );
  }

  console.log(`Verbinde mit ${config.backendUrl} ...`);
  const socket: Socket = io(config.backendUrl, {
    auth: { mode: 'agent', deviceToken: config.deviceToken },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => console.log('✅ Verbunden. Warte auf zugewiesene Tasks ...'));
  socket.on('disconnect', () => console.log('❌ Verbindung getrennt. Versuche automatisch erneut zu verbinden ...'));
  socket.on('connect_error', (err) => console.error('Verbindungsfehler:', err.message));

  socket.on('task:abort', ({ taskId, reason }: { taskId: string; reason: 'cancel' | 'pause' }) => {
    const killed = abortRun(taskId, reason);
    const timer = pendingRetries.get(taskId);
    if (timer) {
      clearTimeout(timer);
      pendingRetries.delete(taskId);
    }
    console.log(
      `[Task ${taskId}] ${reason === 'pause' ? 'Pause' : 'Abbruch'} angefordert` +
        (killed ? ' - laufender Prozess wird beendet.' : timer ? ' - geplanter Retry storniert.' : '.'),
    );
  });

  socket.on('task:assign', (payload: TaskAssignPayload) => {
    handleTask(socket, config, payload).catch((err) => {
      console.error(`[Task ${payload.taskId}] Unerwarteter Fehler:`, err);
      socket.emit('agent:status', { taskId: payload.taskId, status: 'FAILED', error: String(err) });
    });
  });
}

function configure() {
  const config = loadConfig();
  if (!config) {
    console.error('Kein gekoppeltes Gerät gefunden. Zuerst ausführen: claude-queue-agent pair --url <backend-url> --code <CODE>');
    process.exit(1);
  }
  const baseDir = getArg('baseDir');
  if (baseDir) {
    const resolved = path.resolve(baseDir);
    config.baseDir = resolved;
    saveConfig(config);
    console.log(`baseDir gesetzt auf: ${resolved}`);
    console.log('Hinweis: den laufenden Agenten neu starten, damit die Änderung wirkt.');
  } else {
    console.log(`Aktuelle Konfiguration (${configPath()}):`);
    console.log(`  backendUrl: ${config.backendUrl}`);
    console.log(`  baseDir:    ${config.baseDir}`);
    console.log('Ändern mit: claude-queue-agent config --baseDir <Pfad>');
  }
}

async function main() {
  if (command === 'pair') return pair();
  if (command === 'start') return start();
  if (command === 'config') return configure();
  console.log('Verfügbare Befehle:');
  console.log('  claude-queue-agent pair --url <backend-url> --code <PAIRING-CODE> [--name "Mein Laptop"]');
  console.log('  claude-queue-agent start');
  console.log('  claude-queue-agent config [--baseDir <Pfad>]   Standard-Arbeitsverzeichnis anzeigen/ändern');
}

main();
