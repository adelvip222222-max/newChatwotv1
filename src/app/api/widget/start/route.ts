import { NextResponse } from "next/server";
import { z } from "zod";
import { Bot, Channel, ChannelIdentity, Contact, Conversation } from "@/lib/models";
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

    const channel = await Channel.findOneAndUpdate(
      {
        tenantId: bot.tenantId,
        botId: bot._id,
        type: "website"
      },
      {
        $setOnInsert: {
          tenantId: bot.tenantId,
          botId: bot._id,
          type: "website",
          name: `${bot.name} Website`,
          isActive: true
        }
      },
      { new: true, upsert: true }
    );

    let identity = await ChannelIdentity.findOne({
      tenantId: bot.tenantId,
      channelId: channel._id,
      provider: "website",
      externalUserId: body.visitorId
    });

    let contact = identity ? await Contact.findOne({ _id: identity.contactId, tenantId: bot.tenantId }) : null;

    if (!identity || !contact) {
      contact = await Contact.create({
        tenantId: bot.tenantId,
        name: "Website Visitor",
        lastSeenAt: new Date()
      });

      identity = await ChannelIdentity.create({
        tenantId: bot.tenantId,
        channelId: channel._id,
        contactId: contact._id,
        provider: "website",
        externalUserId: body.visitorId,
        displayName: "Website Visitor",
        lastSeenAt: new Date()
      });
    } else {
      identity.lastSeenAt = new Date();
      contact.lastSeenAt = new Date();
      await Promise.all([identity.save(), contact.save()]);
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        tenantId: bot.tenantId,
        botId: bot._id,
        channel: "website",
        externalUserId: body.visitorId,
        status: { $in: ["open", "snoozed"] }
      },
      {
        $set: {
          contactId: contact._id,
          channelIdentityId: identity._id,
          provider: "website"
        },
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

    const { KnowledgeDocument, AiPersona } = await import("@/lib/models");
    const docs = await KnowledgeDocument.find({ botId: bot._id, status: "ready" })
      .select("title")
      .limit(3)
      .lean();

    const suggestions = docs.map((doc: any) => {
      const title = doc.title.trim();
      if (title.startsWith("ما هي") || title.startsWith("كيف") || title.startsWith("هل")) return title;
      return `ما هي ${title}؟`;
    });

    if (suggestions.length === 0) {
      suggestions.push("ما هي الخدمات المتاحة؟", "كيف يمكنني التواصل معكم؟");
    }

    // Fetch dynamic AI personas (Employee bots)
    const personas = await AiPersona.find({ tenantId: bot.tenantId, isActive: true })
      .select("roleName greetingMessage description")
      .lean();

    return NextResponse.json({
      conversationId: conversation._id.toString(),
      tenantId: bot.tenantId.toString(),
      channelId: channel._id.toString(),
      bot: {
        id: bot._id.toString(),
        name: bot.name,
        avatar: bot.avatar
      },
      personas: personas.map((p: any) => ({
        id: p._id.toString(),
        roleName: p.roleName,
        greetingMessage: p.greetingMessage,
        description: p.description
      })),
      suggestions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر بدء المحادثة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
