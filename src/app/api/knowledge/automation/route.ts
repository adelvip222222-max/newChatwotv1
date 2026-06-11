import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { Bot } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

const schema = z.object({
  botId: z.string().min(1),
  autoFollowupEnabled: z.boolean(),
  followupDelayMinutes: z.number().min(1).max(10080),
  followupMaxAttempts: z.number().min(0).max(5),
  autoCloseEnabled: z.boolean(),
  autoCloseAfterMinutes: z.number().min(1).max(43200),
  autoCloseMessage: z.string().max(500).optional()
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
          autoFollowupEnabled: body.autoFollowupEnabled,
          followupDelayMinutes: body.followupDelayMinutes,
          followupMaxAttempts: body.followupMaxAttempts,
          autoCloseEnabled: body.autoCloseEnabled,
          autoCloseAfterMinutes: body.autoCloseAfterMinutes,
          autoCloseMessage: body.autoCloseMessage || ""
        }
      },
      { new: true }
    );
    if (!bot) throw new Error("البوت غير موجود داخل هذا الحساب.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ إعدادات الأتمتة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
