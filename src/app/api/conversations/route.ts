import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listConversationsForTenant } from "@/lib/conversations-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    // NOTE: This endpoint is deprecated. Use /api/inbox/conversations instead.
    const { searchParams } = new URL(request.url);

    const data = await listConversationsForTenant(session.user.tenantId, {
      limit: Number(searchParams.get("limit") || 20),
      offset: Number(searchParams.get("offset") || 0),
      q: searchParams.get("q") || "",
      status: searchParams.get("status") || "all",
      mode: searchParams.get("mode") || "all",
      priority: searchParams.get("priority") || "all",
      unreadOnly: searchParams.get("unread") === "1",
    });

    const response = NextResponse.json(data);
    response.headers.set("Deprecation", "true");
    response.headers.set("Link", "</api/inbox/conversations>; rel=\"successor-version\"");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
