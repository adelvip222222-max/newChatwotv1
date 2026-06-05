import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { createKnowledgeDocument, knowledgeSourceTypes } from "@/lib/knowledge";

const sourceTypesArray = [
  "pdf", "docx", "txt", "csv", "excel", "faq", "website", "html", 
  "product_catalog", "services_catalog", "policies", "terms", 
  "pricing", "manual", "support_article", "custom_text"
] as const;

const schema = z.object({
  botId: z.string().min(1),
  title: z.string().min(2),
  sourceType: z.enum(sourceTypesArray),
  categoryName: z.string().min(2),
  collectionName: z.string().min(1),
  tags: z.string().optional(),
  text: z.string().optional(),
  sourceUrl: z.string().optional(),
  isTemporary: z.string().optional(),
  expiresDays: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const form = await request.formData();
    const fileValue = form.get("file");
    const body = schema.parse({
      botId: form.get("botId"),
      title: form.get("title"),
      sourceType: form.get("sourceType"),
      categoryName: form.get("categoryName"),
      collectionName: form.get("collectionName"),
      tags: form.get("tags") || "",
      text: form.get("text") || "",
      sourceUrl: form.get("sourceUrl") || "",
      isTemporary: form.get("isTemporary") || "",
      expiresDays: form.get("expiresDays") || ""
    });
    const isTemporary = body.isTemporary === "true" || body.isTemporary === "on";
    const expiresDays = Math.max(1, Math.min(365, Number(body.expiresDays || 7)));

    const file = fileValue instanceof File && fileValue.size > 0
      ? {
          name: fileValue.name,
          type: fileValue.type,
          size: fileValue.size,
          buffer: Buffer.from(await fileValue.arrayBuffer())
        }
      : undefined;

    const id = await createKnowledgeDocument({
      tenantId: session.user.tenantId,
      botId: body.botId,
      title: body.title,
      sourceType: body.sourceType,
      categoryName: body.categoryName,
      collectionName: body.collectionName,
      tags: body.tags?.split(",") || [],
      text: body.text,
      sourceUrl: body.sourceUrl,
      isTemporary,
      expiresAt: isTemporary ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : undefined,
      file
    });

    return NextResponse.json({ id });
  } catch (error) {
    console.error("KNOWLEDGE API ERROR:", error);
    const message = error instanceof Error ? error.message : "تعذر حفظ مصدر المعرفة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
