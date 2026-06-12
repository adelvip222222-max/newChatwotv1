import mongoose from "mongoose";
import { Queue } from "bullmq";
import { loadEnvConfig } from "@next/env";
import { connectToDatabase } from "../src/lib/mongodb";
import { WebhookEvent } from "../src/lib/models";
import { createRedisConnection } from "../src/lib/redis-connection";
import { defaultJobOptions, makeQueueJobId } from "../src/lib/queues";

loadEnvConfig(process.cwd());

const watchdog = setTimeout(() => {
  console.error("Inbound webhook requeue failed: script timed out after 30000ms");
  process.exit(1);
}, 30000);

async function main() {
  await connectToDatabase();

  const provider = process.env.REQUEUE_PROVIDER || "telegram";
  const limit = Number.parseInt(process.env.REQUEUE_LIMIT || "100", 10);
  const events = await WebhookEvent.find({
    provider,
    status: "received"
  })
    .sort({ createdAt: 1 })
    .limit(Number.isFinite(limit) ? limit : 100)
    .lean();

  const connection = createRedisConnection("requeue-inbound-webhooks", { failFast: true });
  const queue = new Queue("ingress-queue", { connection: connection as any });

  let requeued = 0;
  try {
    for (const event of events) {
      const traceId = String((event.metadata as { traceId?: string } | undefined)?.traceId || makeQueueJobId(provider, event.externalEventId, "retry"));
      await queue.add(
        "process-inbound-webhook",
        {
          tenantId: event.tenantId?.toString(),
          provider: event.provider,
          channelId: event.channelId?.toString(),
          externalEventId: event.externalEventId,
          rawPayload: event.rawPayload,
          rawHeaders: {},
          traceId
        },
        {
          ...defaultJobOptions,
          jobId: makeQueueJobId(event.provider, event.externalEventId)
        }
      );
      requeued += 1;
    }
  } finally {
    await queue.close().catch(() => undefined);
    await connection.quit().catch(() => undefined);
  }

  console.log(`Inbound webhook requeue complete. provider=${provider} scanned=${events.length} requeued=${requeued}`);
}

main()
  .catch((error) => {
    console.error("Inbound webhook requeue failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(watchdog);
    await mongoose.disconnect().catch(() => undefined);
  });
