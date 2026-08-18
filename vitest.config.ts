import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Loads .env.local so the database integration suite runs instead of
    // skipping on a machine that can actually run it.
    setupFiles: ['./vitest.setup.ts'],
  },
});
