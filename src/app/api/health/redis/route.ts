import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { formatRedisError } from "@/lib/redis-connection";
import { requireAdmin } from "@/lib/authz";
import { safeJsonError, verifyBearerSecret } from "@/lib/api-security";

async function authorizeHealthCheck(request: Request) {
  if (process.env.HEALTHCHECK_SECRET && verifyBearerSecret(request, process.env.HEALTHCHECK_SECRET)) {
    return;
  }
  await requireAdmin();
}

export async function GET(request: Request) {
  try {
    await authorizeHealthCheck(request);
    const result = await redis.ping();

    return NextResponse.json({
      status: result === "PONG" ? "ok" : "degraded",
      redis: result
    });
  } catch (error) {
    console.error("Redis health check failed:", formatRedisError(error));
    return safeJsonError(error, "Health check unavailable.", 503);
  }
}
