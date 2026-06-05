import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { AiSetting, AiModel, Bot } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/strings";

const schema = z.object({
  botId: z.string().min(1),
  aiModelId: z.string().min(1),
  isEnabled: z.boolean(),
  temperature: z.number().min(0).max(2),
  systemPrompt: z.string().min(10),
  language: z.string().optional(),
  role: z.string().optional(),
  tone: z.string().optional(),
  responseLength: z.string().optional(),
  fallbackMessage: z.string().optional(),
  useEmojis: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const bot = await Bot.findOne({ _id: body.botId, tenantId: session.user.tenantId });
    if (!bot) return NextResponse.json({ error: "البوت غير موجود." }, { status: 404 });

    const aiModel = await AiModel.findOne({
      _id: body.aiModelId,
      isActive: true
    });
    if (!aiModel) return NextResponse.json({ error: "نموذج AI غير موجود أو غير مفعل." }, { status: 404 });

    await AiSetting.findOneAndUpdate(
      { tenantId: session.user.tenantId, botId: body.botId },
      {
        $set: {
          tenantId: session.user.tenantId,
          botId: body.botId,
          aiModelId: body.aiModelId,
          provider: aiModel.provider,
          model: aiModel.model,
          temperature: body.temperature,
          systemPrompt: body.systemPrompt || DEFAULT_SYSTEM_PROMPT,
          language: body.language || "auto",
          role: body.role || "assistant",
          tone: body.tone || "neutral",
          responseLength: body.responseLength || "medium",
          fallbackMessage: body.fallbackMessage || "عذراً، لم أفهم طلبك جيداً. هل يمكنك التوضيح؟",
          useEmojis: body.useEmojis ?? true,
          isEnabled: body.isEnabled
        }
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ إعدادات AI.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
