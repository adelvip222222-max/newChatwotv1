import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Conversation, Message } from "@/lib/models";

const attachmentSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "audio", "file"]),
  key: z.string(),
  url: z.string().optional(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
});

const schema = z.object({
  content: z.string().optional().default(""),
  attachments: z.array(attachmentSchema).max(6).optional().default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = schema.parse(await request.json());
    const content = body.content.trim();
    const attachments = body.attachments;

    if (!content && !attachments.length) {
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
      content: content || "مرفق",
      attachments,
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
        attachments: message.attachments || [],
        createdAt: message.createdAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
