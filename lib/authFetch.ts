// ============================================================
// Authenticated Fetch — Sends Firebase ID Token with every API call
// Usage: const res = await authFetch('/api/search', { method: 'POST', body: ... })
// ============================================================

import { auth } from '@/lib/firebase/config';

/**
 * Wrapper around fetch() that automatically injects the Firebase ID token.
 * Falls back to unauthenticated fetch if no user is logged in.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch (error) {
    console.warn('[authFetch] Failed to get ID token:', error);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
