import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import tailwind from '@astrojs/tailwind';

export default defineConfig({
  // Hybrid mod sayesinde mevcut statik sayfalar korunur, sadece paneller SSR olur
  output: 'hybrid',

  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),

  // BU SATIR KESİNLİKLE OLMALI
  site: 'https://isdeyetercom.pages.dev',

  // BU DA KESİNLİKLE OLMALI
  base: '/',

  integrations: [tailwind()]
});