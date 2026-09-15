import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// On Windows, npm installs the CLI as a .cmd/.ps1 shim that spawn() cannot start without a
// shell (and running the .cmd with shell:true makes quoting of the prompt unreliable).
// So we resolve the real executable once and cache it.
let cachedInvocation: { cmd: string; argPrefix: string[] } | undefined;

export function resolveClaudeInvocation(): { cmd: string; argPrefix: string[] } {
  if (cachedInvocation) return cachedInvocation;
  if (process.platform !== 'win32') {
    cachedInvocation = { cmd: 'claude', argPrefix: [] };
    return cachedInvocation;
  }

  const found = spawnSync('where.exe', ['claude'], { encoding: 'utf8' });
  const candidates = (found.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1) A plain .exe on PATH (native installation)
  const exe = candidates.find((c) => c.toLowerCase().endsWith('.exe'));
  if (exe) {
    cachedInvocation = { cmd: exe, argPrefix: [] };
    return cachedInvocation;
  }

  // 2) npm shim (.cmd): resolve it to the installation behind it
  const shim = candidates.find((c) => c.toLowerCase().endsWith('.cmd'));
  if (shim) {
    const pkgDir = path.join(path.dirname(shim), 'node_modules', '@anthropic-ai', 'claude-code');
    const nativeExe = path.join(pkgDir, 'bin', 'claude.exe');
    if (fs.existsSync(nativeExe)) {
      cachedInvocation = { cmd: nativeExe, argPrefix: [] };
      return cachedInvocation;
    }
    const cliJs = path.join(pkgDir, 'cli.js');
    if (fs.existsSync(cliJs)) {
      cachedInvocation = { cmd: process.execPath, argPrefix: [cliJs] };
      return cachedInvocation;
    }
  }

  // Fallback: try it unchanged (may end up on the previous error path)
  cachedInvocation = { cmd: 'claude', argPrefix: [] };
  return cachedInvocation;
}

export interface RunResult {
  status: 'completed' | 'failed' | 'rate_limited' | 'aborted';
  result?: string;
  error?: string;
  sessionId?: string;
  retryAt?: Date;
  abortReason?: 'cancel' | 'pause';
}

// Running Claude processes per task, so they can be terminated on the user's request.
interface ActiveRun {
  child: import('child_process').ChildProcess;
  abortReason?: 'cancel' | 'pause';
}
const activeRuns = new Map<string, ActiveRun>();

/** Terminates a task's running process. Returns false if none is running right now. */
export function abortRun(taskId: string, reason: 'cancel' | 'pause'): boolean {
  const run = activeRuns.get(taskId);
  if (!run) return false;
  run.abortReason = reason;
  run.child.kill();
  return true;
}

// Best-effort detection of usage/rate-limit messages in the Claude Code output.
// Claude Code reports a limit it has hit as text on stdout/stderr; the exact wording can
// differ slightly between installed versions - adjust here if needed.
// Important: only match against real error text, never against whole JSON events - token
// counters, UUIDs or signatures easily contain e.g. "429" as a digit sequence.
export const RATE_LIMIT_PATTERNS = [/usage limit/i, /rate limit/i, /try again later/i, /\b429\b/];
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 30 * 60 * 1000; // Default backoff: 30 minutes

/**
 * Tries to extract a reset time from the limit message.
 * Supports "resets at 14:32" as well as the CLI format "usage limit reached|<epoch>".
 */
export function tryExtractResetTime(text: string): Date | undefined {
  const epochMatch = text.match(/\|(\d{10,13})\b/);
  if (epochMatch) {
    const raw = Number(epochMatch[1]);
    const parsed = new Date(epochMatch[1].length >= 13 ? raw : raw * 1000);
    if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) return parsed;
  }
  const match = text.match(/resets?\s+(?:at|in)\s+([^\n.,]+)/i);
  if (!match) return undefined;
  const parsed = new Date(match[1]);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Extracts only the error-relevant texts from a stream-json event. */
export function errorTextsFromEvent(parsed: any): string[] {
  const texts: string[] = [];
  if (typeof parsed?.error === 'string') texts.push(parsed.error);
  if (typeof parsed?.error?.message === 'string') texts.push(parsed.error.message);
  if (parsed?.is_error === true && typeof parsed?.result === 'string') texts.push(parsed.result);
  return texts;
}

export function runClaudeTask(
  taskId: string,
  prompt: string,
  workingDirectory: string,
  resumeSessionId: string | undefined,
  model: string | undefined,
  onLog: (line: string) => void,
): Promise<RunResult> {
  return new Promise((resolve) => {
    // Claude Code requires --verbose when "-p" is combined with "--output-format stream-json".
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits'];
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    }
    if (model) {
      args.push('--model', model);
    }

    let child;
    try {
      const invocation = resolveClaudeInvocation();
      child = spawn(invocation.cmd, [...invocation.argPrefix, ...args], {
        cwd: workingDirectory,
        env: process.env,
        // Close stdin, otherwise the CLI waits for piped input
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      resolve({ status: 'failed', error: `Could not start 'claude': ${err.message}` });
      return;
    }

    const runEntry: ActiveRun = { child };
    activeRuns.set(taskId, runEntry);

    let sessionId: string | undefined = resumeSessionId;
    let resultText = '';
    let sawRateLimit = false;
    let rateLimitResetAt: Date | undefined;
    let stderrBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        onLog(line);
        try {
          const parsed = JSON.parse(line);
          if (parsed.session_id) sessionId = parsed.session_id;
          if (parsed.type === 'result' && typeof parsed.result === 'string') {
            resultText = parsed.result;
          }
          for (const errText of errorTextsFromEvent(parsed)) {
            if (RATE_LIMIT_PATTERNS.some((p) => p.test(errText))) {
              sawRateLimit = true;
              rateLimitResetAt = rateLimitResetAt ?? tryExtractResetTime(errText);
            }
          }
        } catch {
          if (RATE_LIMIT_PATTERNS.some((p) => p.test(line))) {
            sawRateLimit = true;
            rateLimitResetAt = rateLimitResetAt ?? tryExtractResetTime(line);
          }
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderrBuffer += text;
      onLog(`[stderr] ${text.trim()}`);
      if (RATE_LIMIT_PATTERNS.some((p) => p.test(text))) {
        sawRateLimit = true;
        rateLimitResetAt = rateLimitResetAt ?? tryExtractResetTime(text);
      }
    });

    child.on('close', (code) => {
      activeRuns.delete(taskId);
      if (runEntry.abortReason) {
        resolve({ status: 'aborted', abortReason: runEntry.abortReason, sessionId });
        return;
      }
      if (sawRateLimit) {
        resolve({
          status: 'rate_limited',
          sessionId,
          retryAt: rateLimitResetAt ?? new Date(Date.now() + DEFAULT_RATE_LIMIT_BACKOFF_MS),
        });
        return;
      }
      if (code === 0) {
        resolve({
          status: 'completed',
          result: resultText || '(No structured text result detected - see the full logs in the dashboard.)',
          sessionId,
        });
      } else {
        resolve({ status: 'failed', error: stderrBuffer || `claude exited with code ${code}`, sessionId });
      }
    });

    child.on('error', (err) => {
      activeRuns.delete(taskId);
      resolve({
        status: 'failed',
        error: `Could not run 'claude': ${err.message}. Is Claude Code installed and on PATH? (Have you run 'claude login'?)`,
      });
    });
  });
}
