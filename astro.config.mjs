// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// Public, non-secret Wix identifiers for the kurongeka.com Wix site
// (metaSiteId c3203167-4ac8-469b-93a0-a3e8b63ca4ed). Override per environment in Vercel.
const WIX_CLIENT_ID = 'e7d4a9a8-c38f-459a-8960-e755c0c82b95';
const WIX_CHECK_FORM_ID = 'e7b244fb-0bc2-411c-98d1-4bd29e40a3c8';
const WIX_ENQUIRY_FORM_ID = '12c98587-2471-4c55-b003-1ffb0ec99ae5';

export default defineConfig({
  site: 'https://www.kurongeka.com',
  output: 'server',
  // Website checks fetch other sites; allow them time to finish.
  adapter: vercel({ maxDuration: 30 }),
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
      WIX_ENQUIRY_FORM_ID: envField.string({ context: 'server', access: 'public', default: WIX_ENQUIRY_FORM_ID }),
      // Kurongeka is run from the UK.
      WHATSAPP_NUMBER: envField.string({ context: 'server', access: 'public', default: '447352144677' }),
      // kurongeka.com has no MX records yet; use the working Kapture inbox until it does.
      CONTACT_EMAIL: envField.string({ context: 'server', access: 'public', default: 'hello@thekapture.com' }),
    },
  },
});
