import { NextRequest, NextResponse } from "next/server";
import { Channel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { safeJsonError } from "@/lib/api-security";
import { enqueueInboundWebhook } from "@/server/channels/webhookIngress";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  await connectToDatabase();
  const channel = await Channel.findOne({
    type: "whatsapp",
    "config.verifyToken": token,
    isActive: true
  });

  if (!channel && token !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const result = await enqueueInboundWebhook({
      provider: "whatsapp",
      request,
      payload,
      rawBody
    });

    if (!result.ok) {
      const status = result.status || 400;
      return new NextResponse(result.error || "Bad Request", { status });
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    return safeJsonError(error, "Webhook processing failed.", 400);
  }
}
