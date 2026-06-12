import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { Bot } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

const schema = z.object({
  botId: z.string().min(1),
  knowledgeEnabled: z.boolean(),
  showKnowledgeSources: z.boolean(),
  confidenceDirectThreshold: z.number().min(0).max(100),
  confidenceReviewThreshold: z.number().min(0).max(100)
});

export async function PATCH(request: Request) {
  try {
    const session = await requirePermission(permissions.knowledgeManage);
    const body = schema.parse(await request.json());
    await connectToDatabase();
    const bot = await Bot.findOneAndUpdate(
      { _id: body.botId, tenantId: session.user.tenantId },
      {
        $set: {
          knowledgeEnabled: body.knowledgeEnabled,
          showKnowledgeSources: body.showKnowledgeSources,
          confidenceDirectThreshold: body.confidenceDirectThreshold,
          confidenceReviewThreshold: body.confidenceReviewThreshold
        }
      },
      { new: true }
    );
    if (!bot) throw new Error("البوت غير موجود داخل هذا الحساب.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ إعدادات المعرفة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
