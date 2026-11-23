import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests live next to the code; e2e/ is Playwright's.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'] },
});
