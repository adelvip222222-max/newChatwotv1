import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = webhookSecret && signature
      ? getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
      : JSON.parse(payload);
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
