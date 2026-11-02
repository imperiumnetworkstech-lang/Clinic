import { defineConfig } from 'vitest/config';

/** Component tests run in jsdom without the React Router build plugin. */
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['app/**/*.test.tsx', 'test/**/*.test.tsx'],
  },
});
