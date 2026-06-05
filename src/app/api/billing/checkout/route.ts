import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createStripeCheckout } from "@/lib/billing";

const schema = z.object({
  kind: z.enum(["plan", "pack"]),
  itemId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await request.json());
    const url = await createStripeCheckout({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      email: session.user.email,
      kind: body.kind,
      itemId: body.itemId
    });

    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر بدء الدفع.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
