import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Conversation } from "@/lib/models";
import { ensureTicketForConversation } from "@/lib/tickets";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!["open", "human", "closed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await connectToDatabase();
    
    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, tenantId: session.user.tenantId },
      { $set: { status } },
      { new: true }
    );

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (status === "human") {
      await ensureTicketForConversation({
        tenantId: session.user.tenantId,
        botId: conversation.botId.toString(),
        conversationId: conversation._id.toString(),
        triggerReason: "manual_human_handoff",
        category: "human_request",
        priority: "medium",
        source: "agent",
        metadata: { createdFrom: "conversation_status_change" },
      });
    }

    return NextResponse.json({ success: true, status: conversation.status });
  } catch (error) {
    console.error("Error updating conversation status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
