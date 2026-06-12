import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAiReply } from "@/lib/ai";

const schema = z.object({
  tenantId: z.string().min(1),
  botId: z.string().min(1),
  conversationId: z.string().min(1),
  visitorId: z.string().min(1),
  message: z.string().min(1),
  attachments: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(["image", "audio", "file"]),
    key: z.string().optional(),
    url: z.string().optional(),
    name: z.string(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
    dataUrl: z.string().optional()
  })).optional()
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await generateAiReply({
      tenantId: body.tenantId,
      botId: body.botId,
      conversationId: body.conversationId,
      externalUserId: body.visitorId,
      channel: "website",
      message: body.attachments?.length
        ? `${body.message}\n\nمرفقات المستخدم: ${body.attachments.map((item) => `${item.type}: ${item.name}`).join(", ")}`
        : body.message,
      metadata: {
        attachments: (body.attachments || []).filter((item) => item.id && item.key)
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إرسال الرسالة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
