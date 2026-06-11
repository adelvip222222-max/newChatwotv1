import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Lead } from "@/lib/models";
import { requireAuth } from "@/server/auth/guards";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  let session: any;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  await connectToDatabase();
  const lead = await Lead.findOne({ _id: id, tenantId: session.user.tenantId }).lean();
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  let session: any;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  await connectToDatabase();
  const body = await req.json();
  const allowedFields = ["stage","value","currency","assignedTo","sourceChannel","tags","customFields","dueAt","closedAt","name","email","phone","company","interest","notes","score"];
  const updates: Record<string, any> = {};
  for (const key of allowedFields) { if (key in body) updates[key] = body[key]; }
  if (body.stage === "won" || body.stage === "lost") updates.closedAt = new Date();
  const lead = await Lead.findOneAndUpdate({ _id: id, tenantId: session.user.tenantId }, { $set: updates }, { new: true });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  let session: any;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  await connectToDatabase();
  const lead = await Lead.findOneAndDelete({ _id: id, tenantId: session.user.tenantId });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
