import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { requireAdmin } from "@/lib/authz";
import { safeJsonError, verifyBearerSecret } from "@/lib/api-security";

const workers = [
  "worker-ingress",
  "worker-core-routing",
  "worker-ai",
  "worker-egress",
  "worker-outbound",
  "worker-knowledge"
];

async function authorizeHealthCheck(request: Request) {
  if (process.env.HEALTHCHECK_SECRET && verifyBearerSecret(request, process.env.HEALTHCHECK_SECRET)) return;
  await requireAdmin();
}

export async function GET(request: Request) {
  try {
    await authorizeHealthCheck(request);

    const results = await Promise.all(
      workers.map(async (name) => {
        const heartbeat = await redis.get(`worker:heartbeat:${name}`);
        return {
          name,
          status: heartbeat ? "ok" : "missing",
          heartbeat
        };
      })
    );

    return NextResponse.json({
      status: results.every((worker) => worker.status === "ok") ? "ok" : "degraded",
      workers: results
    });
  } catch (error) {
    return safeJsonError(error, "Worker health check unavailable.", 503);
  }
}
