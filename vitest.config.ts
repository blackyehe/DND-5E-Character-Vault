import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    // Archived releases under output/ and .preview.local/ are immutable evidence,
    // not the current application. Prototype node:test files have their own runner.
    include: ['src', 'shared', 'server', 'scripts/benchmarks'].map(directory =>
      `${directory}/**/*.{test,spec}.?(c|m)[jt]s?(x)`,
    ),
  },
}))
