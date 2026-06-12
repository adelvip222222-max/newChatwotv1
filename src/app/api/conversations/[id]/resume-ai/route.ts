import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Conversation } from "@/lib/models";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await connectToDatabase();

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, tenantId: session.user.tenantId },
      {
        $set: { mode: "ai", aiPaused: false },
        $unset: { aiPausedReason: "", aiPausedAt: "", handoffReason: "" }
      },
      { new: true }
    );

    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    return NextResponse.json({ ok: true, mode: conversation.mode, aiPaused: conversation.aiPaused });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
