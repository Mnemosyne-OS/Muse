import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standard configuration for Mnemosyne OS Cartridges.
export default defineConfig({
  plugins: [react()],
  base: './', // Vital for custom protocols (mnemo-plugin://) in production.
  server: {
    host: '127.0.0.1', // Forces IPv4 loopback binding for Electron compatibility.
    port: 5205,        // Unique static port — MUST match apps/dev-ports.json + mnemo-plugin.json.
    strictPort: true,  // Fails fast if the port is already in use.
    cors: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
});
