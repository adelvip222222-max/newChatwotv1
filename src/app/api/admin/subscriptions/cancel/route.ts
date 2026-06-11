import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guards";
import { cancelSubscriptionByAdmin } from "@/lib/billing";

const schema = z.object({
  subscriptionId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = schema.parse(await request.json());
    
    await cancelSubscriptionByAdmin(body.subscriptionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إلغاء الاشتراك.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
