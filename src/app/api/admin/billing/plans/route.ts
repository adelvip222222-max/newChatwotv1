import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { BillingPlan } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  interval: z.enum(["month", "year"]),
  priceCents: z.number().min(0),
  currency: z.string().min(3).max(3).default("usd"),
  aiMessageLimit: z.number().min(0),
  stripePriceId: z.string().optional(),
  isPopular: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();
    const plan = await BillingPlan.create({
      tenantId: session.user.tenantId,
      ...body,
      currency: body.currency.toLowerCase(),
      stripePriceId: body.stripePriceId?.trim() || "",
      createdByAdmin: true,
      isPopular: body.isPopular ?? false,
      isActive: body.isActive ?? true
    });
    return NextResponse.json({ id: plan._id.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ الخطة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
