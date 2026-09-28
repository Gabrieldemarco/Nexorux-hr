import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const keyLength = 32;
const ivLength = 12;
const tagLength = 16;
const saltLength = 16;

let encryptionPassword: string | undefined = process.env.WEBHOOK_ENCRYPTION_KEY || process.env.JWT_SECRET;
if (!encryptionPassword) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('WEBHOOK_ENCRYPTION_KEY or JWT_SECRET must be set in production');
  }
  encryptionPassword = crypto.randomBytes(32).toString('hex');
  console.warn('EncryptionService: no encryption key env var found; using ephemeral random key (data will not survive restart).');
}

export function setEncryptionPassword(password: string | undefined) {
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Encryption key must be provided in production');
    }
    encryptionPassword = crypto.randomBytes(32).toString('hex');
    console.warn('EncryptionService: no encryption key env var found; using ephemeral random key (data will not survive restart).');
  } else {
    encryptionPassword = password;
  }
}

function getKey(salt: Buffer): Buffer {
  if (!encryptionPassword) throw new Error('Encryption key not initialized');
  return crypto.pbkdf2Sync(encryptionPassword, salt, 100000, keyLength, 'sha256');
}

export function encrypt(plaintext: string): string {
  const salt = crypto.randomBytes(saltLength);
  const key = getKey(salt);
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  cipher.setAAD(salt);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  const buffer = Buffer.from(ciphertext, 'base64');
  if (buffer.length < saltLength + ivLength + tagLength) {
    throw new Error('Datos cifrados inválidos');
  }
  const salt = buffer.subarray(0, saltLength);
  const iv = buffer.subarray(saltLength, saltLength + ivLength);
  const tag = buffer.subarray(saltLength + ivLength, saltLength + ivLength + tagLength);
  const encrypted = buffer.subarray(saltLength + ivLength + tagLength);
  const key = getKey(salt);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAAD(salt);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

export function isEncrypted(value: string): boolean {
  try {
    const buffer = Buffer.from(value, 'base64');
    return buffer.length >= saltLength + ivLength + tagLength;
  } catch {
    return false;
  }
}
