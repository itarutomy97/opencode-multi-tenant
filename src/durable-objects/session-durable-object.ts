/**
 * Session Durable Object types and interfaces
 *
 * The SessionDurableObject class is defined in worker-hono.ts
 * This file exports the type interface for use in other modules
 */

export interface SessionData {
  id: string;
  userId: string;
  createdAt: number;
}

export interface ConversationMessage {
  role: string;
  content: string;
}

/**
 * RPC methods for SessionDurableObject
 * All methods return Promises since Durable Object communication is async
 */
export interface SessionDurableObjectState {
  createSession(userId: string): Promise<SessionData>;
  getSession(sessionId: string, userId: string): Promise<SessionData | null>;
  deleteSession(sessionId: string, userId: string): Promise<boolean>;
  listUserSessions(userId: string): Promise<SessionData[]>;
  addMessage(sessionId: string, userId: string, message: ConversationMessage): Promise<void>;
  getConversationHistory(sessionId: string, userId: string): Promise<ConversationMessage[]>;
}

// Note: The SessionDurableObject class implementation is in worker-hono.ts
// This file only contains the type interface for dependency injection
