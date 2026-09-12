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
        expect(randomToken(bytes)).not.toBe(token);
      }),
      { numRuns: 100 },
    );
  });
});
