/**
 * Migrate existing KnowledgeChunks from MongoDB to Qdrant.
 *
 * Run:
 *   npm run knowledge:qdrant:migrate
 * or:
 *   npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/migrate-chunks-to-qdrant.ts
 *
 * Required env:
 *   MONGODB_URI
 *   QDRANT_URL
 * Optional env:
 *   QDRANT_API_KEY
 *   QDRANT_COLLECTION=knowledge_chunks
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/mongodb";
import { KnowledgeChunk } from "../src/lib/models";
import {
  ensureCollection,
  upsertChunkBatch,
  isQdrantEnabled,
  isVectorUsableForQdrant,
  type QdrantChunkPayload
} from "../src/lib/qdrant";

const BATCH_SIZE = Number(process.env.QDRANT_MIGRATION_BATCH_SIZE || 50);

function payloadFromChunk(c: any): QdrantChunkPayload {
  return {
    tenantId: c.tenantId?.toString() || "",
    botId: c.botId?.toString() || "",
    documentId: c.documentId?.toString() || "",
    categoryId: c.categoryId?.toString() || "",
    collectionId: c.collectionId?.toString() || "",
    chunkIndex: Number(c.chunkIndex || 0),
    text: c.text || "",
    keywords: Array.isArray(c.keywords) ? c.keywords : [],
    embeddingProvider: c.embeddingProvider || "openai",
    isTemporary: Boolean(c.isTemporary),
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
    sourceTitle: c.sourceTitle || "",
    sourceUrl: c.sourceUrl || "",
    contentHash: c.contentHash || "",
    mongoId: c._id.toString(),
    sourceType: c.metadata?.sourceType || "",
    tags: Array.isArray(c.metadata?.tags) ? c.metadata.tags : []
  };
}

async function main() {
  if (!isQdrantEnabled()) {
    console.error("QDRANT_URL is not set. Set it before running this script.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB…");
  await connectToDatabase();

  const firstVectorChunk = await KnowledgeChunk.findOne({
    embedding: { $exists: true, $not: { $size: 0 } },
    embeddingProvider: { $ne: "local-hash" }
  }).lean();

  const vectorSize = Array.isArray((firstVectorChunk as any)?.embedding)
    ? (firstVectorChunk as any).embedding.length
    : Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 1536);

  console.log(`Ensuring Qdrant collection with vector size ${vectorSize}…`);
  await ensureCollection(vectorSize);

  const filter: Record<string, any> = {
    embedding: { $exists: true, $not: { $size: 0 } },
    embeddingProvider: { $ne: "local-hash" }
  };

  const total = await KnowledgeChunk.countDocuments(filter);
  console.log(`Total eligible chunks: ${total}`);

  let processed = 0;
  let skipped = 0;
  let batch: Array<{ mongoId: string; vector: number[]; payload: QdrantChunkPayload }> = [];

  const cursor = KnowledgeChunk.find(filter).lean().cursor();

  for await (const chunk of cursor) {
    const c = chunk as any;

    if (c.isTemporary && c.expiresAt && new Date(c.expiresAt) < new Date()) {
      skipped += 1;
      continue;
    }

    if (!isVectorUsableForQdrant(c.embedding || [], c.embeddingProvider)) {
      skipped += 1;
      continue;
    }

    batch.push({
      mongoId: c._id.toString(),
      vector: c.embedding,
      payload: payloadFromChunk(c)
    });

    if (batch.length >= BATCH_SIZE) {
      await upsertChunkBatch(batch);
      processed += batch.length;
      batch = [];
      console.log(`  → Upserted ${processed}/${total}`);
    }
  }

  if (batch.length > 0) {
    await upsertChunkBatch(batch);
    processed += batch.length;
  }

  console.log("\nMigration complete.");
  console.log(`  Upserted : ${processed}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Total    : ${total}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
