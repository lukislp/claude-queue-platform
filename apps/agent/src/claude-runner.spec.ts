import {
  RATE_LIMIT_PATTERNS,
  abortRun,
  errorTextsFromEvent,
  resolveClaudeInvocation,
  tryExtractResetTime,
} from './claude-runner';

describe('RATE_LIMIT_PATTERNS', () => {
  const matches = (text: string) => RATE_LIMIT_PATTERNS.some((p) => p.test(text));

  it('matches known Claude Code limit phrasings', () => {
    expect(matches('You have reached your usage limit for this plan.')).toBe(true);
    expect(matches('Error: rate limit exceeded, please try again later.')).toBe(true);
    expect(matches('please try again later')).toBe(true);
  });

  it('matches an isolated 429 status code but not an arbitrary number containing 429', () => {
    expect(matches('request failed with status 429')).toBe(true);
    expect(matches('cache_creation_input_tokens":10429')).toBe(false);
  });

  it('does not match unrelated text', () => {
    expect(matches('Fertig! Die Webseite liegt unter index.html')).toBe(false);
  });
});

describe('errorTextsFromEvent', () => {
  it('extracts a plain string error field', () => {
    expect(errorTextsFromEvent({ error: 'usage limit reached' })).toEqual(['usage limit reached']);
  });

  it('extracts a nested error.message field', () => {
    expect(errorTextsFromEvent({ error: { message: 'rate limit hit' } })).toEqual(['rate limit hit']);
  });

  it('extracts the result text only when is_error is true', () => {
    expect(errorTextsFromEvent({ is_error: true, result: 'usage limit reached|1735689600' })).toEqual([
      'usage limit reached|1735689600',
    ]);
    expect(errorTextsFromEvent({ is_error: false, result: 'usage limit reached' })).toEqual([]);
  });

  it('never treats token/usage statistics as error text (the original false-positive bug)', () => {
    expect(
      errorTextsFromEvent({
        type: 'result',
        usage: { input_tokens: 4, cache_creation_input_tokens: 10429 },
        total_cost_usd: 0.33,
      }),
    ).toEqual([]);
  });

  it('returns an empty array for events without any error field', () => {
    expect(errorTextsFromEvent({ type: 'system', subtype: 'init' })).toEqual([]);
  });
});

describe('tryExtractResetTime', () => {
  it('parses the CLI epoch-seconds format "usage limit reached|<epoch>"', () => {
    const futureEpochSeconds = Math.floor(Date.now() / 1000) + 3600;
    const result = tryExtractResetTime(`usage limit reached|${futureEpochSeconds}`);
    expect(result?.getTime()).toBe(futureEpochSeconds * 1000);
  });

  it('parses epoch milliseconds when the number already has millisecond precision', () => {
    const futureEpochMs = Date.now() + 3600_000;
    const result = tryExtractResetTime(`usage limit reached|${futureEpochMs}`);
    expect(result?.getTime()).toBe(futureEpochMs);
  });

  it('ignores an epoch that is not in the future', () => {
    const pastEpochSeconds = Math.floor(Date.now() / 1000) - 3600;
    expect(tryExtractResetTime(`usage limit reached|${pastEpochSeconds}`)).toBeUndefined();
  });

  it('falls back to parsing "resets at <time>" phrasing', () => {
    // The regex stops at "." (so it doesn't swallow the rest of a sentence), so the
    // captured text must not contain one - matches realistic phrasing like "resets at 14:32".
    const result = tryExtractResetTime('Your limit resets at 2030-01-01T00:00:00Z');
    expect(result?.toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  it('returns undefined when no reset time is present', () => {
    expect(tryExtractResetTime('rate limit exceeded')).toBeUndefined();
  });
});

describe('resolveClaudeInvocation', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('invokes "claude" directly on non-Windows platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    jest.isolateModules(() => {
      const { resolveClaudeInvocation: resolveOnLinux } = require('./claude-runner');
      expect(resolveOnLinux()).toEqual({ cmd: 'claude', argPrefix: [] });
    });
  });
});

describe('abortRun', () => {
  it('returns false when no process is running for the given task', () => {
    expect(abortRun('no-such-task', 'cancel')).toBe(false);
  });
});
