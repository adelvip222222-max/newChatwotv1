import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { Bot } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

const schema = z.object({
  name: z.string().min(2),
  avatar: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = schema.parse(await request.json());
    await connectToDatabase();
    const bot = await Bot.findOneAndUpdate(
      { _id: id, tenantId: session.user.tenantId },
      { $set: body },
      { new: true }
    );
    if (!bot) return NextResponse.json({ error: "البوت غير موجود." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث البوت.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
