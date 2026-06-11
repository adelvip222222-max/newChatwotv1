import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guards";
import { encryptSecret } from "@/lib/crypto";
import { AiModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

const schema = z.object({
  name: z.string().min(2).optional(),
  provider: z.enum(["openai", "openai-compatible"]).optional(),
  model: z.string().min(2).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});

function normalizeBaseUrl(provider?: string, baseUrl?: string) {
  if (baseUrl === undefined) return undefined;
  const value = baseUrl.trim();
  if (!value || provider === "openai") return "";
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Base URL يجب أن يستخدم HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdmin();
    const { id } = await params;
    const body = schema.parse(await request.json());
    await connectToDatabase();

    if (body.isDefault) {
      await AiModel.updateMany({ tenantId: session.user.tenantId }, { $set: { isDefault: false } });
    }

    const update: Record<string, unknown> = { ...body };
    if (body.apiKey?.trim()) {
      update.apiKeyEncrypted = encryptSecret(body.apiKey.trim());
    }
    const normalizedBaseUrl = normalizeBaseUrl(body.provider, body.baseUrl);
    if (normalizedBaseUrl !== undefined) {
      update.baseUrl = normalizedBaseUrl;
    }
    delete update.apiKey;

    const model = await AiModel.findOneAndUpdate(
      { _id: id, tenantId: session.user.tenantId },
      { $set: update },
      { new: true }
    );

    if (!model) return NextResponse.json({ error: "نموذج AI غير موجود." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث نموذج AI.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
