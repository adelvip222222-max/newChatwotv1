import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/server/auth/guards";
import { getDeveloperMetrics } from "@/lib/developer/operations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSuperAdmin();
    const metrics = await getDeveloperMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read developer metrics.";
    const status = message.toLowerCase().includes("super-admin") || message.toLowerCase().includes("authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
