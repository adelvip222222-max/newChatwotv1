import { NextResponse } from "next/server";
import { aiProcessingQueue, coreRoutingQueue, egressQueue, ingressQueue } from "@/lib/queues";
import { outboundQueue } from "@/server/channels/outboundQueue";
import { requireAdmin } from "@/lib/authz";
import { safeJsonError, verifyBearerSecret } from "@/lib/api-security";

async function authorizeHealthCheck(request: Request) {
  if (process.env.HEALTHCHECK_SECRET && verifyBearerSecret(request, process.env.HEALTHCHECK_SECRET)) return;
  await requireAdmin();
}

export async function GET(request: Request) {
  try {
    await authorizeHealthCheck(request);

    const queues = [ingressQueue, coreRoutingQueue, aiProcessingQueue, egressQueue, outboundQueue];
    const statuses = await Promise.all(
      queues.map(async (queue) => ({
        name: queue.name,
        counts: await queue.getJobCounts("waiting", "active", "delayed", "completed", "failed", "paused")
      }))
    );

    const failed = statuses.reduce((sum, queue) => sum + (queue.counts.failed || 0), 0);
    return NextResponse.json({
      status: failed > 0 ? "degraded" : "ok",
      queues: statuses
    });
  } catch (error) {
    return safeJsonError(error, "Queue health check unavailable.", 503);
  }
}
