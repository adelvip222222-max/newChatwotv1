import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Ticket } from "@/lib/models";
import { ensureTicketForConversation, type TicketCategory, type TicketPriority } from "@/lib/tickets";

export async function GET() {
  try {
    const session = await requireSession();
    await connectToDatabase();

    const tickets = await Ticket.find({ tenantId: session.user.tenantId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      tickets: tickets.map((ticket) => ({
        id: ticket._id.toString(),
        number: ticket.number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        conversationId: ticket.conversationId.toString(),
        requesterExternalId: ticket.requesterExternalId,
        channel: ticket.channel,
        updatedAt: ticket.updatedAt?.toISOString() || "",
      })),
    });
  } catch (error) {
    console.error("tickets.get_failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    if (!body.conversationId || !body.botId) {
      return NextResponse.json({ error: "conversationId and botId are required" }, { status: 400 });
    }

    const ticket = await ensureTicketForConversation({
      tenantId: session.user.tenantId,
      botId: body.botId,
      conversationId: body.conversationId,
      triggerReason: body.triggerReason || "manual_ticket",
      category: (body.category || "general") as TicketCategory,
      priority: (body.priority || "medium") as TicketPriority,
      subject: body.subject,
      description: body.description,
      source: "agent",
      metadata: { createdFrom: "dashboard" },
    });

    return NextResponse.json({
      success: true,
      ticket: ticket
        ? {
            id: ticket._id.toString(),
            number: ticket.number,
            subject: ticket.subject,
            status: ticket.status,
          }
        : null,
    });
  } catch (error) {
    console.error("tickets.create_failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

