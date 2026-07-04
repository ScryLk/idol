import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // permite testar em aparelho físico na rede local (requisito M1)
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
});
