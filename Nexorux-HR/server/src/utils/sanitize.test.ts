import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sanitizeString } from '../utils/sanitize';

describe('sanitizeString', () => {
  it('should return undefined for undefined input', () => {
    expect(sanitizeString(undefined)).toBeUndefined();
  });

  it('should return null for null input', () => {
    expect(sanitizeString(null)).toBeNull();
  });

  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should remove control characters', () => {
    expect(sanitizeString('hello\x00\x1F\x7Fworld')).toBe('helloworld');
  });

  it('should preserve valid strings unchanged', () => {
    expect(sanitizeString('valid-string')).toBe('valid-string');
  });
});
