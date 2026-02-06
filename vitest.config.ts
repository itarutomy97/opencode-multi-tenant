import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testMatch: ['**/*.test.ts'],
    include: ['**/*.test.ts'],
    exclude: ['node_modules'],
  },
});
