import { defineConfig } from '@solidjs/start/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    preset: 'node-server',
    // Bundle all dependencies into the output so the build is fully
    // self-contained — no need for node_modules at the deployment target.
    noExternals: true,
  },
});
