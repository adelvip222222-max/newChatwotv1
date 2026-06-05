import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Conversation, Message } from "@/lib/models";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    await connectToDatabase();

    const conversation = await Conversation.findOne({
      _id: id,
      tenantId: session.user.tenantId,
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const message = await Message.create({
      tenantId: session.user.tenantId,
      botId: conversation.botId,
      conversationId: conversation._id,
      sender: "agent",
      content: content.trim(),
    });

    // If a human is replying, maybe we automatically set the conversation to human
    if (conversation.status === "open") {
      conversation.status = "human";
      await conversation.save();
    }

    return NextResponse.json({
      success: true,
      message: {
        id: message._id.toString(),
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
