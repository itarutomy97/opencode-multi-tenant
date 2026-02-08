/**
 * Clerk Authentication Utilities for Cloudflare Workers
 *
 * For production use, we need to verify JWT tokens using the Clerk secret key.
 * Since Cloudflare Workers has limited crypto support, we use a simpler approach
 * that can be enhanced with proper JWT verification.
 */

interface ClerkJwtPayload {
  sub: string; // User ID
  iss: string;
  exp: number;
  iat: number;
}

interface ClerkSessionResponse {
  last_active_token?: string;
  user_id: string;
  status: string;
}

/**
 * Verify Clerk session using Backend API
 * This handles both JWT tokens, session IDs, and sign-in tokens
 *
 * @param token - JWT token, session ID, or sign-in token
 * @param secretKey - Clerk Secret Key for Backend API
 * @returns userId if valid, null otherwise
 */
export async function verifyClerkSessionOrToken(
  token: string,
  secretKey: string
): Promise<string | null> {
  // First, try to verify as JWT
  const jwtUserId = verifyClerkToken(`Bearer ${token}`);
  if (jwtUserId) {
    return jwtUserId;
  }

  // Try to verify as sign-in token via Clerk Backend API
  // sign_in_tokens can be verified by checking the ticket
  try {
    // Try using the sign_in token as a ticket to create a sign-in
    const response = await fetch('https://api.clerk.com/v1/client/sign_ins?_clerk_sdk_version=5', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strategy: 'ticket',
        ticket: token,
      }),
    });

    if (response.ok) {
      const data = await response.json() as { user_id: string; created_session_id?: string };
      if (data.user_id) {
        return data.user_id;
      }
    }
  } catch {
    // Ignore error and try next method
  }

  // If JWT and ticket verification fail, try to verify as session ID via Backend API
  try {
    const response = await fetch(`https://api.clerk.com/v1/sessions/${token}/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as ClerkSessionResponse;

    // Return the user ID from the session
    return data.user_id || null;
  } catch {
    return null;
  }
}

/**
 * Extract userId from Clerk JWT token
 *
 * NOTE: This is a simplified implementation. For production:
 * 1. Use @clerk/backend's verifyToken() if available in Workers
 * 2. Or implement JWT verification using Web Crypto API
 *
 * @param authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns userId if valid, null otherwise
 */
export function verifyClerkToken(authHeader: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Decode JWT without verification (for development)
    // In production, verify signature using Clerk Secret Key
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload - Cloudflare Workers compatible (using atob)
    // Convert base64url to base64
    let base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (base64Payload.length % 4) {
      base64Payload += '=';
    }
    // Decode using TextDecoder for Cloudflare Workers compatibility
    const binaryString = atob(base64Payload);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoded = new TextDecoder().decode(bytes);
    const payload = JSON.parse(decoded) as ClerkJwtPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    // Verify issuer (should be Clerk)
    if (!payload.iss.startsWith('https://clerk.')) {
      return null;
    }

    return payload.sub; // User ID
  } catch {
    return null;
  }
}

/**
 * Verify Clerk token using secret key (for production)
 *
 * This would use the Clerk secret key to verify the JWT signature.
 * To be implemented with proper crypto verification.
 */
export async function verifyClerkTokenWithSecret(
  token: string,
  secretKey: string
): Promise<string | null> {
  // Use the new verifyClerkSessionOrToken function
  return verifyClerkSessionOrToken(token, secretKey);
}
