/**
 * Hono-based Worker Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { worker } from './worker-hono.js';
import type { Env } from './worker-hono.js';

// Mock @cloudflare/sandbox
vi.mock('@cloudflare/sandbox', () => ({
  getSandbox: vi.fn(() => ({
    exec: vi.fn().mockResolvedValue({ stdout: '', success: true }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue({ content: '' }),
  })),
  Sandbox: class MockSandbox {},
}));

describe('Hono-based Worker', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      OpenCodeSandbox: {
        get: vi.fn(),
      } as any,
      OPENCODE_API_KEY: 'test-api-key',
      CLERK_SECRET_KEY: 'test-clerk-secret',
      CLERK_JWT_KEY: 'test-jwt-key',
    };
  });

  describe('Hono App Setup', () => {
    it('creates a Hono app instance', () => {
      expect(worker).toBeDefined();
      expect(worker.app).toBeDefined();
      expect(worker.app instanceof Hono).toBe(true);
    });

    it('has a fetch method for Workers', () => {
      expect(worker.fetch).toBeDefined();
      expect(typeof worker.fetch).toBe('function');
    });
  });

  describe('GET /health', () => {
    it('returns health status', async () => {
      const request = new Request('http://localhost/health');
      const response = await worker.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('POST /api/prompt', () => {
    it('requires authentication', async () => {
      const request = new Request('http://localhost/api/prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(401);
    });

    it('executes prompt with valid auth', async () => {
      const validToken = createMockToken('user_123');
      const request = new Request('http://localhost/api/prompt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'hello world' }),
      });

      const response = await worker.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/sessions', () => {
    it('requires authentication', async () => {
      const request = new Request('http://localhost/api/sessions');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(401);
    });

    it('returns sessions list with valid auth', async () => {
      const validToken = createMockToken('user_123');
      const request = new Request('http://localhost/api/sessions', {
        headers: { 'Authorization': `Bearer ${validToken}` },
      });
      const response = await worker.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessions).toBeDefined();
    });
  });

  describe('POST /api/sessions', () => {
    it('creates new session with valid auth', async () => {
      const validToken = createMockToken('user_123');
      const request = new Request('http://localhost/api/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${validToken}` },
      });
      const response = await worker.fetch(request, env);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.userId).toBe('user_123');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('deletes session with valid auth', async () => {
      const validToken = createMockToken('user_123');
      const request = new Request('http://localhost/api/sessions/session-123', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${validToken}` },
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
    });
  });

  describe('404 Not Found', () => {
    it('returns 404 for unknown routes', async () => {
      const request = new Request('http://localhost/unknown-route');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
    });
  });
});

// Helper to create mock JWT token
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
  return `${header}.${payload}.signature`;
}
