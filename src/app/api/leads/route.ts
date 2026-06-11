import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Lead } from "@/lib/models";
import { requireAuth } from "@/server/auth/guards";

export async function GET(req: NextRequest) {
  let session: any;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  await connectToDatabase();
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "25")));
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = { tenantId: session.user.tenantId };
  const stage = searchParams.get("stage");
  if (stage) filter.stage = stage;
  const assignedTo = searchParams.get("assignedTo");
  if (assignedTo) filter.assignedTo = assignedTo;
  const q = searchParams.get("q");
  if (q?.trim()) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { company: { $regex: q, $options: "i" } }
    ];
  }

  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter)
  ]);

  return NextResponse.json({ leads, total, page, limit });
}

export async function POST(req: NextRequest) {
  let session: any;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  await connectToDatabase();
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Lead name is required." }, { status: 400 });
  }

  const lead = await Lead.create({
    tenantId: session.user.tenantId,
    contactId: body.contactId,
    conversationId: body.conversationId,
    stage: body.stage || "new",
    value: body.value || 0,
    currency: body.currency || "USD",
    assignedTo: body.assignedTo,
    sourceChannel: body.sourceChannel || "",
    tags: body.tags || [],
    customFields: body.customFields || {},
    dueAt: body.dueAt,
    name: body.name,
    email: body.email || "",
    phone: body.phone || "",
    company: body.company || "",
    interest: body.interest || "",
    notes: body.notes || "",
    score: body.score || 0
  });

  return NextResponse.json({ lead }, { status: 201 });
}
