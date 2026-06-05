import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createStripePortalSession } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const url = await createStripePortalSession(session.user.tenantId);
    
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر فتح بوابة الدفع.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
