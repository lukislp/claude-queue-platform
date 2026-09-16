import * as fc from 'fast-check';
import { decryptSecret, encryptSecret, hashToken, randomToken } from './crypto.util';

/**
 * Property-based tests (fast-check) for the secret encryption helpers: instead of one
 * example each, every invariant runs against hundreds of generated inputs - empty strings,
 * unicode, very long secrets, arbitrary byte counts.
 */
describe('crypto.util properties', () => {
  const originalSecret = process.env.CLAUDE_KEY_ENCRYPTION_SECRET;

  beforeAll(() => {
    process.env.CLAUDE_KEY_ENCRYPTION_SECRET = 'property-test-secret-with-at-least-32-characters';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.CLAUDE_KEY_ENCRYPTION_SECRET;
    else process.env.CLAUDE_KEY_ENCRYPTION_SECRET = originalSecret;
  });

  it('decrypts every encrypted string back to the original', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (plainText) => {
        expect(decryptSecret(encryptSecret(plainText))).toBe(plainText);
      }),
      { numRuns: 300 },
    );
  });

  it('produces the documented iv:authTag:ciphertext hex layout with a fresh iv every time', () => {
    fc.assert(
      fc.property(fc.string(), (plainText) => {
        const first = encryptSecret(plainText).split(':');
        const second = encryptSecret(plainText).split(':');
        expect(first).toHaveLength(3);
        expect(first[0]).toMatch(/^[0-9a-f]{24}$/); // 12-byte iv
        expect(first[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte GCM auth tag
        expect(first[2]).toMatch(/^[0-9a-f]*$/);
        expect(first[2]).toHaveLength(Buffer.byteLength(plainText, 'utf8') * 2);
        expect(first[0]).not.toBe(second[0]);
      }),
      { numRuns: 300 },
    );
  });

  it('rejects a tampered payload instead of returning garbage', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.nat(), (plainText, position) => {
        const payload = encryptSecret(plainText);
        const [iv, authTag, data] = payload.split(':');
        const index = position % data.length;
        const flipped = data[index] === '0' ? '1' : '0';
        const tampered = `${iv}:${authTag}:${data.slice(0, index)}${flipped}${data.slice(index + 1)}`;
        expect(() => decryptSecret(tampered)).toThrow();
      }),
      { numRuns: 200 },
    );
  });

  it('hashes tokens deterministically to 64 hex characters and never collides on different tokens', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashToken(a)).toBe(hashToken(a));
        if (a !== b) expect(hashToken(a)).not.toBe(hashToken(b));
      }),
      { numRuns: 300 },
    );
  });

  it('generates url-safe tokens of the expected length for any byte count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 256 }), (bytes) => {
        const token = randomToken(bytes);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(Buffer.from(token, 'base64url')).toHaveLength(bytes);
      }),
      { numRuns: 100 },
    );
  });

  // Uniqueness is its own property, and it only holds for tokens long enough to make a collision
  // implausible - hence min 16 here, where the length property above starts at 1. At a single
  // byte there are 256 possible tokens, so each comparison has a 1-in-256 chance of matching.
  // Spread over 100 runs, and with fast-check biasing towards the generator's edge values, that
  // is a ~4% chance of a red build per run (measured); at uniform sampling it is ~0.1%. Rare
  // enough to look like an unrelated glitch, frequent enough to keep coming back - it fired on
  // 2026-09-16 with seed -338126100, counterexample [1], both tokens "IA". At 16 bytes the same
  // comparison is 2^-128, which is never.
  it('does not repeat itself at sizes actually used for credentials', () => {
    fc.assert(
      fc.property(fc.integer({ min: 16, max: 256 }), (bytes) => {
        expect(randomToken(bytes)).not.toBe(randomToken(bytes));
      }),
      { numRuns: 100 },
    );
  });
});
