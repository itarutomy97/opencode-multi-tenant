# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenCode Multi-Tenant API is a Cloudflare Workers-based API server with Clerk authentication.

**Tech Stack:**
- **Runtime**: Cloudflare Workers (Node.js compatibility mode)
- **Framework**: Hono
- **Auth**: Clerk (JS SDK + Backend API integration)
- **Language**: TypeScript
- **Deployment**: Wrangler

## Repository Structure

```
src/
├── api/           # API routes and middleware
├── auth/          # Authentication utilities (Clerk)
├── opencode/      # OpenCode SDK integration
├── sandbox/       # Sandbox utilities
├── session/       # Session management
├── storage/       # Storage utilities
├── worker.ts      # Main Worker entry point
└── worker-hono.ts # Hono-based Worker (current main)
```

## Development Commands

### Local Development

```bash
# Start local development server (Cloudflare Workers)
npm run dev

# Start on specific port
npx wrangler dev --port 8788
```

### Testing

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

## Authentication Flow

### Clerk Integration (Web-based)

The app uses Clerk JS SDK for browser-based authentication:

1. **Web UI Sign-in**:
   - User opens `https://your-worker.workers.dev/`
   - Clicks "Sign In / Sign Up" button
   - Clerk modal opens for sign-in/sign-up
   - Session cookie is set on Worker domain

2. **Token Retrieval**:
   - User clicks "Get My Token" button
   - Frontend calls `clerk.session.getToken()` directly
   - JWT token is displayed and can be copied

3. **API Authentication**:
   - Client sends `Authorization: Bearer <token>` header
   - Worker verifies token using `verifyClerkToken()`
   - JWT payload is decoded to extract userId

### Key Advantages

- **No CLI required**: Everything works in the browser
- **No developer tools needed**: Token is obtained via button click
- **Proper cookie domain**: Clerk JS SDK sets cookies on Worker domain
- **Simple UX**: 3 clicks to get authenticated token

## Environment Variables

### Required

```bash
OPENCODE_API_KEY=sk-xxx              # OpenCode API key
CLERK_SECRET_KEY=sk_test_xxx         # Clerk Secret Key
CLERK_PUBLISHABLE_KEY=pk_test_xxx    # Clerk Publishable Key
```

## API Endpoints

### Public

- `GET /` - Web UI for authentication and token retrieval
- `GET /health` - Health check

### Protected (Requires Clerk JWT)

- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/prompt` - Execute OpenCode prompt

## Configuration Files

- **`wrangler.jsonc`**: Cloudflare Workers configuration
- **`.dev.vars`**: Local development environment variables (git-ignored)
- **`.env.example`**: Environment variable template

## Troubleshooting

### Clerk Authentication Issues

1. **"Failed to load Clerk SDK"**: Check that `CLERK_PUBLISHABLE_KEY` is set correctly
2. **"No active session"**: User needs to sign in first via the web UI
3. **Token verification fails**: Check that `CLERK_SECRET_KEY` is correct

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

The app will be deployed to: `https://opencode-multi-tenant.tomtar9779.workers.dev`

## Key Implementation Details

### Clerk Auth Middleware (`src/auth/clerk.ts`)

- `verifyClerkToken()`: Verifies JWT tokens (networkless, decodes payload)
- `verifyClerkSessionOrToken()`: Handles both JWT and session IDs via Backend API

### Web UI (`src/worker-hono.ts`)

- Clerk JS SDK v5 loaded via CDN
- `clerk.openSignUp()` opens modal for sign-in/sign-up
- `clerk.session.getToken()` retrieves JWT for API calls
- One-click token copy functionality

### Worker (`src/worker-hono.ts`)

- Hono-based API
- CORS enabled for all routes
- In-memory session storage (to be replaced with Durable Objects)

## TODO

- [ ] Replace in-memory session storage with Durable Objects
- [ ] Implement proper JWT signature verification
- [ ] Add OpenCode SDK integration for `/api/prompt`
- [ ] Add file storage with user isolation
