import { NextResponse } from "next/server";
import { z } from "zod";
import { Conversation } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { uploadConversationAttachment } from "@/lib/attachments";

const fieldsSchema = z.object({
  tenantId: z.string().min(1),
  botId: z.string().min(1),
  conversationId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fields = fieldsSchema.parse({
      tenantId: formData.get("tenantId"),
      botId: formData.get("botId"),
      conversationId: formData.get("conversationId"),
    });
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    await connectToDatabase();
    const conversation = await Conversation.findOne({
      _id: fields.conversationId,
      tenantId: fields.tenantId,
      botId: fields.botId,
    }).lean();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const attachment = await uploadConversationAttachment({
      tenantId: fields.tenantId,
      conversationId: fields.conversationId,
      file,
    });

    return NextResponse.json({ success: true, attachment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر رفع الملف.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

