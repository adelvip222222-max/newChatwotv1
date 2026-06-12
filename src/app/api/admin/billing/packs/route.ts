import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guards";
import { MessagePack } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

const schema = z.object({
  name: z.string().min(2),
  messageCredits: z.number().min(1),
  priceCents: z.number().min(0),
  currency: z.string().min(3).max(3).default("usd"),
  stripePriceId: z.string().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();
    const pack = await MessagePack.create({
      tenantId: session.user.tenantId,
      ...body,
      currency: body.currency.toLowerCase(),
      stripePriceId: body.stripePriceId?.trim() || "",
      createdByAdmin: true,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true
    });
    return NextResponse.json({ id: pack._id.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ باقة الرسائل.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
