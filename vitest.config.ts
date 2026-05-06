import { defineConfig } from 'vitest/config';

// Minimal vitest config — auto-scaffolded by Claude review.
// Erweitere nach Bedarf (jsdom-environment, plugins, coverage, etc.)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx}', 'src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['node_modules', 'dist', '.next', 'coverage'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'dist', '.next', '**/*.config.*', '**/*.d.ts'],
    },
  },
});
