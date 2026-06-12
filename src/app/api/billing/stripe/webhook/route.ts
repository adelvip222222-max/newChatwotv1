import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    if (!webhookSecret) {
      return NextResponse.json({ error: "Stripe webhook secret is not configured." }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
    }

    const event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
