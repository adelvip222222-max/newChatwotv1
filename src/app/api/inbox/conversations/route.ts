import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { getInboxConversations } from "@/lib/inbox/service";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(permissions.inboxRead);
    const searchParams = request.nextUrl.searchParams;

    const result = await getInboxConversations({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      filters: {
        view: searchParams.get("view") || "inbox",
        q: searchParams.get("q") || "",
        channel: searchParams.get("channel") || "",
        agent: searchParams.get("agent") || "",
        team: searchParams.get("team") || "",
        status: searchParams.get("status") || "",
        priority: searchParams.get("priority") || "",
        tags: searchParams.get("tags") || "",
        from: searchParams.get("from") || "",
        to: searchParams.get("to") || "",
        cursor: searchParams.get("cursor") || "",
        limit: Number(searchParams.get("limit") || 40)
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load inbox.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
