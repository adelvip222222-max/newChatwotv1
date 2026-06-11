import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guards";
import { AiModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { encryptSecret } from "@/lib/crypto";

const PROVIDERS = ["openai", "openai-compatible", "google-gemini"] as const;

const schema = z.object({
  name:     z.string().min(2),
  provider: z.enum(PROVIDERS),
  model:    z.string().min(1),
  baseUrl:  z.string().optional(),
  apiKey:   z.string().optional(), // raw key — will be encrypted before storage
  isDefault: z.boolean().optional(),
  isActive:  z.boolean().optional(),
});

function normalizeBaseUrl(provider: string, baseUrl?: string) {
  if (!baseUrl?.trim() || provider === "openai" || provider === "google-gemini") return "";
  const url = new URL(baseUrl.trim());
  if (url.protocol !== "https:") throw new Error("Base URL يجب أن يستخدم HTTPS.");
  return url.toString().replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();

    if (body.isDefault) {
      await AiModel.updateMany(
        { tenantId: session.user.tenantId },
        { $set: { isDefault: false } }
      );
    }

    const aiModel = await AiModel.create({
      tenantId:        session.user.tenantId,
      name:            body.name,
      provider:        body.provider,
      model:           body.model,
      apiKeyEncrypted: body.apiKey ? encryptSecret(body.apiKey) : "",
      baseUrl:         normalizeBaseUrl(body.provider, body.baseUrl),
      isDefault:       body.isDefault ?? false,
      isActive:        body.isActive ?? true,
    });

    return NextResponse.json({ id: aiModel._id.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ نموذج AI.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
