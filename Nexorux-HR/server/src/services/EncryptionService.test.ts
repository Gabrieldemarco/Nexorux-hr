import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, isEncrypted, setEncryptionPassword } from '../services/EncryptionService';

describe('EncryptionService', () => {
  beforeEach(() => {
    setEncryptionPassword('test-password-123');
  });

  it('should encrypt and decrypt plaintext roundtrip', () => {
    const plaintext = 'super-secret-webhook-key-2026';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext', () => {
    const plaintext = 'same-secret';
    const first = encrypt(plaintext);
    const second = encrypt(plaintext);
    expect(first).not.toBe(second);
    expect(decrypt(first)).toBe(plaintext);
    expect(decrypt(second)).toBe(plaintext);
  });

  it('should detect encrypted values', () => {
    const plaintext = 'plain-secret';
    const ciphertext = encrypt(plaintext);
    expect(isEncrypted(plaintext)).toBe(false);
    expect(isEncrypted(ciphertext)).toBe(true);
  });

  it('should throw on invalid ciphertext', () => {
    expect(() => decrypt('not-valid-base64!!!')).toThrow();
    expect(() => decrypt('dGVzdA==')).toThrow();
  });
});
