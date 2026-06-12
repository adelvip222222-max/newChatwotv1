import { NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { getKnowledgeDocumentStatus } from "@/lib/knowledge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.knowledgeRead);
    const { id } = await params;

    const status = await getKnowledgeDocumentStatus(id, session.user.tenantId);
    if (!status) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({
      status: status.status,
      statusReason: status.statusReason ?? null,
      chunkCount: status.chunkCount,
      embeddingCount: status.embeddingCount,
      needsRetraining: status.needsRetraining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to get document status.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
