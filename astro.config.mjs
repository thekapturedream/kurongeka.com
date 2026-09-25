// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// Public, non-secret Wix identifiers for the kurongeka.com Wix site
// (metaSiteId c3203167-4ac8-469b-93a0-a3e8b63ca4ed). Override per environment in Vercel.
const WIX_CLIENT_ID = 'e7d4a9a8-c38f-459a-8960-e755c0c82b95';
const WIX_CHECK_FORM_ID = 'e7b244fb-0bc2-411c-98d1-4bd29e40a3c8';

export default defineConfig({
  site: 'https://www.kurongeka.com',
  output: 'server',
  adapter: vercel(),
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  env: {
    schema: {
      WIX_CLIENT_ID: envField.string({ context: 'server', access: 'public', default: WIX_CLIENT_ID }),
      WIX_CHECK_FORM_ID: envField.string({ context: 'server', access: 'public', default: WIX_CHECK_FORM_ID }),
      WHATSAPP_NUMBER: envField.string({ context: 'server', access: 'public', default: '263771535326' }),
      // kurongeka.com has no MX records yet; use the working Kapture inbox until it does.
      CONTACT_EMAIL: envField.string({ context: 'server', access: 'public', default: 'hello@thekapture.com' }),
    },
  },
});
