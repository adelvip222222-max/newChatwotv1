import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { rewriteDraft } from "@/lib/inbox/ai-copilot";

const schema = z.object({
  draft: z.string().trim().min(1),
  mode: z.enum(["improve", "professional", "shorten", "expand", "translate"]).default("improve")
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(permissions.aiRead);
    const { id } = await params;
    const body = schema.parse(await request.json());

    const text = await rewriteDraft({
      tenantId: session.user.tenantId,
      conversationId: id,
      draft: body.draft,
      mode: body.mode
    });

    return NextResponse.json({ success: true, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rewrite draft.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
