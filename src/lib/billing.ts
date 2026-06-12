import type { Stripe } from "stripe";
import { Types } from "mongoose";
import {
  BillingPlan,
  MessagePack,
  PaymentEvent,
  TenantSubscription,
  type BillingPlanDocument,
  type MessagePackDocument
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { absoluteUrl } from "@/lib/strings";
import { getStripe } from "@/lib/stripe";

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
  return itemPeriodEnd ? new Date(itemPeriodEnd * 1000) : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function assertValidObjectId(value: string, label: string) {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} is invalid.`);
  }
}

export async function getBillingCatalog(tenantId: string) {
  await connectToDatabase();
  const [plans, packs] = await Promise.all([
    BillingPlan.find({ $or: [{ tenantId: null }, { tenantId }, { tenantId: { $exists: false } }], createdByAdmin: true }).sort({ interval: 1, priceCents: 1 }).lean(),
    MessagePack.find({ $or: [{ tenantId: null }, { tenantId }, { tenantId: { $exists: false } }], createdByAdmin: true }).sort({ sortOrder: 1, priceCents: 1 }).lean(),
  ]);
  let subscription = await TenantSubscription.findOne({ tenantId }).populate("planId").lean();

  if (!subscription) {
    const freePlan = plans.find(p => p.name.toLowerCase() === "free");
    if (freePlan) {
      subscription = {
        status: "active",
        monthlyMessageLimit: freePlan.aiMessageLimit,
        usedMessages: 0,
        extraMessageCredits: 0,
        planId: freePlan,
        tenantId: tenantId as any
      } as any;
    }
  }

  return {
    plans: plans.map((plan) => serializePlan(plan)),
    packs: packs.map((pack) => serializePack(pack)),
    subscription: subscription
      ? {
          status: subscription.status,
          monthlyMessageLimit: subscription.monthlyMessageLimit,
          usedMessages: subscription.usedMessages,
          extraMessageCredits: subscription.extraMessageCredits,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || "",
          planName: subscription.planId ? (subscription.planId as any).name : "الخطة المجانية"
        }
      : null
  };
}

export function serializePlan(plan: BillingPlanDocument & { _id: Types.ObjectId }) {
  return {
    id: plan._id.toString(),
    name: plan.name,
    description: plan.description || "",
    interval: plan.interval,
    priceCents: plan.priceCents,
    currency: plan.currency,
    aiMessageLimit: plan.aiMessageLimit,
    stripePriceId: plan.stripePriceId || "",
    isPopular: plan.isPopular,
    isActive: plan.isActive
  };
}

export function serializePack(pack: MessagePackDocument & { _id: Types.ObjectId }) {
  return {
    id: pack._id.toString(),
    name: pack.name,
    messageCredits: pack.messageCredits,
    priceCents: pack.priceCents,
    currency: pack.currency,
    stripePriceId: pack.stripePriceId || "",
    sortOrder: pack.sortOrder,
    isActive: pack.isActive
  };
}

export async function assertCanSendAiMessage(tenantId: string) {
  await connectToDatabase();
  const subscription = await TenantSubscription.findOne({ tenantId });
  if (!subscription) return;

  const allowance = subscription.monthlyMessageLimit + subscription.extraMessageCredits;
  if (allowance <= 0) return;

  if (subscription.usedMessages >= allowance) {
    throw new Error("تم استهلاك رصيد رسائل AI لهذه الخطة. اشتر باقة رسائل إضافية أو غيّر الخطة.");
  }
}

export async function recordAiMessageUsage(tenantId: string) {
  await TenantSubscription.findOneAndUpdate(
    { tenantId },
    { $inc: { usedMessages: 1 } },
    { new: true, upsert: false }
  );
}

export async function createStripeCheckout(input: {
  tenantId: string;
  userId: string;
  email?: string | null;
  kind: "plan" | "pack";
  itemId: string;
}) {
  await connectToDatabase();
  assertValidObjectId(input.tenantId, "Tenant id");
  assertValidObjectId(input.userId, "User id");
  assertValidObjectId(input.itemId, "Billing item id");

  const stripe = getStripe();

  const mode = input.kind === "plan" ? "subscription" : "payment";
  let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;

  if (input.kind === "plan") {
    const plan = await BillingPlan.findOne({
      _id: input.itemId,
      $or: [{ tenantId: null }, { tenantId: input.tenantId }, { tenantId: { $exists: false } }],
      createdByAdmin: true,
      isActive: true
    });
    if (!plan) throw new Error("خطة الدفع غير موجودة أو غير مفعلة.");
    lineItem = plan.stripePriceId
      ? { price: plan.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: plan.currency || process.env.STRIPE_CURRENCY || "usd",
            product_data: {
              name: plan.name,
              description: `${plan.aiMessageLimit} AI messages`
            },
            unit_amount: plan.priceCents,
            recurring: { interval: plan.interval }
          },
          quantity: 1
        };
  } else {
    const pack = await MessagePack.findOne({
      _id: input.itemId,
      $or: [{ tenantId: null }, { tenantId: input.tenantId }, { tenantId: { $exists: false } }],
      createdByAdmin: true,
      isActive: true
    });
    if (!pack) throw new Error("باقة الرسائل غير موجودة أو غير مفعلة.");
    lineItem = pack.stripePriceId
      ? { price: pack.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: pack.currency || process.env.STRIPE_CURRENCY || "usd",
            product_data: {
              name: pack.name,
              description: `${pack.messageCredits} AI messages`
            },
            unit_amount: pack.priceCents
          },
          quantity: 1
        };
  }

  const session = await stripe.checkout.sessions.create({
    mode,
    customer_email: input.email || undefined,
    client_reference_id: input.tenantId,
    line_items: [lineItem],
    success_url: absoluteUrl("/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: absoluteUrl("/dashboard/billing?canceled=1"),
    metadata: {
      tenantId: input.tenantId,
      userId: input.userId,
      kind: input.kind,
      itemId: input.itemId
    },
    subscription_data: input.kind === "plan"
      ? {
          metadata: {
            tenantId: input.tenantId,
            planId: input.itemId
          }
        }
      : undefined
  });

  return session.url;
}

export async function handleStripeEvent(event: Stripe.Event) {
  await connectToDatabase();
  
  const eventIdToTrack = event.type === "checkout.session.completed" 
    ? (event.data.object as any).id 
    : event.id;

  const exists = await PaymentEvent.exists({ stripeEventId: eventIdToTrack });
  if (exists) return;

  let paymentEvent;
  try {
    paymentEvent = await PaymentEvent.create({
      stripeEventId: eventIdToTrack,
      type: event.type,
      payload: event,
      status: "received"
    });
  } catch (error: any) {
    if (error?.code === 11000) return;
    throw error;
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "customer.subscription.updated") {
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    } else if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.payment_succeeded") {
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
    } else if (event.type === "invoice.payment_failed") {
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    }
    paymentEvent.status = "processed";
    await paymentEvent.save();
  } catch (error) {
    paymentEvent.status = "error";
    paymentEvent.error = error instanceof Error ? error.message : "Stripe webhook error";
    await paymentEvent.save();
    throw error;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenantId;
  const kind = session.metadata?.kind;
  const itemId = session.metadata?.itemId;
  if (!tenantId || !kind || !itemId) return;
  if (!Types.ObjectId.isValid(tenantId) || !Types.ObjectId.isValid(itemId)) return;

  if (kind === "plan") {
    const plan = await BillingPlan.findOne({
      _id: itemId,
      $or: [{ tenantId: null }, { tenantId }, { tenantId: { $exists: false } }],
      createdByAdmin: true,
      isActive: true
    });
    if (!plan) return;
    const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : "";
    const stripeSubscription = stripeSubscriptionId
      ? await getStripe().subscriptions.retrieve(stripeSubscriptionId)
      : null;
    const currentPeriodEnd = stripeSubscription ? getSubscriptionPeriodEnd(stripeSubscription) : null;

    await TenantSubscription.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          tenantId,
          planId: plan._id,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : "",
          stripeSubscriptionId,
          status: stripeSubscription?.status || "active",
          monthlyMessageLimit: plan.aiMessageLimit,
          usedMessages: 0,
          ...(currentPeriodEnd ? { currentPeriodEnd } : {})
        }
      },
      { upsert: true, new: true }
    );
  }

  if (kind === "pack") {
    if (session.payment_status !== "paid") return;

    const pack = await MessagePack.findOne({
      _id: itemId,
      $or: [{ tenantId: null }, { tenantId }, { tenantId: { $exists: false } }],
      createdByAdmin: true,
      isActive: true
    });
    if (!pack) return;
    await TenantSubscription.findOneAndUpdate(
      { tenantId },
      {
        $setOnInsert: {
          tenantId,
          status: "active",
          monthlyMessageLimit: 0,
          usedMessages: 0
        },
        $inc: { extraMessageCredits: pack.messageCredits }
      },
      { upsert: true, new: true }
    );
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const tenantSubscription = await TenantSubscription.findOne({ stripeSubscriptionId: subscription.id });
  if (!tenantSubscription) return;
  const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);

  await TenantSubscription.updateOne(
    { stripeSubscriptionId: subscription.id },
    {
      $set: {
        status: subscription.status,
        ...(currentPeriodEnd ? { currentPeriodEnd } : {})
      }
    }
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);
  await TenantSubscription.updateOne(
    { stripeSubscriptionId: subscription.id },
    {
      $set: {
        status: "canceled",
        ...(currentPeriodEnd ? { currentPeriodEnd } : {})
      }
    }
  );
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (invoice.billing_reason === "subscription_cycle" && subscriptionId) {
    const tenantSubscription = await TenantSubscription.findOne({ stripeSubscriptionId: subscriptionId });
    if (tenantSubscription) {
      // Reset used messages for the new billing cycle
      await TenantSubscription.updateOne(
        { _id: tenantSubscription._id },
        {
          $set: { usedMessages: 0, status: "active" }
        }
      );
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (subscriptionId) {
    await TenantSubscription.updateOne(
      { stripeSubscriptionId: subscriptionId },
      {
        $set: { status: "past_due" }
      }
    );
  }
}

export async function completeStripeCheckout(sessionId: string, tenantId: string) {
  await connectToDatabase();
  assertValidObjectId(tenantId, "Tenant id");
  
  const exists = await PaymentEvent.exists({ stripeEventId: sessionId });
  if (exists) return;

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionTenantId = session.metadata?.tenantId || session.client_reference_id;
    if (sessionTenantId !== tenantId) {
      throw new Error("Checkout session does not belong to this tenant.");
    }

    const canComplete =
      session.payment_status === "paid" ||
      (session.mode === "subscription" && session.status === "complete" && !!session.subscription);

    if (canComplete) {
      const paymentEvent = await PaymentEvent.create({
        stripeEventId: sessionId,
        tenantId,
        type: "checkout.session.completed.manual",
        payload: session,
        status: "received"
      });
      
      await handleCheckoutCompleted(session);
      
      paymentEvent.status = "processed";
      await paymentEvent.save();
    }
  } catch (error) {
    console.error("Failed to complete checkout manually:", error);
  }
}

export async function syncSubscriptionWithStripe(tenantId: string) {
  await connectToDatabase();
  const tenantSubscription = await TenantSubscription.findOne({ tenantId });
  if (!tenantSubscription || !tenantSubscription.stripeSubscriptionId) return;

  const stripe = getStripe();
  try {
    const subscription = await stripe.subscriptions.retrieve(tenantSubscription.stripeSubscriptionId);
    
    // Check if period rolled over to reset usage
    const newPeriodEnd = getSubscriptionPeriodEnd(subscription);
    if (!newPeriodEnd) return;
    const isNewCycle = tenantSubscription.currentPeriodEnd 
      && tenantSubscription.currentPeriodEnd < newPeriodEnd 
      && subscription.status === "active";

    await TenantSubscription.updateOne(
      { _id: tenantSubscription._id },
      {
        $set: {
          status: subscription.status,
          currentPeriodEnd: newPeriodEnd,
          ...(isNewCycle ? { usedMessages: 0 } : {})
        }
      }
    );
  } catch (error) {
    console.error(`Failed to sync subscription for tenant ${tenantId}:`, error);
  }
}

export async function getSubscriptionAnalytics() {
  await connectToDatabase();
  
  const [totalRevenue, activeSubscriptions, byPlan] = await Promise.all([
    TenantSubscription.aggregate([
      { $match: { status: "active", planId: { $exists: true, $ne: null } } },
      { $lookup: { from: "billingplans", localField: "planId", foreignField: "_id", as: "plan" } },
      { $unwind: "$plan" },
      {
        $group: {
          _id: null,
          mrrCents: {
            $sum: {
              $cond: [
                { $eq: ["$plan.interval", "month"] },
                "$plan.priceCents",
                { $divide: ["$plan.priceCents", 12] }
              ]
            }
          }
        }
      }
    ]),
    TenantSubscription.countDocuments({ status: "active" }),
    TenantSubscription.aggregate([
      { $match: { status: "active", planId: { $exists: true, $ne: null } } },
      { $lookup: { from: "billingplans", localField: "planId", foreignField: "_id", as: "plan" } },
      { $unwind: "$plan" },
      {
        $group: {
          _id: "$plan.name",
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  // Count free users (those without an active paid subscription)
  const freeUsersCount = await TenantSubscription.countDocuments({
    $or: [{ status: { $ne: "active" } }, { planId: null }]
  });

  return {
    mrrCents: totalRevenue[0]?.mrrCents || 0,
    activeCount: activeSubscriptions,
    distribution: [
      ...byPlan.map((p) => ({ name: p._id as string, count: p.count as number })),
      { name: "Free / Inactive", count: freeUsersCount }
    ]
  };
}

export async function getAllSubscriptions() {
  await connectToDatabase();
  const subs = await TenantSubscription.find()
    .populate("tenantId")
    .populate("planId")
    .sort({ createdAt: -1 })
    .lean();

  return subs.map((sub: any) => ({
    id: sub._id.toString(),
    tenantName: sub.tenantId?.name || "Unknown",
    tenantSlug: sub.tenantId?.slug || "",
    planName: sub.planId?.name || "الخطة المجانية",
    status: sub.status,
    usedMessages: sub.usedMessages,
    monthlyLimit: sub.monthlyMessageLimit,
    extraCredits: sub.extraMessageCredits,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || ""
  }));
}

export async function cancelSubscriptionByAdmin(subscriptionId: string) {
  await connectToDatabase();
  const sub = await TenantSubscription.findById(subscriptionId);
  if (!sub || !sub.stripeSubscriptionId) throw new Error("تعذر إيجاد الاشتراك أو أنه غير مرتبط بـ Stripe.");

  const stripe = getStripe();
  try {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  } catch (error) {
    console.error("Stripe cancel error:", error);
    // Proceed anyway to update local db if Stripe fails (e.g. already canceled)
  }

  await TenantSubscription.updateOne(
    { _id: sub._id },
    { $set: { status: "canceled", currentPeriodEnd: new Date() } }
  );
}

export async function createStripePortalSession(tenantId: string) {
  await connectToDatabase();
  const subscription = await TenantSubscription.findOne({ tenantId });
  if (!subscription || !subscription.stripeCustomerId) {
    throw new Error("لا يوجد حساب دفع مرتبط حالياً بـ Stripe.");
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: absoluteUrl("/dashboard/billing")
  });

  return session.url;
}
