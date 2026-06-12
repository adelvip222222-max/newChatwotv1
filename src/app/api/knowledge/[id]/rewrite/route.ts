import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { rewriteKnowledgeDocumentWithAi } from "@/lib/knowledge";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.knowledgeManage);
    const { id } = await params;
    const result = await rewriteKnowledgeDocumentWithAi(id, session.user.tenantId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rewrite knowledge source.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
