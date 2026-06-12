import { connectToDatabase } from "../src/lib/mongodb";
import { KnowledgeDocument } from "../src/lib/models";
import { defaultJobOptions, knowledgeTrainingQueue, makeQueueJobId } from "../src/lib/queues";

async function main() {
  const tenantId = process.env.TENANT_ID || process.argv[2];
  const botId = process.env.BOT_ID || process.argv[3];

  await connectToDatabase();

  const filter: Record<string, unknown> = {
    status: { $in: ["pending", "processing", "error"] },
  };
  if (tenantId) filter.tenantId = tenantId;
  if (botId) filter.botId = botId;

  const documents = await KnowledgeDocument.find(filter).select("_id tenantId title status").lean();

  for (const doc of documents) {
    await KnowledgeDocument.updateOne(
      { _id: doc._id },
      { $set: { status: "pending", statusReason: "Requeued for training.", needsRetraining: false } }
    );

    await knowledgeTrainingQueue.add(
      "train-document",
      { documentId: doc._id.toString(), tenantId: doc.tenantId.toString() },
      { ...defaultJobOptions, jobId: makeQueueJobId("knowledge-repair", doc._id.toString()) }
    );
  }

  console.log(JSON.stringify({ requeued: documents.length }, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
