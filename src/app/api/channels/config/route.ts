import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { Bot, Channel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { encryptSecret } from "@/lib/crypto";

const schema = z.object({
  botId: z.string().min(1),
  type: z.enum(["website", "telegram", "whatsapp", "facebook", "webhook"]),
  name: z.string().min(2),
  isActive: z.boolean(),
  config: z.record(z.unknown()).default({})
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const bot = await Bot.findOne({ _id: body.botId, tenantId: session.user.tenantId });
    if (!bot) return NextResponse.json({ error: "البوت غير موجود." }, { status: 404 });

    const existing = await Channel.findOne({
      tenantId: session.user.tenantId,
      botId: body.botId,
      type: body.type
    });
    const config = { ...body.config } as Record<string, unknown>;

    if (body.type === "telegram") {
      const token = String(config.botToken || "").trim();
      delete config.botToken;

      if (token) {
        if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
          return NextResponse.json({ error: "توكن Telegram غير صالح." }, { status: 400 });
        }
        config.botTokenEncrypted = encryptSecret(token);
        config.tokenConfigured = true;
      } else if (existing?.config && typeof existing.config === "object") {
        const previousConfig = existing.config as Record<string, unknown>;
        if (previousConfig.botTokenEncrypted) {
          config.botTokenEncrypted = previousConfig.botTokenEncrypted;
          config.tokenConfigured = true;
        }
      }

      const previousConfig =
        existing?.config && typeof existing.config === "object"
          ? (existing.config as Record<string, unknown>)
          : {};
      config.webhookSecret = String(config.webhookSecret || previousConfig.webhookSecret || crypto.randomBytes(24).toString("hex"));
      if (config.publicBaseUrl) {
        config.publicBaseUrl = String(config.publicBaseUrl).trim().replace(/\/+$/, "");
      }
      if (previousConfig.webhookUrl) config.webhookUrl = previousConfig.webhookUrl;
      if (previousConfig.webhookSetAt) config.webhookSetAt = previousConfig.webhookSetAt;
    }

    if (body.type === "whatsapp") {
      const token = String(config.accessToken || "").trim();
      delete config.accessToken;
      const previousConfig =
        existing?.config && typeof existing.config === "object"
          ? (existing.config as Record<string, unknown>)
          : {};
      if (token) {
        config.accessTokenEncrypted = encryptSecret(token);
        config.tokenConfigured = true;
      } else if (previousConfig.accessTokenEncrypted) {
        config.accessTokenEncrypted = previousConfig.accessTokenEncrypted;
        config.tokenConfigured = true;
      }
      config.phoneNumberId = String(config.phoneNumberId || previousConfig.phoneNumberId || "").trim();
      config.verifyToken = String(config.verifyToken || previousConfig.verifyToken || crypto.randomBytes(18).toString("hex")).trim();
    }

    if (body.type === "facebook") {
      const token = String(config.pageAccessToken || "").trim();
      delete config.pageAccessToken;
      const previousConfig =
        existing?.config && typeof existing.config === "object"
          ? (existing.config as Record<string, unknown>)
          : {};
      if (token) {
        config.pageAccessTokenEncrypted = encryptSecret(token);
        config.tokenConfigured = true;
      } else if (previousConfig.pageAccessTokenEncrypted) {
        config.pageAccessTokenEncrypted = previousConfig.pageAccessTokenEncrypted;
        config.tokenConfigured = true;
      }
      config.pageId = String(config.pageId || previousConfig.pageId || "").trim();
      config.verifyToken = String(config.verifyToken || previousConfig.verifyToken || crypto.randomBytes(18).toString("hex")).trim();
    }

    await Channel.findOneAndUpdate(
      { tenantId: session.user.tenantId, botId: body.botId, type: body.type },
      {
        $set: {
          tenantId: session.user.tenantId,
          botId: body.botId,
          type: body.type,
          name: body.name,
          config,
          isActive: body.isActive
        }
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ القناة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
