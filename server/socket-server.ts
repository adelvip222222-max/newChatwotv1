import http from "http";
import { getToken } from "next-auth/jwt";
import { Server, type Socket } from "socket.io";
import { connectToDatabase } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { User } from "@/lib/models";
import { createRedisConnection } from "@/lib/redis-connection";
import { normalizeRealtimeEventType } from "@/lib/realtime/events";
import type { RealtimeEnvelope } from "@/lib/realtime/types";
import { permissions } from "@/server/permissions/permissions";
import { roleHasPermission } from "@/server/permissions/roles";

type SocketAuthData = {
  userId: string;
  tenantId: string;
  role: string;
  isSuperAdmin: boolean;
};

type LooseRealtimeEnvelope = Partial<RealtimeEnvelope> & {
  data?: unknown;
  payload?: unknown;
};

const PORT = Number(process.env.SOCKET_IO_PORT || process.env.REALTIME_SOCKET_PORT || 4001);
const PATH = process.env.SOCKET_IO_PATH || "/socket.io";
const MAX_CONNECTIONS_PER_TENANT = Number(process.env.SOCKET_IO_MAX_CONNECTIONS_PER_TENANT || 500);
const HEARTBEAT_MS = Number(process.env.SOCKET_IO_HEARTBEAT_MS || 30_000);
const CHANNEL_PATTERN = "inbox:*:events";
const EVENT_ID_RANDOM_BASE = 36;

const activeConnectionsByTenant = new Map<string, number>();
const httpServer = http.createServer((request, response) => {
  if (request.url === "/health" || request.url === "/socket-health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        ok: true,
        service: "chatzi-socket-io",
        transport: "socket.io",
        path: PATH,
        port: PORT,
        activeTenants: activeConnectionsByTenant.size,
        activeConnections: Array.from(activeConnectionsByTenant.values()).reduce((sum, value) => sum + value, 0),
        ts: new Date().toISOString(),
      })
    );
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: false, error: "not_found" }));
});

const io = new Server(httpServer, {
  path: PATH,
  serveClient: false,
  transports: ["websocket", "polling"],
  cors: {
    origin: process.env.NEXTAUTH_URL || true,
    credentials: true,
  },
});

function tenantRoom(tenantId: string) {
  return `tenant:${tenantId}`;
}

function incrementTenantConnection(tenantId: string) {
  const count = activeConnectionsByTenant.get(tenantId) || 0;
  if (count >= MAX_CONNECTIONS_PER_TENANT) return false;
  activeConnectionsByTenant.set(tenantId, count + 1);
  return true;
}

function decrementTenantConnection(tenantId: string) {
  const count = activeConnectionsByTenant.get(tenantId) || 0;
  if (count <= 1) activeConnectionsByTenant.delete(tenantId);
  else activeConnectionsByTenant.set(tenantId, count - 1);
}

function extractTenantIdFromRedisChannel(channel: string) {
  const match = /^inbox:([^:]+):events$/.exec(channel);
  return match?.[1] || "";
}

function normalizeRedisEnvelope(rawMessage: string): RealtimeEnvelope {
  const parsed = JSON.parse(rawMessage) as LooseRealtimeEnvelope;
  const type = normalizeRealtimeEventType((parsed.type || "sync.required") as any);

  return {
    id: parsed.id || `${Date.now()}-${Math.random().toString(EVENT_ID_RANDOM_BASE).slice(2, 10)}`,
    type,
    payload: Object.prototype.hasOwnProperty.call(parsed, "payload") ? parsed.payload : parsed.data,
    ts: parsed.ts || new Date().toISOString(),
  };
}

async function authenticateSocket(socket: Socket): Promise<SocketAuthData> {
  const token = (await getToken({
    req: socket.request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })) as any;

  const userId = String(token?.id || token?.sub || "");
  const tenantId = String(token?.tenantId || "");

  if (!userId || !tenantId) {
    throw new Error("Authentication is required.");
  }

  await connectToDatabase();
  const user = await User.findOne({ _id: userId, tenantId, isActive: true })
    .select("role isSuperAdmin tenantId isActive")
    .lean();

  const role = String((user as any)?.role || token?.role || "");
  const isSuperAdmin = (user as any)?.isSuperAdmin === true || role === "super-admin";

  if (!user || !roleHasPermission(role, permissions.inboxRead)) {
    throw new Error("Inbox realtime access is not allowed.");
  }

  return { userId, tenantId, role, isSuperAdmin };
}

io.use(async (socket, next) => {
  try {
    const auth = await authenticateSocket(socket);
    if (!incrementTenantConnection(auth.tenantId)) {
      return next(new Error("Too many realtime connections for this tenant."));
    }
    socket.data.auth = auth;
    next();
  } catch (error) {
    logger.warn("socket.auth_failed", {
      error: error instanceof Error ? error.message : "unknown",
      address: socket.handshake.address,
    });
    next(error instanceof Error ? error : new Error("Socket authentication failed."));
  }
});

io.on("connection", (socket) => {
  const auth = socket.data.auth as SocketAuthData | undefined;
  if (!auth?.tenantId) {
    socket.disconnect(true);
    return;
  }

  const room = tenantRoom(auth.tenantId);
  socket.join(room);

  logger.info("socket.connected", {
    socketId: socket.id,
    userId: auth.userId,
    tenantId: auth.tenantId,
    role: auth.role,
    activeConnections: activeConnectionsByTenant.get(auth.tenantId) || 0,
  });

  socket.emit("ready", {
    ok: true,
    transport: "socket.io",
    tenantScoped: true,
    socketId: socket.id,
    activeConnections: activeConnectionsByTenant.get(auth.tenantId) || 0,
    ts: new Date().toISOString(),
  });

  const heartbeat = setInterval(() => {
    socket.emit("heartbeat", { transport: "socket.io", ts: new Date().toISOString() });
  }, HEARTBEAT_MS);

  socket.on("disconnect", (reason) => {
    clearInterval(heartbeat);
    decrementTenantConnection(auth.tenantId);
    logger.info("socket.disconnected", {
      socketId: socket.id,
      userId: auth.userId,
      tenantId: auth.tenantId,
      reason,
      activeConnections: activeConnectionsByTenant.get(auth.tenantId) || 0,
    });
  });
});

async function startRedisBridge() {
  const subscriber = createRedisConnection("chatzi-socketio-sub", { failFast: false });

  subscriber.on("pmessage", (_pattern: string, channel: string, rawMessage: string) => {
    const tenantId = extractTenantIdFromRedisChannel(channel);
    if (!tenantId) return;

    try {
      const event = normalizeRedisEnvelope(rawMessage);
      const room = tenantRoom(tenantId);
      io.to(room).emit("realtime:event", event);
    } catch (error) {
      logger.warn("socket.redis_event_parse_failed", {
        channel,
        error: error instanceof Error ? error.message : "unknown",
      });
      io.to(tenantRoom(tenantId)).emit("sync.required", {
        reason: "malformed_socket_realtime_event",
        transport: "socket.io",
        ts: new Date().toISOString(),
      });
    }
  });

  subscriber.on("error", (error) => {
    logger.warn("socket.redis_subscriber_error", {
      error: error instanceof Error ? error.message : "unknown",
    });
  });

  await subscriber.psubscribe(CHANNEL_PATTERN);
  logger.info("socket.redis_bridge_ready", { pattern: CHANNEL_PATTERN });

  const shutdown = async () => {
    logger.info("socket.shutdown", { ts: new Date().toISOString() });
    try {
      await subscriber.punsubscribe(CHANNEL_PATTERN);
    } catch {
      // ignore
    }
    subscriber.disconnect();
    io.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

httpServer.listen(PORT, "127.0.0.1", async () => {
  logger.info("socket.server_listening", { port: PORT, path: PATH });
  try {
    await startRedisBridge();
  } catch (error) {
    logger.error("socket.redis_bridge_start_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
});
