import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guards";
import { AiProvider } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { encryptSecret } from "@/lib/crypto";

const schema = z.object({
  providerId: z.enum(["openai", "anthropic", "gemini", "openrouter", "deepseek", "xai", "groq", "ollama"]),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  isActive: z.boolean(),
  isDefault: z.boolean().optional(),
  priority: z.number().optional()
});

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const providerNames: Record<string, string> = {
      "openai": "OpenAI",
      "anthropic": "Anthropic",
      "gemini": "Google Gemini",
      "openrouter": "OpenRouter",
      "deepseek": "DeepSeek",
      "xai": "xAI (Grok)",
      "groq": "Groq",
      "ollama": "Ollama"
    };

    const existing = await AiProvider.findOne({ providerId: body.providerId });
    
    // If setting as default, unset others
    if (body.isDefault) {
      await AiProvider.updateMany({}, { $set: { isDefault: false } });
    }

    const updateData: any = {
      name: providerNames[body.providerId] || body.providerId,
      isActive: body.isActive,
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.baseUrl !== undefined && { baseUrl: body.baseUrl })
    };

    if (body.apiKey && body.apiKey.trim().length > 0) {
      updateData.apiKeyEncrypted = encryptSecret(body.apiKey.trim());
    }

    if (existing) {
      await AiProvider.updateOne({ _id: existing._id }, { $set: updateData });
    } else {
      await AiProvider.create({
        providerId: body.providerId,
        ...updateData
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("AI Provider Setup Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر حفظ إعدادات المزود." },
      { status: 400 }
    );
  }
}
