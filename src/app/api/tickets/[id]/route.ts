import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Ticket } from "@/lib/models";

const statuses = ["open", "pending", "resolved", "closed"];
const priorities = ["low", "medium", "high", "urgent"];
const categories = ["technical_support", "complaint", "human_request", "ai_failed", "general"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();

    const update: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!statuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      update.status = body.status;
    }

    if (body.priority !== undefined) {
      if (!priorities.includes(body.priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
      update.priority = body.priority;
    }

    if (body.category !== undefined) {
      if (!categories.includes(body.category)) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
      update.category = body.category;
    }

    if (body.subject !== undefined) update.subject = String(body.subject).trim();
    if (body.description !== undefined) update.description = String(body.description);
    if (body.aiSummary !== undefined) update.aiSummary = String(body.aiSummary);

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    await connectToDatabase();

    const ticket = await Ticket.findOneAndUpdate(
      { _id: id, tenantId: session.user.tenantId },
      { $set: update },
      { new: true }
    );

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket._id.toString(),
        number: ticket.number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        description: ticket.description,
        aiSummary: ticket.aiSummary,
      },
    });
  } catch (error) {
    console.error("tickets.update_failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

