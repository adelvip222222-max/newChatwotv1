import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guards";
import { restartManagedServices } from "@/lib/developer/operations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const restartSchema = z.object({
  target: z.enum(["web", "workers", "all"]),
  confirmation: z.literal("RESTART")
});

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = restartSchema.parse(await request.json());
    const result = await restartManagedServices(body.target);
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to restart services.";
    const status = message.toLowerCase().includes("super-admin") || message.toLowerCase().includes("authentication") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
