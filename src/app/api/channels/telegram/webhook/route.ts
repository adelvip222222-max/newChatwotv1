import { NextRequest, NextResponse } from "next/server";
import { enqueueInboundWebhook } from "@/server/channels/webhookIngress";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Telegram webhooks don't send the channelId in the URL by default unless configured.
    // They do send X-Telegram-Bot-Api-Secret-Token which our adapter verifies and we can use to find the channel.
    // We pass the request to the central pipeline.

    const result = await enqueueInboundWebhook({
      provider: "telegram",
      request,
      payload
    });

    if (!result.ok) {
      console.error("Telegram webhook error:", result.error);
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook internal error:", error);
    // Always return 200 to telegram to prevent retries if it's our internal error that can't be fixed by retrying
    return NextResponse.json({ ok: true, error: "Internal error handled" });
  }
}
