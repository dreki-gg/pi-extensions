import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
  // The CLI entry needs a node shebang so the published `taskman` bin is
  // directly executable. effect/commander stay external (resolved at runtime).
  outputOptions: {
    banner: (chunk) => (chunk.name === 'cli' ? '#!/usr/bin/env node' : ''),
  },
});
