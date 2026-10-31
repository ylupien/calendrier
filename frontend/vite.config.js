import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const API_URL = process.env.API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: API_URL, changeOrigin: false },
      '/socket.io': { target: API_URL, ws: true, changeOrigin: false },
    },
  },
});
