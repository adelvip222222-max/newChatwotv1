import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Conversation, User } from "@/lib/models";

const schema = z.object({
  assigneeId: z.string().min(1).optional(),
  assignedAgentId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  assignedTeamId: z.string().min(1).optional()
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = schema.parse(await request.json());
    const assigneeId = body.assigneeId || body.assignedAgentId;
    const teamId = body.teamId || body.assignedTeamId;

    await connectToDatabase();

    if (assigneeId) {
      const user = await User.findOne({ _id: assigneeId, tenantId: session.user.tenantId, isActive: true });
      if (!user) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, tenantId: session.user.tenantId },
      {
        $set: {
          ...(assigneeId ? { assigneeId, assignedAgentId: assigneeId } : {}),
          ...(teamId ? { teamId, assignedTeamId: teamId } : {}),
          assignedAt: new Date(),
          assignedBy: session.user.id
        }
      },
      { new: true }
    );

    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      assigneeId: conversation.assigneeId?.toString(),
      teamId: conversation.teamId?.toString(),
      assignedAt: conversation.assignedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
