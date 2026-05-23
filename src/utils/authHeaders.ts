import type { HostUser } from '../data';

const HOST_KEY = 'lootly_host';
const TOKEN_KEY = 'lootly_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function hasAuthSession(): boolean {
  return Boolean(getAuthToken() && localStorage.getItem(HOST_KEY));
}

export function storeAuthSession(host: HostUser, token: string): void {
  localStorage.setItem(HOST_KEY, JSON.stringify(host));
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthSession(): void {
  localStorage.removeItem(HOST_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

/** Returns host only when a JWT is present; clears stale host-only sessions. */
export function loadStoredHost(): HostUser | null {
  const token = getAuthToken();
  const saved = localStorage.getItem(HOST_KEY);

  if (!saved) {
    if (token) localStorage.removeItem(TOKEN_KEY);
    return null;
  }

  if (!token) {
    clearAuthSession();
    return null;
  }

  try {
    return JSON.parse(saved) as HostUser;
  } catch {
    clearAuthSession();
    return null;
  }
}

function pickToken(record: Record<string, unknown>): string | null {
  if (typeof record.token === 'string' && record.token.length > 0) return record.token;
  if (typeof record.accessToken === 'string' && record.accessToken.length > 0) {
    return record.accessToken;
  }
  return null;
}

function pickHost(record: Record<string, unknown>): HostUser | null {
  const nested = record.host ?? record.user ?? record.data;
  if (nested && typeof nested === 'object') {
    const host = nested as HostUser;
    if (host.id) return host;
  }
  if (typeof record.id === 'string' && record.id.length > 0) {
    const { token: _t, accessToken: _a, error: _e, ...hostFields } = record;
    return hostFields as unknown as HostUser;
  }
  return null;
}

export function parseAuthResponse(
  data: unknown
): { host: HostUser; token: string } | { error: string } | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  if (typeof record.error === 'string') {
    return { error: record.error };
  }

  const token = pickToken(record);
  const host = pickHost(record);

  if (!host?.id) return null;

  if (!token) {
    return {
      error:
        'Server did not return an auth token. Restart the dev server (npm run dev) and try again.',
    };
  }

  return { host, token };
}

/** fetch() with Authorization header; use for all JWT-protected API routes. */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (
    init.body &&
    !headers.has('Content-Type') &&
    typeof init.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}
