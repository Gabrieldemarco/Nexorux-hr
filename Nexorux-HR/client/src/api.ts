import { AuthUser, UserRole } from './types';

const API_BASE = '/api/v1';

const TOKEN_KEY = 'nexorux_access_token';
const TENANT_ID_KEY = 'nexorux_tenant_id';
let currentTenantId: string = '';
let cachedCsrfHeader: string | null = null;

export function setRole(role: UserRole) {
  localStorage.setItem('nexorux_role', role);
}

export function getRole(): UserRole {
  return (localStorage.getItem('nexorux_role') as UserRole) || 'HR_ADMIN';
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getTenantId(): string {
  if (!currentTenantId) {
    currentTenantId = localStorage.getItem(TENANT_ID_KEY) || '';
  }
  return currentTenantId;
}

export function setTenantId(tenantId: string) {
  currentTenantId = tenantId;
  if (tenantId) {
    localStorage.setItem(TENANT_ID_KEY, tenantId);
  } else {
    localStorage.removeItem(TENANT_ID_KEY);
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('nexorux_role');
  localStorage.removeItem(TENANT_ID_KEY);
  currentTenantId = '';
  cachedCsrfHeader = null;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  if (cachedCsrfHeader && readCookie('XSRF-TOKEN')) {
    return cachedCsrfHeader;
  }

  const headers = new Headers();
  const tenantId = getTenantId();
  if (tenantId) headers.set('X-Tenant-ID', tenantId);

  const res = await fetch(`${API_BASE}/auth/csrf-token`, {
    method: 'GET',
    credentials: 'include',
    headers
  });

  if (!res.ok) return null;
  cachedCsrfHeader = res.headers.get('X-CSRF-Token');
  return cachedCsrfHeader;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, false);
  setAccessToken(response.token);
  setTenantId(response.user.tenant_id);
  localStorage.setItem('nexorux_role', response.user.role);
  cachedCsrfHeader = null;
  await ensureCsrfToken();
  return response.user;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}, includeAuth = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (includeAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const tenantId = getTenantId();
  if (tenantId) {
    headers.set('X-Tenant-ID', tenantId);
  }

  const method = (options.method || 'GET').toUpperCase();
  const stateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  if (stateChanging && endpoint !== '/auth/login' && endpoint !== '/auth/forgot-password' && endpoint !== '/auth/reset-password') {
    const csrf = await ensureCsrfToken();
    if (csrf) headers.set('x-xsrf-token', csrf);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!res.ok) {
    if (res.status === 403 && stateChanging) {
      cachedCsrfHeader = null;
      const retryCsrf = await ensureCsrfToken();
      if (retryCsrf) {
        headers.set('x-xsrf-token', retryCsrf);
        const retry = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include'
        });
        if (retry.ok) return retry.json();
        const retryError = await retry.json().catch(() => ({ error: 'Error de servidor' }));
        throw new Error(retryError.error || `HTTP ${retry.status}`);
      }
    }
    const errorData = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  return res.json();
}
