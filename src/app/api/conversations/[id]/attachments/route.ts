import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Conversation } from "@/lib/models";
import { uploadConversationAttachment } from "@/lib/attachments";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    await connectToDatabase();
    const conversation = await Conversation.findOne({
      _id: id,
      tenantId: session.user.tenantId,
    }).lean();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const attachment = await uploadConversationAttachment({
      tenantId: session.user.tenantId,
      conversationId: conversation._id.toString(),
      file,
    });

    return NextResponse.json({ success: true, attachment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر رفع الملف.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

