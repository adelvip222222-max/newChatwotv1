import { NextResponse } from "next/server";
import { isRealtimeAvailable, tenantRealtimeChannel } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const redisAvailable = await isRealtimeAvailable();
  const now = new Date().toISOString();

  return NextResponse.json(
    {
      ok: redisAvailable,
      service: "realtime",
      transport: "sse",
      redisPubSub: redisAvailable ? "healthy" : "unavailable",
      heartbeatMs: Number(process.env.REALTIME_HEARTBEAT_MS || 30_000),
      fallbackSyncMs: Number(process.env.REALTIME_FALLBACK_SYNC_MS || 60_000),
      maxConnectionsPerTenant: Number(process.env.REALTIME_MAX_CONNECTIONS_PER_TENANT || 200),
      channelPattern: tenantRealtimeChannel("<tenantId>"),
      ts: now,
    },
    { status: redisAvailable ? 200 : 503 }
  );
}
