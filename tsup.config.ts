import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/worker/search-worker.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  minify: false,
});
