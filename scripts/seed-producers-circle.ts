import { getStripeClient } from '../server/stripeClient';

async function seedProducersCircle() {
  try {
    const stripe = await getStripeClient();

    console.log('Checking for existing Producers Circle Pro product...');
    const existing = await stripe.products.search({
      query: "name:'Producers Circle Pro' AND active:'true'"
    });

    if (existing.data.length > 0) {
      const product = existing.data[0];
      console.log(`Product already exists: ${product.id}`);
      const prices = await stripe.prices.list({ product: product.id, active: true });
      prices.data.forEach(p => {
        console.log(`  Price: ${p.id} — $${((p.unit_amount ?? 0) / 100).toFixed(2)}/${(p.recurring?.interval ?? '')}`);
      });
      return;
    }

    console.log('Creating Producers Circle Pro product...');
    const product = await stripe.products.create({
      name: 'Producers Circle Pro',
      description: 'Monthly membership to the Free Soul Ecclesiastical Movement Producers Circle. Full access to collaborative projects, stem uploads, investment equity, and PMA community protection.',
      metadata: {
        platform: 'producers-circle',
        pma: 'true',
      },
    });
    console.log(`Created product: ${product.id}`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 888,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`Created price: ${price.id} — $8.88/month`);

    console.log('\n✓ Producers Circle Pro product seeded successfully!');
    console.log('The webhook will sync this data to your database automatically.');
  } catch (err: any) {
    console.error('Error seeding products:', err.message);
    process.exit(1);
  }
}

seedProducersCircle();
