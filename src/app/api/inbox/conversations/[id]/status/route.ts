import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { updateInboxStatus } from "@/lib/inbox/service";

const schema = z.object({
  status: z.enum(["open", "pending", "resolved", "closed", "snoozed", "archived"])
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.inboxManage);
    const { id } = await params;
    const body = schema.parse(await request.json());

    const result = await updateInboxStatus({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: id,
      status: body.status
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update status.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
