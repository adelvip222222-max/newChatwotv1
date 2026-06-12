import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { safeJsonError, verifyBearerSecret } from "@/lib/api-security";
import { getQdrantHealth } from "@/lib/qdrant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authorizeHealthCheck(request: Request) {
  if (process.env.HEALTHCHECK_SECRET && verifyBearerSecret(request, process.env.HEALTHCHECK_SECRET)) return;
  await requireAdmin();
}

export async function GET(request: Request) {
  try {
    await authorizeHealthCheck(request);
    const health = await getQdrantHealth();
    return NextResponse.json(
      {
        status: health.status === "ok" || health.status === "disabled" ? "ok" : "degraded",
        qdrant: health
      },
      { status: health.status === "error" ? 503 : 200 }
    );
  } catch (error) {
    return safeJsonError(error, "Qdrant health check unavailable.", 503);
  }
}
