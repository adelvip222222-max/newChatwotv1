import mongoose from "mongoose";
import Stripe from "stripe";
import { BillingPlan, MessagePack } from "../src/lib/models";

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is required.");
  process.exit(1);
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is required.");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20" as any, // use current stripe version
});

const defaultPlans = [
  {
    name: "Free",
    description: "For exploring the platform",
    interval: "month" as const,
    priceCents: 0,
    aiMessageLimit: 100,
    isPopular: false,
  },
  {
    name: "Starter",
    description: "Great for small websites",
    interval: "month" as const,
    priceCents: 1900, // $19
    aiMessageLimit: 2000,
    isPopular: false,
  },
  {
    name: "Pro",
    description: "For growing businesses",
    interval: "month" as const,
    priceCents: 4900, // $49
    aiMessageLimit: 10000,
    isPopular: true,
  },
];

const defaultPacks = [
  {
    name: "1,000 Extra AI Messages",
    messageCredits: 1000,
    priceCents: 500, // $5
    sortOrder: 1,
  },
  {
    name: "5,000 Extra AI Messages",
    messageCredits: 5000,
    priceCents: 2000, // $20
    sortOrder: 2,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  console.log("Seeding Billing Plans...");
  for (const plan of defaultPlans) {
    let stripePriceId = "";
    if (plan.priceCents > 0) {
      // Find or create product
      const products = await stripe.products.search({
        query: `name:'${plan.name} Plan'`,
      });
      let product = products.data[0];
      if (!product) {
        product = await stripe.products.create({
          name: `${plan.name} Plan`,
          description: plan.description,
        });
      }

      // Find or create price
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });
      let price = prices.data.find(
        (p) =>
          p.unit_amount === plan.priceCents &&
          p.recurring?.interval === plan.interval
      );
      if (!price) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.priceCents,
          currency: process.env.STRIPE_CURRENCY || "usd",
          recurring: { interval: plan.interval },
        });
      }
      stripePriceId = price.id;
    }

    await BillingPlan.findOneAndUpdate(
      { name: plan.name, interval: plan.interval },
      {
        ...plan,
        stripePriceId,
        createdByAdmin: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`Upserted plan: ${plan.name} (${stripePriceId})`);
  }

  console.log("Seeding Message Packs...");
  for (const pack of defaultPacks) {
    let stripePriceId = "";
    if (pack.priceCents > 0) {
      // Find or create product
      const products = await stripe.products.search({
        query: `name:'${pack.name}'`,
      });
      let product = products.data[0];
      if (!product) {
        product = await stripe.products.create({
          name: pack.name,
        });
      }

      // Find or create price
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });
      let price = prices.data.find(
        (p) => p.unit_amount === pack.priceCents && !p.recurring
      );
      if (!price) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: pack.priceCents,
          currency: process.env.STRIPE_CURRENCY || "usd",
        });
      }
      stripePriceId = price.id;
    }

    await MessagePack.findOneAndUpdate(
      { name: pack.name },
      {
        ...pack,
        stripePriceId,
        createdByAdmin: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`Upserted pack: ${pack.name} (${stripePriceId})`);
  }

  console.log("Seeding Complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
