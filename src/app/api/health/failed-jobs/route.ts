import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FailedJob } from "@/lib/models";
import { requireAdmin } from "@/lib/authz";
import { safeJsonError, verifyBearerSecret } from "@/lib/api-security";

async function authorizeHealthCheck(request: Request) {
  if (process.env.HEALTHCHECK_SECRET && verifyBearerSecret(request, process.env.HEALTHCHECK_SECRET)) return;
  await requireAdmin();
}

export async function GET(request: Request) {
  try {
    await authorizeHealthCheck(request);
    await connectToDatabase();

    const [recent, count] = await Promise.all([
      FailedJob.find().sort({ failedAt: -1 }).limit(50).lean(),
      FailedJob.countDocuments()
    ]);

    return NextResponse.json({
      status: count > 0 ? "degraded" : "ok",
      count,
      recent: recent.map((job: any) => ({
        id: job._id.toString(),
        tenantId: job.tenantId?.toString(),
        queueName: job.queueName,
        jobName: job.jobName,
        jobId: job.jobId,
        provider: job.provider,
        conversationId: job.conversationId?.toString(),
        messageId: job.messageId?.toString(),
        reason: job.reason,
        attemptsMade: job.attemptsMade,
        failedAt: job.failedAt
      }))
    });
  } catch (error) {
    return safeJsonError(error, "Failed jobs health check unavailable.", 503);
  }
}
