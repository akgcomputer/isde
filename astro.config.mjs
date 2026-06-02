import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'hybrid', // Hybrid mod sayesinde mevcut statik sayfalar korunur, sadece paneller SSR olur
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  site: 'https://isdeyetercom.pages.dev', // BU SATIR KESİNLİKLE OLMALI
  base: '/', // BU DA KESİNLİKLE OLMALI
});