export function sanitizeString(value: string | undefined | null): string | undefined | null {
  if (value === undefined || value === null) return value;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return value;
  return trimmed.replace(/[\x00-\x1F\x7F]/g, '');
}

export function sanitizeErrorMessage(err: any): string {
  if (process.env.NODE_ENV === 'production') {
    if (err?.code === 'SQLITE_CONSTRAINT' || err?.code === 'SQLITE_FOREIGN_MISS_MATCH' || err?.code?.startsWith('SQLITE')) {
      return 'Error de base de datos. Contacte al administrador.';
    }
    return 'Error interno del servidor';
  }
  return err?.message || 'Error interno del servidor';
}
