import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:5000',
      '/scan': 'http://localhost:5000',
      '/alerts': 'http://localhost:5000',
      '/digest': 'http://localhost:5000',
      '/bills': 'http://localhost:5000',
      '/sheets': 'http://localhost:5000',
      '/health': 'http://localhost:5000'
    }
  }
});
