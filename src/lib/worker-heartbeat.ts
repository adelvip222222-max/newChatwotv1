import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export function startWorkerHeartbeat(workerName: string) {
  const key = `worker:heartbeat:${workerName}`;

  async function beat() {
    try {
      await redis.set(key, new Date().toISOString(), "EX", 90);
    } catch (error) {
      logger.warn("worker.heartbeat_failed", {
        workerName,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  void beat();
  const interval = setInterval(() => void beat(), 30_000);
  interval.unref?.();
}
