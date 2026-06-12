import Redis from "ioredis";

type RedisConnectionOptions = {
  failFast?: boolean;
};

const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";
const loggedErrors = new Map<string, number>();

export function getRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = process.env.REDIS_PORT || "6379";
  const password = process.env.REDIS_PASSWORD ? `:${encodeURIComponent(process.env.REDIS_PASSWORD)}@` : "";

  if (process.env.REDIS_HOST || process.env.REDIS_PORT || process.env.REDIS_PASSWORD) {
    return `redis://${password}${host}:${port}`;
  }

  return DEFAULT_REDIS_URL;
}

export function createRedisConnection(name: string, options: RedisConnectionOptions = {}) {
  const redis = new Redis(getRedisUrl(), {
    connectionName: name,
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: options.failFast ? 5000 : undefined,
    enableOfflineQueue: !options.failFast,
    retryStrategy(times) {
      return Math.min(times * 500, 5000);
    }
  });

  attachRedisErrorLogger(redis, name);
  return redis;
}

export function attachRedisErrorLogger(redis: Redis, label: string) {
  redis.on("error", (error) => {
    const now = Date.now();
    const lastLoggedAt = loggedErrors.get(label) || 0;

    if (now - lastLoggedAt < 30000) return;

    loggedErrors.set(label, now);
    console.error(`[redis:${label}] ${formatRedisError(error)}`);
  });
}

export function formatRedisError(error: unknown) {
  if (error instanceof Error) {
    const code = "code" in error ? String((error as Error & { code?: string }).code || "") : "";
    return code ? `${code}: ${error.message}` : error.message;
  }

  return String(error);
}
