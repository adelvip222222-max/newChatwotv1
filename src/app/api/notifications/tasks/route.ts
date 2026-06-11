import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Task } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    await connectToDatabase();

    const [tasks, openCount] = await Promise.all([
      Task.find({ tenantId: session.user.tenantId })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      Task.countDocuments({ tenantId: session.user.tenantId, status: { $ne: "closed" } })
    ]);

    return NextResponse.json({
      openCount,
      tasks: tasks.map((task) => ({
        id: task._id.toString(),
        conversationId: task.conversationId?.toString() || "",
        type: task.type,
        title: task.title,
        details: task.details || {},
        status: task.status,
        createdAt: task.createdAt?.toISOString() || new Date().toISOString()
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
