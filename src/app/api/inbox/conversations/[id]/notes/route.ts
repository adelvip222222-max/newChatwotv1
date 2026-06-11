import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { createInboxNote } from "@/lib/inbox/service";

const schema = z.object({
  content: z.string().trim().min(1),
  visibility: z.enum(["internal", "team"]).optional(),
  mentions: z.array(z.string()).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.inboxReply);
    const { id } = await params;
    const body = schema.parse(await request.json());

    const note = await createInboxNote({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: id,
      content: body.content,
      visibility: body.visibility,
      mentions: body.mentions
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add note.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
