/**
 * T5.2 — Migrate KnowledgeChunks from MongoDB to Qdrant
 *
 * Run:   npx ts-node -P tsconfig.json scripts/migrate-chunks-to-qdrant.ts
 *
 * Env:   MONGODB_URI, QDRANT_URL, QDRANT_API_KEY (optional)
 *
 * Skips:
 *   - Chunks that use a local/hash embedding (no real vector stored)
 *   - Chunks already present in Qdrant (by mongoId in payload)
 *   - Expired temporary chunks
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/mongodb";
import { KnowledgeChunk } from "../src/lib/models";
import {
  ensureCollection,
  upsertChunkBatch,
  isQdrantEnabled,
  type QdrantChunkPayload
} from "../src/lib/qdrant";

const BATCH_SIZE = 50;

async function main() {
  if (!isQdrantEnabled()) {
    console.error("QDRANT_URL is not set. Set it before running this script.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB…");
  await connectToDatabase();

  console.log("Ensuring Qdrant collection…");
  await ensureCollection(1536);

  const filter: Record<string, any> = {
    embeddingVector: { $exists: true, $not: { $size: 0 } },
    embeddingProvider: { $ne: "local" }
  };

  const total = await KnowledgeChunk.countDocuments(filter);
  console.log(`Total eligible chunks: ${total}`);

  let processed = 0;
  let skipped = 0;
  let batch: any[] = [];

  const cursor = KnowledgeChunk.find(filter).lean().cursor();

  for await (const chunk of cursor) {
    const c = chunk as any;

    // Skip expired temporary chunks
    if (c.isTemporary && c.expiresAt && new Date(c.expiresAt) < new Date()) {
      skipped++;
      continue;
    }

    // Skip chunks without a real vector
    if (!Array.isArray(c.embeddingVector) || c.embeddingVector.length < 10) {
      skipped++;
      continue;
    }

    // Skip local/hash embeddings
    if (c.embeddingProvider === "local" || c.embeddingProvider?.startsWith("hash")) {
      skipped++;
      continue;
    }

    const payload: QdrantChunkPayload = {
      tenantId: c.tenantId?.toString() || "",
      botId: c.botId?.toString() || "",
      documentId: c.documentId?.toString() || "",
      categoryId: c.categoryId?.toString() || "",
      collectionId: c.collectionId?.toString() || "",
      chunkIndex: c.chunkIndex || 0,
      text: c.content || "",
      keywords: c.keywords || [],
      embeddingProvider: c.embeddingProvider || "openai",
      isTemporary: Boolean(c.isTemporary),
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
      sourceTitle: c.sourceTitle || "",
      sourceUrl: c.sourceUrl || "",
      contentHash: c.contentHash || "",
      mongoId: c._id.toString()
    };

    batch.push({
      mongoId: c._id.toString(),
      vector: c.embeddingVector,
      payload
    });

    if (batch.length >= BATCH_SIZE) {
      await upsertChunkBatch(batch);
      processed += batch.length;
      batch = [];
      console.log(`  → Upserted ${processed}/${total}`);
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await upsertChunkBatch(batch);
    processed += batch.length;
  }

  console.log(`\nMigration complete.`);
  console.log(`  Upserted : ${processed}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Total    : ${total}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
