#!/usr/bin/env node
/**
 * OpenCode Multi-Tenant CLI Tool
 *
 * Usage:
 *   ocl sessions list
 *   ocl sessions create
 *   ocl sessions delete <id>
 *   ocl prompt "your prompt"
 *   ocl --token YOUR_TOKEN
 */
import { Command } from 'commander';

const API_BASE = 'https://opencode-multi-tenant.tomtar9779.workers.dev';

// Get token from environment or option
const getToken = (options: { token?: string }): string => {
  return options.token || process.env.OCL_TOKEN || '';
};

// Helper function for authenticated requests
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
  .option('-t, --token <token>', 'Authentication token')
  .option('-h, --help', 'Display help');

// Health check command
program.command('health')
  .description('Check API health')
  .action(async () => {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    console.log('API Status:');
    console.log(`  Status: ${data.status}`);
    console.log(`  Timestamp: ${data.timestamp}`);
    console.log(`  Uptime: ${data.uptime}`);
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
      console.error('Error: Token required. Use --token or OCL_TOKEN environment variable.');
      process.exit(1);
    }

    const response = await apiRequest('/api/sessions', { token });
    const data = await response.json();

    console.log('Sessions:');
    if (data.sessions.length === 0) {
      console.log('  No sessions found');
    } else {
      data.sessions.forEach((s: any) => {
        console.log(`  - ${s.id} (user: ${s.userId}, created: ${s.createdAt})`);
      });
    }
  });

sessions
  .command('create')
  .description('Create a new session')
  .action(async () => {
    const token = getToken(program.opts());
    if (!token) {
      console.error('Error: Token required. Use --token or OCL_TOKEN environment variable.');
      process.exit(1);
    }

    const response = await apiRequest('/api/sessions', {
      method: 'POST',
      token,
    });
    const data = await response.json();

    console.log('Session created:');
    console.log(`  ID: ${data.id}`);
    console.log(`  User ID: ${data.userId}`);
    console.log(`  Created: ${data.createdAt}`);
  });

sessions
  .command('delete <id>')
  .description('Delete a session')
  .argument('<id>', 'Session ID to delete')
  .action(async (id, options) => {
    const token = getToken(program.opts());
    if (!token) {
      console.error('Error: Token required. Use --token or OCL_TOKEN environment variable.');
      process.exit(1);
    }

    const response = await apiRequest(`/api/sessions/${id}`, {
      method: 'DELETE',
      token,
    });

    if (response.status === 204) {
      console.log(`Session ${id} deleted successfully.`);
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
      console.error('Error: Token required. Use --token or OCL_TOKEN environment variable.');
      process.exit(1);
    }

    console.log(`Executing prompt: ${prompt}`);

    const response = await apiRequest('/api/prompt', {
      method: 'POST',
      token,
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();

    console.log('Response:');
    console.log(`  Success: ${data.success}`);
    console.log(`  Result: ${data.response}`);
  });

// Parse and execute
program.parseAsync();
