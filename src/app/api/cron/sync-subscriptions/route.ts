import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { TenantSubscription } from "@/lib/models";
import { syncSubscriptionWithStripe } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    
    // Find all active subscriptions
    const activeSubscriptions = await TenantSubscription.find({
      status: { $in: ["active", "past_due"] },
      stripeSubscriptionId: { $exists: true, $ne: "" }
    });

    let syncedCount = 0;
    for (const sub of activeSubscriptions) {
      await syncSubscriptionWithStripe(sub.tenantId.toString());
      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedCount} subscriptions.`
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
