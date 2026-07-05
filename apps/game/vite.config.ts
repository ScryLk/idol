import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: true, // permite testar em aparelho físico na rede local (requisito M1)
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
  plugins: [
    // PWA como canal secundário de distribuição/beta (requisito da stack)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'IDOL',
        short_name: 'IDOL',
        description: 'Desenhe jogadas, arrisque dribles e conquiste a torcida.',
        lang: 'pt-BR',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#0a3d0a',
        theme_color: '#0a3d0a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // bundle do Phaser
      },
    }),
  ],
});
