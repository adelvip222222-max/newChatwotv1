import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { updateInboxAssignment } from "@/lib/inbox/service";

const schema = z.object({
  agentId: z.string().optional(),
  teamId: z.string().optional()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.inboxAssign);
    const { id } = await params;
    const body = schema.parse(await request.json());

    await updateInboxAssignment({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: id,
      agentId: body.agentId,
      teamId: body.teamId
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update assignment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
