import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { retrainAllKnowledge, trainKnowledgeDocument } from "@/lib/knowledge";

const schema = z.object({
  documentId: z.string().optional(),
  botId: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requirePermission(permissions.knowledgeManage);
    const body = schema.parse(await request.json().catch(() => ({})));
    if (body.documentId) {
      await trainKnowledgeDocument(body.documentId, session.user.tenantId);
      return NextResponse.json({ count: 1 });
    }
    const count = await retrainAllKnowledge(session.user.tenantId, body.botId);
    return NextResponse.json({ count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إعادة تدريب المعرفة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
