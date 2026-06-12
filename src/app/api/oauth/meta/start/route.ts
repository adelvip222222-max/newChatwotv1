import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import {
  generateOAuthState,
  storeOAuthState,
  buildMetaOAuthUrl,
} from "@/lib/meta-oauth";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(permissions.settingsManage);

    const { searchParams } = new URL(request.url);
    const returnUrl = searchParams.get("returnUrl") || "/dashboard/channels";

    const appId = process.env.META_APP_ID;
    if (!appId) {
      return NextResponse.json(
        { error: "Meta OAuth is not configured on this platform." },
        { status: 503 }
      );
    }

    const redirectUri =
      process.env.OAUTH_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || ""}/api/oauth/meta`;

    const stateKey = generateOAuthState();
    await storeOAuthState(stateKey, {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      returnUrl,
      createdAt: Date.now(),
    });

    const oauthUrl = buildMetaOAuthUrl(stateKey, redirectUri);
    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth initiation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
