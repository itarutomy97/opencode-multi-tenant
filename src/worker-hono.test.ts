/**
 * Hono-based Worker Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Worker, SessionDurableObject } from './worker-hono.js';
import type { Env } from './worker-hono.js';

// The SessionDurableObject is now defined in worker-hono.ts, so no need to mock it separately


describe('Hono-based Worker', () => {
  let worker: Worker;
  let env: Env;
  let mockSessionsDO: any;

  beforeEach(() => {
    // Create a mock Durable Object namespace with session storage
    const sessions = new Map<string, { id: string; userId: string; createdAt: number }>();
    const messages = new Map<string, Array<{ role: string; content: string }>>();

    mockSessionsDO = {
      get: vi.fn().mockReturnValue({
        createSession: vi.fn().mockImplementation(async (userId: string) => {
          const session = {
            id: `test-session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            userId,
            createdAt: Date.now(),
          };
          sessions.set(session.id, session);
          messages.set(session.id, []);
          return session;
        }),
        getSession: vi.fn().mockImplementation(async (sessionId: string, userId: string) => {
          const session = sessions.get(sessionId);
          if (session && session.userId === userId) {
            return session;
          }
          return null;
        }),
        deleteSession: vi.fn().mockImplementation(async (sessionId: string, userId: string) => {
          const session = sessions.get(sessionId);
          if (session && session.userId === userId) {
            sessions.delete(sessionId);
            messages.delete(sessionId);
            return true;
          }
          return false;
        }),
        listUserSessions: vi.fn().mockImplementation(async (userId: string) => {
          return Array.from(sessions.values()).filter(s => s.userId === userId);
        }),
        addMessage: vi.fn().mockImplementation(async (sessionId: string, userId: string, message: { role: string; content: string }) => {
          const session = sessions.get(sessionId);
          if (!session || session.userId !== userId) {
            throw new Error('Session not found or access denied');
          }
          const history = messages.get(sessionId) || [];
          history.push(message);
          messages.set(sessionId, history);
        }),
        getConversationHistory: vi.fn().mockImplementation(async (sessionId: string, userId: string) => {
          const session = sessions.get(sessionId);
          if (!session || session.userId !== userId) {
            return [];
          }
          return messages.get(sessionId) || [];
        }),
      }),
    };

    env = {
      SESSIONS: mockSessionsDO,
      OPENCODE_API_KEY: 'test-api-key',
      CLERK_SECRET_KEY: 'test-clerk-secret',
      CLERK_PUBLISHABLE_KEY: 'pk_test_123456',
    };

    worker = new Worker(env);
  });

  describe('Hono App Setup', () => {
    it('creates a Hono app instance', () => {
      expect(worker).toBeDefined();
      expect(worker.app).toBeDefined();
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

  describe('GET /', () => {
    it('returns HTML home page', async () => {
      const request = new Request('http://localhost/');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      const text = await response.text();
      expect(text).toContain('OpenCode');
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
      // First create a session
      const createToken = createMockToken('user_123');
      const createRequest = new Request('http://localhost/api/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${createToken}` },
      });
      const createResponse = await worker.fetch(createRequest, env);
      const createdSession = await createResponse.json();

      // Then delete it
      const deleteToken = createMockToken('user_123');
      const deleteRequest = new Request(`http://localhost/api/sessions/${createdSession.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${deleteToken}` },
      });
      const deleteResponse = await worker.fetch(deleteRequest, env);

      expect(deleteResponse.status).toBe(204);
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
