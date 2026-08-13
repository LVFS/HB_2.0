import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/HB_2.0/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173
  }
});
