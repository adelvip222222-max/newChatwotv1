import { Queue } from "bullmq";
import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";
import { connectToDatabase } from "../src/lib/mongodb";
import { createRedisConnection, formatRedisError } from "../src/lib/redis-connection";
import { MessageDelivery } from "../src/lib/models";

loadEnvConfig(process.cwd());

const watchdog = setTimeout(() => {
  console.error("Outbound requeue failed: script timed out after 30000ms");
  process.exit(1);
}, 30000);

type OutboundMessagePayload = {
  deliveryId: string;
  channelId: string;
  provider: string;
  externalUserId?: string;
  externalThreadId?: string;
  text: string;
  attachments?: unknown[];
};

async function withTimeout<T>(task: Promise<T>, label: string, timeoutMs = 15000) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function main() {
  await withTimeout(connectToDatabase(), "MongoDB connection");

  const limit = Number.parseInt(process.env.REQUEUE_LIMIT || "100", 10);

  let scanned = 0;
  let requeued = 0;
  let failed = 0;
  let connection: ReturnType<typeof createRedisConnection> | undefined;
  let queue: Queue | undefined;

  try {
    const pendingDeliveries = await MessageDelivery.find({
      direction: "outgoing",
      status: "queued",
      errorCode: "QUEUE_UNAVAILABLE",
      $or: [{ nextRetryAt: { $lte: new Date() } }, { nextRetryAt: { $exists: false } }]
    })
      .sort({ createdAt: 1 })
      .limit(Number.isFinite(limit) ? limit : 100);

    scanned = pendingDeliveries.length;

    if (pendingDeliveries.length === 0) {
      console.log(`Outbound requeue complete. scanned=${scanned} requeued=${requeued} failed=${failed}`);
      return;
    }

    connection = createRedisConnection("requeue-outbound", { failFast: true });
    queue = new Queue("outbound-messages", { connection: connection as any });

    for (const delivery of pendingDeliveries) {
      const payload = (delivery.metadata as { pendingQueuePayload?: OutboundMessagePayload } | undefined)
        ?.pendingQueuePayload;

      if (!payload) {
        failed += 1;
        continue;
      }

      try {
        await withTimeout(
          queue.add("send", payload, {
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: true,
            removeOnFail: false
          }),
          "Redis enqueue",
          5000
        );

        await MessageDelivery.findByIdAndUpdate(delivery._id, {
          $unset: { errorCode: "", errorMessage: "", nextRetryAt: "", "metadata.pendingQueuePayload": "" }
        });

        requeued += 1;
      } catch (error) {
        failed += 1;
        await MessageDelivery.findByIdAndUpdate(delivery._id, {
          errorMessage: formatRedisError(error),
          nextRetryAt: new Date(Date.now() + 60_000)
        });
      }
    }
  } finally {
    if (queue) await withTimeout(queue.close(), "Queue close", 2000).catch(() => undefined);
    if (connection) await withTimeout(connection.quit(), "Redis connection close", 2000).catch(() => undefined);
  }

  console.log(`Outbound requeue complete. scanned=${scanned} requeued=${requeued} failed=${failed}`);
}

main()
  .catch((error) => {
    console.error("Outbound requeue failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(watchdog);
    await withTimeout(mongoose.disconnect(), "MongoDB disconnect", 2000).catch(() => undefined);
    process.exit(process.exitCode || 0);
  });
