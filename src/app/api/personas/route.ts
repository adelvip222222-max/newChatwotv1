import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { AiPersona } from "@/lib/models/ai-persona";
import { z } from "zod";

const personaSchema = z.object({
  personaType: z.string().default("general"),
  roleName: z.string().min(2, "Role name is required"),
  description: z.string().optional(),

  systemPrompt: z.string().min(10, "System prompt is required"),
  greetingMessage: z.string().min(2, "Greeting message is required"),
  maxTurns: z.number().min(1).max(50).default(5),
  tone: z.string().default("professional"),
  responseStyle: z.string().default("balanced"),
  knowledgeMode: z.string().default("grounded"),
  handoffPolicy: z.string().default("when_needed"),
  channelScope: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([])
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await connectToDatabase();

    const personas = await AiPersona.find({ tenantId: session.user.tenantId, isActive: true })
      .lean();

    return NextResponse.json({ success: true, personas });
  } catch (error: any) {
    console.error("GET /api/personas error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    const parsed = personaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    await connectToDatabase();

    const persona = await AiPersona.create({
      tenantId: session.user.tenantId,
      ...parsed.data
    });

    return NextResponse.json({ success: true, persona }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/personas error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
