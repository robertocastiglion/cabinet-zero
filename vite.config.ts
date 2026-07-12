import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/games/')) {
            const match = id.match(/\/src\/games\/([^/]+)\//);
            if (match?.[1]) return `game-${match[1]}`;
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
