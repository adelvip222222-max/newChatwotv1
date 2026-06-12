import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { updateInboxStatus } from "@/lib/inbox/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.inboxManage);
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!["open", "pending", "resolved", "closed", "snoozed", "archived"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await updateInboxStatus({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: id,
      status
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating conversation status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
