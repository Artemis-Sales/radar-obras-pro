// ============================================================
// Auth Middleware — Validates Firebase ID Token on API routes
// Usage: const user = await validateRequest(req);
//        if (!user) return unauthorizedResponse();
// ============================================================

import { adminAuth } from '@/lib/firebase/admin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

/**
 * Extracts and verifies the Firebase ID token from the Authorization header.
 * Returns the authenticated user or null if invalid/missing.
 */
export async function validateRequest(req: Request): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!idToken || idToken.trim().length === 0) {
      return null;
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('[Auth] Token verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Returns a standard 401 JSON response.
 */
export function unauthorizedResponse() {
  return Response.json(
    { success: false, error: 'Não autorizado. Faça login para continuar.' },
    { status: 401 }
  );
}
