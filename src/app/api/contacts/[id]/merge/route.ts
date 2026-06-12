import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { mergeContacts } from "@/server/channels/merge";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const { targetContactId } = body;

    if (!targetContactId) {
      return NextResponse.json({ error: "targetContactId is required" }, { status: 400 });
    }

    await connectToDatabase();

    const merged = await mergeContacts(id, targetContactId, session.user.tenantId);

    return NextResponse.json({ success: true, contact: merged });
  } catch (error: any) {
    console.error("Merge error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
