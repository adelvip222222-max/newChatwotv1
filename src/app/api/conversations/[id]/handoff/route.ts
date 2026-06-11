import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Conversation } from "@/lib/models";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await connectToDatabase();

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, tenantId: session.user.tenantId },
      {
        $set: {
          mode: "human",
          aiPaused: true,
          aiPausedReason: body.reason || "manual_handoff",
          aiPausedAt: new Date(),
          handoffReason: body.reason || "manual_handoff",
          status: body.status === "pending" ? "pending" : "open"
        }
      },
      { new: true }
    );

    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    return NextResponse.json({ ok: true, mode: conversation.mode, status: conversation.status });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
