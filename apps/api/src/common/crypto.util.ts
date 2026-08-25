import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const secret = process.env.CLAUDE_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'CLAUDE_KEY_ENCRYPTION_SECRET muss gesetzt sein und mindestens 32 Zeichen lang sein.',
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/** Verschlüsselt einen Klartext-String, Rückgabe als "iv:authTag:ciphertext" (hex). */
export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Entschlüsselt einen mit encryptSecret erzeugten String. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Erzeugt ein zufälliges, URL-sicheres Token (z.B. für Device-Pairing). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
