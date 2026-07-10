import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    bin: 'src/bin.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
  outputOptions: {
    banner: () => '#!/usr/bin/env node',
  },
});
