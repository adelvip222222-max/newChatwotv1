import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { generateSmartReply, refreshConversationIntelligence } from "@/lib/inbox/ai-copilot";

const schema = z.object({
  action: z.enum(["formal", "short", "friendly", "professional", "sales", "support", "refresh"]).default("refresh")
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.aiRead);
    const { id } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));

    if (body.action === "refresh") {
      const insight = await refreshConversationIntelligence({
        tenantId: session.user.tenantId,
        conversationId: id,
        force: true
      });
      return NextResponse.json({ success: true, insight });
    }

    const reply = await generateSmartReply({
      tenantId: session.user.tenantId,
      conversationId: id,
      action: body.action
    });

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate AI suggestion.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
