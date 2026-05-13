import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  // Bundle shell-quote into the output so the compiled package has zero runtime deps
  deps: {
    alwaysBundle: ['shell-quote'],
  },
});
