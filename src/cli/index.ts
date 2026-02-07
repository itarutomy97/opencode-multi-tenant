#!/usr/bin/env node
/**
 * OpenCode Multi-Tenant CLI Tool
 *
 * Usage:
 *   ocl login              - OAuth login (opens browser)
 *   ocl logout             - Logout (clears token)
 *   ocl sessions list
 *   ocl sessions create
 *   ocl sessions delete <id>
 *   ocl prompt "your prompt"
 */
import { Command } from 'commander';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const API_BASE = 'https://opencode-multi-tenant.tomtar9779.workers.dev';
const CONFIG_DIR = join(homedir(), '.ocl');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Ensure config directory exists
if (!existsSync(CONFIG_DIR)) {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

// Clerk publishable key for OAuth
const CLERK_PUBLISHABLE_KEY = 'pk_test_cmVuZXdlZC1tYXJ0aW4tNjcuY2xlcmsuYWNjb3VudHMuZGV2JA';

/**
 * Get token from storage or options
 */
const getToken = (options: { token?: string }): string => {
  // If token provided via option, use it
  if (options.token) {
    return options.token;
  }

  // Try to read from stored config
  if (existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      if (config.token) {
        return config.token;
      }
    } catch (e) {
      // Invalid config, ignore
    }
  }

  return '';
};

/**
 * Save token to storage
 */
const saveToken = (token: string) => {
  const config = { token };
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log('✓ Token saved to', CONFIG_FILE);
};

/**
 * Clear stored token
 */
const clearToken = () => {
  if (existsSync(CONFIG_FILE)) {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    delete config.token;
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  }
  console.log('✓ Token cleared');
};

/**
 * Helper function for authenticated requests
 */
async function apiRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    token: string;
  }
): Promise<Response> {
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error}`);
  }

  return response;
}

// CLI Program
const program = new Command();

program
  .name('ocl')
  .description('OpenCode Multi-Tenant CLI Tool')
  .version('1.0.0')
  .option('-t, --token <token>', 'Authentication token (overrides stored token)')
  .option('-h, --help', 'Display help');

// Login command
program.command('login')
  .description('Login via OAuth (opens browser)')
  .action(async () => {
    console.log('🔐 Opening browser for authentication...');
    console.log('   Please complete the sign-in in your browser.\n');

    try {
      // Open Clerk OAuth page
      const oauthUrl = `https://accounts.devclerk.com/authorize?response_type=token&client_id=cli&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth-callback&scope=public&state=${Date.now()}`;

      // Open browser (macOS)
      execSync(`open "${oauthUrl}"`);

      // Start simple callback server to catch token
      console.log('Waiting for authentication...');
      console.log('Note: For now, please manually get the token from Clerk Dashboard and run:');
      console.log('  ocl --token YOUR_TOKEN\n');

      // TODO: Implement OAuth callback server
      // For now, guide user to manual token retrieval
      console.log('\n📋 Quick token retrieval:');
      console.log('   1. Go to: https://dashboard.clerk.com/');
      console.log('   2. Select your app');
      console.log('   3. Go to "Sessions" → "User Sessions"');
      console.log('   4. Click "Show token" and copy');
      console.log('   5. Run: ocl login YOUR_TOKEN\n');

    } catch (error) {
      console.error('Failed to open browser:', error);
    }
  });

// Login with token argument (shortcut)
program.command('login <token>')
  .argument('<token>', 'JWT token from Clerk')
  .description('Login with token (shortcut for manual token input)')
  .action(async (token) => {
    saveToken(token);
    console.log('✓ Successfully logged in!');

    // Verify token by making a test request
    try {
      await apiRequest('/api/sessions', { token });
      console.log('✓ Token verified!');
    } catch (error) {
      console.error('✗ Token verification failed. Please check your token.');
      clearToken();
    }
  });

// Logout command
program.command('logout')
  .description('Logout and clear stored token')
  .action(() => {
    clearToken();
    console.log('✓ Logged out successfully!');
  });

// Status command
program.command('status')
  .description('Show login status')
  .action(() => {
    const token = getToken(program.opts());
    if (token) {
      console.log('✓ Logged in');
      console.log('  Token:', token.substring(0, 20) + '...');
    } else {
      console.log('○ Not logged in');
      console.log('  Run: ocl login');
    }
  });

// Health check command
program.command('health')
  .description('Check API health')
  .action(async () => {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    console.log('API Status:');
    console.log(`  Status: ${data.status}`);
    console.log(`  Timestamp: ${data.timestamp}`);
    console.log(`  URL: ${API_BASE}`);
  });

// Sessions commands
const sessions = new Command('sessions')
  .description('Manage sessions');

sessions
  .command('list')
  .description('List all sessions')
  .action(async () => {
    const token = getToken(program.opts());
    if (!token) {
      console.error('Error: Not logged in. Run: ocl login');
      process.exit(1);
    }

    const response = await apiRequest('/api/sessions', { token });
    const data = await response.json();

    console.log('Sessions:');
    if (data.sessions.length === 0) {
      console.log('  No sessions found');
    } else {
      data.sessions.forEach((s: any) => {
        console.log(`  - ${s.id.substring(0, 20)}... (user: ${s.userId.substring(0, 15)}...)`);
      });
    }
  });

sessions
  .command('create')
  .description('Create a new session')
  .action(async () => {
    const token = getToken(program.opts());
    if (!token) {
      console.error('Error: Not logged in. Run: ocl login');
      process.exit(1);
    }

    const response = await apiRequest('/api/sessions', {
      method: 'POST',
      token,
    });
    const data = await response.json();

    console.log('Session created:');
    console.log(`  ID: ${data.id}`);
    console.log(`  User: ${data.userId}`);
    console.log(`  Created: ${data.createdAt}`);
  });

sessions
  .command('delete <id>')
  .description('Delete a session')
  .argument('<id>', 'Session ID to delete')
  .action(async (id, options) => {
    const token = getToken(program.opts());
    if (!token) {
      console.error('Error: Not logged in. Run: ocl login');
      process.exit(1);
    }

    const response = await apiRequest(`/api/sessions/${id}`, {
      method: 'DELETE',
      token,
    });

    if (response.status === 204) {
      console.log(`✓ Session ${id.substring(0, 20)}... deleted successfully.`);
    }
  });

program.addCommand(sessions);

// Prompt command
program.command('prompt <prompt>')
  .description('Execute an OpenCode prompt')
  .argument('<prompt>', 'Prompt to execute')
  .action(async (prompt, options) => {
    const token = getToken(program.opts());
    if (!token) {
      console.error('Error: Not logged in. Run: ocl login');
      process.exit(1);
    }

    console.log(`Executing: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`);

    const response = await apiRequest('/api/prompt', {
      method: 'POST',
      token,
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();

    console.log('Response:');
    console.log(`  ${data.response}`);
  });

// Parse and execute
program.parseAsync();
