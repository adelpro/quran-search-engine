import { defineConfig } from 'tsup';
import { version } from './package.json';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/worker/search-worker.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: true,
    minify: false,
  },
  {
    // The CLI is built separately so the shebang banner lands only on the executable,
    // never on the library or worker entries.
    entry: ['src/cli.ts'],
    format: ['cjs'],
    dts: false,
    clean: false,
    splitting: false,
    sourcemap: true,
    minify: false,
    banner: { js: '#!/usr/bin/env node' },
    // Injected at build time so the reported version cannot drift from package.json, and
    // so nothing has to resolve a relative path to it at runtime.
    define: { __CLI_VERSION__: JSON.stringify(version) },
  },
]);
