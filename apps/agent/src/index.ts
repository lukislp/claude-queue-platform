#!/usr/bin/env node
import { io, Socket } from 'socket.io-client';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { loadConfig, saveConfig, AgentConfig, configPath } from './config';
import { runClaudeTask, resolveClaudeInvocation, abortRun } from './claude-runner';
import { listOutputFiles } from './list-output-files';

// Pending rate-limit retries per task, so they can be cancelled on cancel/pause.
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
      'Usage: claude-queue-agent pair --url <backend-url> --code <PAIRING-CODE> [--name "My laptop"] [--baseDir <path>]',
    );
    process.exit(1);
  }

  const res = await fetch(`${url.replace(/\/$/, '')}/devices/pair/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, deviceName: name }),
  });
  if (!res.ok) {
    console.error('Pairing failed:', await res.text());
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
  console.log(`Device "${name}" paired successfully (stored in ${configPath()}).`);
  console.log('Start the agent with: claude-queue-agent start');
}

interface TaskAssignPayload {
  taskId: string;
  prompt: string;
  workingDirectory: string;
  resumeSessionId?: string;
  model?: string;
}

function safeListOutputFiles(cwd: string) {
  try {
    return listOutputFiles(cwd);
  } catch {
    return undefined;
  }
}

async function handleTask(socket: Socket, config: AgentConfig, payload: TaskAssignPayload) {
  const cwd = path.isAbsolute(payload.workingDirectory)
    ? payload.workingDirectory
    : path.join(config.baseDir, payload.workingDirectory);

  if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });

  console.log(`[Task ${payload.taskId}] Starting execution in ${cwd}${payload.resumeSessionId ? ' (resuming after a pause)' : ''}`);
  socket.emit('agent:status', { taskId: payload.taskId, status: 'RUNNING' });

  const result = await runClaudeTask(payload.taskId, payload.prompt, cwd, payload.resumeSessionId, payload.model, (line) => {
    socket.emit('agent:log', { taskId: payload.taskId, message: line });
  });

  if (result.status === 'aborted') {
    if (result.abortReason === 'pause') {
      // Pass the session ID along so "resume" can pick the Claude session back up.
      socket.emit('agent:status', {
        taskId: payload.taskId,
        status: 'PAUSED',
        claudeSessionId: result.sessionId,
      });
    }
    console.log(
      `[Task ${payload.taskId}] ${result.abortReason === 'pause' ? 'Paused' : 'Cancelled'} on the user's request.`,
    );
    return;
  }

  if (result.status === 'completed') {
    socket.emit('agent:status', {
      taskId: payload.taskId,
      status: 'COMPLETED',
      result: result.result,
      claudeSessionId: result.sessionId,
      files: safeListOutputFiles(cwd),
    });
    console.log(`[Task ${payload.taskId}] Completed.`);
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
      `[Task ${payload.taskId}] Usage/rate limit hit. Automatic retry at ${retryAt.toLocaleString()} - no action needed.`,
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
    files: safeListOutputFiles(cwd),
  });
  console.log(`[Task ${payload.taskId}] Failed: ${result.error}`);
}

async function start() {
  const config = loadConfig();
  if (!config) {
    console.error('No paired device found. Run this first: claude-queue-agent pair --url <backend-url> --code <CODE>');
    process.exit(1);
  }

  const claudeOk = await checkClaudeInstalled();
  if (!claudeOk) {
    console.warn(
      '⚠️  The "claude" CLI was not found. Install Claude Code and run "claude login" before ' +
        'tasks are assigned. The agent still connects, but tasks would fail.',
    );
  }

  console.log(`Connecting to ${config.backendUrl} ...`);
  const socket: Socket = io(config.backendUrl, {
    auth: { mode: 'agent', deviceToken: config.deviceToken },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => console.log('✅ Connected. Waiting for assigned tasks ...'));
  socket.on('disconnect', () => console.log('❌ Disconnected. Reconnecting automatically ...'));
  socket.on('connect_error', (err) => console.error('Connection error:', err.message));

  socket.on('task:abort', ({ taskId, reason }: { taskId: string; reason: 'cancel' | 'pause' }) => {
    const killed = abortRun(taskId, reason);
    const timer = pendingRetries.get(taskId);
    if (timer) {
      clearTimeout(timer);
      pendingRetries.delete(taskId);
    }
    console.log(
      `[Task ${taskId}] ${reason === 'pause' ? 'Pause' : 'Cancel'} requested` +
        (killed ? ' - terminating the running process.' : timer ? ' - scheduled retry cancelled.' : '.'),
    );
  });

  socket.on('task:assign', (payload: TaskAssignPayload) => {
    handleTask(socket, config, payload).catch((err) => {
      console.error(`[Task ${payload.taskId}] Unexpected error:`, err);
      socket.emit('agent:status', { taskId: payload.taskId, status: 'FAILED', error: String(err) });
    });
  });
}

function configure() {
  const config = loadConfig();
  if (!config) {
    console.error('No paired device found. Run this first: claude-queue-agent pair --url <backend-url> --code <CODE>');
    process.exit(1);
  }
  const baseDir = getArg('baseDir');
  if (baseDir) {
    const resolved = path.resolve(baseDir);
    config.baseDir = resolved;
    saveConfig(config);
    console.log(`baseDir set to: ${resolved}`);
    console.log('Note: restart the running agent for the change to take effect.');
  } else {
    console.log(`Current configuration (${configPath()}):`);
    console.log(`  backendUrl: ${config.backendUrl}`);
    console.log(`  baseDir:    ${config.baseDir}`);
    console.log('Change it with: claude-queue-agent config --baseDir <path>');
  }
}

async function main() {
  if (command === 'pair') return pair();
  if (command === 'start') return start();
  if (command === 'config') return configure();
  console.log('Available commands:');
  console.log('  claude-queue-agent pair --url <backend-url> --code <PAIRING-CODE> [--name "My laptop"]');
  console.log('  claude-queue-agent start');
  console.log('  claude-queue-agent config [--baseDir <path>]   Show/change the default working directory');
}

main();
