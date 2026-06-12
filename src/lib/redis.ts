import Redis from "ioredis";
import { createRedisConnection } from "./redis-connection";

// Ensure the connection is reused in development (Next.js hot reloading)
// and properly initialized in production.
const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  createRedisConnection("chatzi-queues", { failFast: true });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
