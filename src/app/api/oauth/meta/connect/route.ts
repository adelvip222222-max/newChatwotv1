import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import {
  consumePagesSession,
  createFacebookChannel,
  createInstagramChannel,
} from "@/lib/meta-oauth";
import crypto from "crypto";

const schema = z.object({
  session: z.string().min(1),
  pageId: z.string().min(1),
  type: z.enum(["facebook", "instagram"]),
  instagramBusinessId: z.string().optional(),
  botId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(permissions.settingsManage);
    const body = schema.parse(await request.json());

    const pagesSession = await consumePagesSession(body.session);
    if (!pagesSession) {
      return NextResponse.json({ error: "OAuth session not found or expired. Please reconnect." }, { status: 404 });
    }

    if (pagesSession.tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Session does not belong to your account." }, { status: 403 });
    }

    const page = pagesSession.pages.find((p) => p.pageId === body.pageId);
    if (!page) {
      return NextResponse.json({ error: "Page not found in this OAuth session." }, { status: 404 });
    }

    const verifyToken = crypto.randomBytes(24).toString("hex");

    if (body.type === "instagram") {
      if (!body.instagramBusinessId) {
        return NextResponse.json({ error: "instagramBusinessId is required for Instagram channels." }, { status: 400 });
      }
      const instagram = page.instagramAccounts.find(
        (ig) => ig.instagramBusinessId === body.instagramBusinessId
      );
      if (!instagram) {
        return NextResponse.json({ error: "Instagram account not linked to this page." }, { status: 404 });
      }

      const result = await createInstagramChannel({
        tenantId: pagesSession.tenantId,
        botId: body.botId,
        page,
        instagram,
        verifyToken,
      });

      return NextResponse.json({
        channelId: result.channelId,
        type: "instagram",
        webhookStatus: result.webhookStatus,
        message:
          result.webhookStatus === "subscribed"
            ? "Instagram channel connected successfully."
            : "Instagram channel created but webhook subscription failed. Check app permissions.",
      });
    }

    const result = await createFacebookChannel({
      tenantId: pagesSession.tenantId,
      botId: body.botId,
      page,
      verifyToken,
    });

    return NextResponse.json({
      channelId: result.channelId,
      type: "facebook",
      webhookStatus: result.webhookStatus,
      message:
        result.webhookStatus === "subscribed"
          ? "Facebook channel connected successfully."
          : "Facebook channel created but webhook subscription failed. Check app permissions.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect channel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
