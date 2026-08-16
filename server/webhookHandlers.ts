import type Stripe from 'stripe';
import { getStripeClient, getStripeWebhookSecret } from './stripeClient';

export class WebhookHandlers {
  /**
   * Verifies the Stripe signature and returns the parsed event.
   *
   * Throws if the signature does not match, so the caller must treat a
   * rejection as a 400 and must not act on the payload.
   */
  static async constructEvent(
    payload: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means the raw body was not captured before parsing. ' +
        'FIX: keep the express.json({ verify }) hook that stores req.rawBody.'
      );
    }

    const stripe = await getStripeClient();
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  }
}
