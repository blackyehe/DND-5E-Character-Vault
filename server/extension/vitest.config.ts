import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: false,
  test: { include: ['server/extension/*.test.ts'], environment: 'node', fileParallelism: false },
})
