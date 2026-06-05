import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAiReply } from "@/lib/ai";
import { assertObjectIdLike, assertTenantAccess } from "@/lib/api-security";

const schema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional().or(z.literal("")),
  botId: z.string().min(1),
  tenantId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    assertObjectIdLike(body.tenantId, "tenantId");
    assertObjectIdLike(body.botId, "botId");
    await assertTenantAccess(body.tenantId);
    const result = await generateAiReply({
      tenantId: body.tenantId,
      botId: body.botId,
      conversationId: body.conversationId || undefined,
      externalUserId: "api-user",
      channel: "api",
      message: body.message
    });

    return NextResponse.json({ reply: result.reply, conversationId: result.conversationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء توليد الرد.";
    return NextResponse.json({ error: message, reply: "" }, { status: 400 });
  }
}
