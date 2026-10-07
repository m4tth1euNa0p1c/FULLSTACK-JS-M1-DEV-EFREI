import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, Vite sert le front sur :5173 et relaie les appels /api
// vers l'API Express sur :3000 : pas de problème CORS ni d'URL à configurer.
const apiProxy = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
});
