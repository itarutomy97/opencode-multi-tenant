/**
 * Clerk Authentication Tests
 */
import { describe, it, expect } from 'vitest';
import { verifyClerkToken } from './clerk.js';

// Mock Clerk JWT token (base64url encoded)
// Header: {"alg":"RS256","typ":"JWT"}
// Payload: {"sub":"user_123","iss":"https://clerk.example.com","exp":9999999999,"iat":1234567890}
function createMockToken(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      iss: 'https://clerk.example.com',
      exp: 9999999999,
      iat: 1234567890,
    })
  ).toString('base64url');
  const signature = 'signature'; // Mock signature
  return `${header}.${payload}.${signature}`;
}

function createExpiredToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_123',
      iss: 'https://clerk.example.com',
      exp: 1000000000, // Expired
      iat: 1234567890,
    })
  ).toString('base64url');
  const signature = 'signature';
  return `${header}.${payload}.${signature}`;
}

describe('Clerk Authentication', () => {
  describe('verifyClerkToken', () => {
    it('extracts userId from valid Clerk JWT token', () => {
      const token = createMockToken('user_123');
      const result = verifyClerkToken(`Bearer ${token}`);
      expect(result).toBe('user_123');
    });

    it('returns null when Authorization header is missing', () => {
      const result = verifyClerkToken('');
      expect(result).toBeNull();
    });

    it('returns null when Authorization header is malformed', () => {
      const result = verifyClerkToken('InvalidFormat token123');
      expect(result).toBeNull();
    });

    it('returns null for expired tokens', () => {
      const token = createExpiredToken();
      const result = verifyClerkToken(`Bearer ${token}`);
      expect(result).toBeNull();
    });

    it('returns null for invalid JWT format', () => {
      const result = verifyClerkToken('Bearer invalid.jwt.token');
      expect(result).toBeNull();
    });
  });
});
