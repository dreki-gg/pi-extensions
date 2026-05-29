import { defineConfig } from '@solidjs/start/config';

export default defineConfig({
  server: {
    preset: 'node-server',
    // Bundle all dependencies into the output so the build is fully
    // self-contained — no need for node_modules at the deployment target.
    noExternals: true,
  },
});
