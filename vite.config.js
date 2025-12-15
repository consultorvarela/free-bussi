import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['phaser']
  },
  build: {
    sourcemap: false
  }
});
