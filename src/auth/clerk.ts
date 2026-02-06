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

    // Decode payload
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    ) as ClerkJwtPayload;

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
  // TODO: Implement proper JWT verification
  // This would use Web Crypto API to verify the signature
  return verifyClerkToken(`Bearer ${token}`);
}
