import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { AiSetting, Bot } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/strings";

const schema = z.object({
  botId: z.string().min(1),
  systemPrompt: z.string().min(10)
});

export async function PATCH(request: Request) {
  try {
    const session = await requirePermission(permissions.knowledgeManage);
    const body = schema.parse(await request.json());
    await connectToDatabase();
    const bot = await Bot.findOne({ _id: body.botId, tenantId: session.user.tenantId });
    if (!bot) throw new Error("البوت غير موجود داخل هذا الحساب.");

    await AiSetting.findOneAndUpdate(
      { tenantId: session.user.tenantId, botId: body.botId },
      {
        $setOnInsert: {
          tenantId: session.user.tenantId,
          botId: body.botId,
          provider: "openai",
          model: process.env.DEFAULT_AI_MODEL || "gpt-4o-mini",
          temperature: 0.4,
          isEnabled: true
        },
        $set: {
          systemPrompt: body.systemPrompt || DEFAULT_SYSTEM_PROMPT
        }
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ تعليمات الذكاء الاصطناعي.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
