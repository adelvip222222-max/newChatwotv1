import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  consumeOAuthState,
  exchangeCodeForToken,
  fetchMetaPages,
  storePagesSession,
} from "@/lib/meta-oauth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateKey = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = process.env.NEXTAUTH_URL || "";

  if (error) {
    logger.warn("meta_oauth.callback_user_denied", { error, errorDescription });
    const redirectUrl = new URL(`${baseUrl}/dashboard/channels`);
    redirectUrl.searchParams.set("oauth_error", error);
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (!code || !stateKey) {
    return renderError("Missing authorization code or state parameter.", `${baseUrl}/dashboard/channels`);
  }

  const state = await consumeOAuthState(stateKey);
  if (!state) {
    return renderError("OAuth state is invalid or expired. Please try again.", `${baseUrl}/dashboard/channels`);
  }

  const stateAgeMs = Date.now() - state.createdAt;
  if (stateAgeMs > 10 * 60 * 1000) {
    return renderError("OAuth session expired. Please start again.", `${baseUrl}${state.returnUrl}`);
  }

  try {
    const redirectUri =
      process.env.OAUTH_REDIRECT_URI ||
      `${baseUrl}/api/oauth/meta`;

    const userAccessToken = await exchangeCodeForToken(code, redirectUri);
    const pages = await fetchMetaPages(userAccessToken);

    const sessionKey = crypto.randomBytes(24).toString("hex");
    await storePagesSession(sessionKey, {
      tenantId: state.tenantId,
      userId: state.userId,
      returnUrl: state.returnUrl,
      pages,
    });

    const redirectUrl = new URL(`${baseUrl}/dashboard/channels/meta-connect`);
    redirectUrl.searchParams.set("session", sessionKey);

    logger.info("meta_oauth.callback_success", {
      tenantId: state.tenantId,
      pageCount: pages.length,
    });

    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth callback failed.";
    logger.error("meta_oauth.callback_error", {
      tenantId: state.tenantId,
      error: message,
    });
    return renderError(message, `${baseUrl}${state.returnUrl}`);
  }
}

function renderError(message: string, backUrl: string) {
  const encodedMessage = encodeURIComponent(message);
  const redirectUrl = new URL(backUrl);
  redirectUrl.searchParams.set("oauth_error", encodedMessage);
  return NextResponse.redirect(redirectUrl.toString());
}
