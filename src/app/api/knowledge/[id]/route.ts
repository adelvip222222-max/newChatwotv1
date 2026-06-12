import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { deleteKnowledgeDocument, getKnowledgeDocumentForEdit, updateKnowledgeDocument } from "@/lib/knowledge";

const patchSchema = z.object({
  title: z.string().trim().min(2).optional(),
  rawText: z.string().trim().min(10).optional(),
  sourceUrl: z.string().trim().optional(),
  tags: z.array(z.string()).optional()
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.knowledgeRead);
    const { id } = await params;
    const document = await getKnowledgeDocumentForEdit(id, session.user.tenantId);
    return NextResponse.json({ success: true, document });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load knowledge source.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.knowledgeManage);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const result = await updateKnowledgeDocument({ documentId: id, tenantId: session.user.tenantId, ...body });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update knowledge source.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.knowledgeManage);
    const { id } = await params;
    const result = await deleteKnowledgeDocument(id, session.user.tenantId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete knowledge source.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
