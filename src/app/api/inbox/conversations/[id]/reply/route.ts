import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { sendInboxReply } from "@/lib/inbox/service";

const schema = z.object({
  content: z.string().trim().min(1),
  attachments: z.array(z.any()).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.inboxReply);
    const { id } = await params;
    const body = schema.parse(await request.json());

    const message = await sendInboxReply({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: id,
      content: body.content,
      attachments: body.attachments || []
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send reply.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
