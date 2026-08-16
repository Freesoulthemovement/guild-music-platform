import Stripe from 'stripe';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to the environment before using Stripe. ` +
      `See .env.example for the full list of required variables.`
    );
  }
  return value;
}

let cachedClient: Stripe | null = null;

/**
 * Stripe client built from STRIPE_SECRET_KEY.
 *
 * The key is static, so the client is created once and reused. Throws if the
 * key is missing — callers are expected to surface that as a 5xx rather than
 * crash the process, so the rest of the app keeps serving when Stripe is not
 * yet configured.
 */
export async function getStripeClient(): Promise<Stripe> {
  if (!cachedClient) {
    cachedClient = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  }
  return cachedClient;
}

/**
 * Signing secret for the webhook endpoint registered in the Stripe dashboard
 * (Developers -> Webhooks -> your endpoint -> Signing secret).
 */
export function getStripeWebhookSecret(): string {
  return requireEnv('STRIPE_WEBHOOK_SECRET');
}

/**
 * Optional. When set, the checkout route uses this price directly instead of
 * searching for one by product name. Preferred in production: price search is
 * eventually consistent and can miss a just-created price.
 */
export function getConfiguredPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_ID || undefined;
}
