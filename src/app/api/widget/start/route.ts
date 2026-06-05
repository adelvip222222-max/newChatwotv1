import { NextResponse } from "next/server";
import { z } from "zod";
import { Bot, Conversation } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

const schema = z.object({
  botId: z.string().min(1),
  visitorId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const bot = await Bot.findOne({ _id: body.botId, isActive: true });
    if (!bot) {
      return NextResponse.json({ error: "البوت غير متاح." }, { status: 404 });
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        tenantId: bot.tenantId,
        botId: bot._id,
        channel: "website",
        externalUserId: body.visitorId
      },
      {
        $setOnInsert: {
          tenantId: bot.tenantId,
          botId: bot._id,
          channel: "website",
          externalUserId: body.visitorId,
          status: "open"
        }
      },
      { new: true, upsert: true }
    );

    const { KnowledgeDocument } = await import("@/lib/models");
    const docs = await KnowledgeDocument.find({ botId: bot._id, status: "ready" })
      .select("title")
      .limit(3)
      .lean();

    const suggestions = docs.map((doc) => {
      const title = doc.title.trim();
      if (title.startsWith("ما هي") || title.startsWith("كيف") || title.startsWith("هل")) return title;
      return `ما هي ${title}؟`;
    });

    if (suggestions.length === 0) {
      suggestions.push("ما هي الخدمات المتاحة؟", "كيف يمكنني التواصل معكم؟");
    }

    return NextResponse.json({
      conversationId: conversation._id.toString(),
      tenantId: bot.tenantId.toString(),
      bot: {
        id: bot._id.toString(),
        name: bot.name,
        avatar: bot.avatar
      },
      suggestions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر بدء المحادثة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
