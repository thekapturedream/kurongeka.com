import { createClient, OAuthStrategy } from '@wix/sdk';
import { items } from '@wix/data';
import { submissions } from '@wix/forms';
import { plansV3 } from '@wix/pricing-plans';
import { WIX_CLIENT_ID } from 'astro:env/server';

/**
 * Wix clients for the kurongeka.com Wix site (self-managed headless, visitor OAuth).
 * Only public, visitor-level operations run here. Nothing in this project needs admin credentials.
 */

function createReadClient() {
  return createClient({
    modules: { items, plansV3 },
    auth: OAuthStrategy({ clientId: WIX_CLIENT_ID }),
  });
}

let readClient: ReturnType<typeof createReadClient> | undefined;

/**
 * Shared anonymous visitor for public reads (CMS content, public plans).
 * Reusing one identity per server instance avoids minting a visitor token on every request.
 */
export function wixRead() {
  readClient ??= createReadClient();
  return readClient;
}

/**
 * A fresh visitor per lead. Wix links submissions to the submitting visitor's contact,
 * so sharing one identity across different people would merge their leads into one contact.
 */
export function wixLeadClient() {
  return createClient({
    modules: { submissions },
    auth: OAuthStrategy({ clientId: WIX_CLIENT_ID }),
  });
}
