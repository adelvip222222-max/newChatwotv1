import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { getPagesSession } from "@/lib/meta-oauth";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(permissions.settingsManage);

    const { searchParams } = new URL(request.url);
    const sessionKey = searchParams.get("session");
    if (!sessionKey) {
      return NextResponse.json({ error: "Missing session parameter." }, { status: 400 });
    }

    const pagesSession = await getPagesSession(sessionKey);
    if (!pagesSession) {
      return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
    }

    if (pagesSession.tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Session does not belong to your account." }, { status: 403 });
    }

    const safePages = pagesSession.pages.map((page) => ({
      pageId: page.pageId,
      name: page.name,
      category: page.category,
      tasks: page.tasks,
      instagramAccounts: page.instagramAccounts.map((ig) => ({
        instagramBusinessId: ig.instagramBusinessId,
        username: ig.username,
        name: ig.name,
      })),
    }));

    return NextResponse.json({ pages: safePages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch pages.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
