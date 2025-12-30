import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',  // 'server' yerine 'static' yap!
  adapter: cloudflare({
    imageService: 'noop'
  })
});