import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { deleteInboxConversation, getConversationDetail, markConversationRead } from "@/lib/inbox/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.inboxRead);
    const { id } = await params;
    const forceAi = request.nextUrl.searchParams.get("forceAi") === "1";

    const detail = await getConversationDetail({
      tenantId: session.user.tenantId,
      conversationId: id,
      forceAi
    });

    await markConversationRead({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: id
    }).catch(() => undefined);

    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load conversation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.inboxManage);
    const { id } = await params;
    const result = await deleteInboxConversation({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: id
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete conversation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
