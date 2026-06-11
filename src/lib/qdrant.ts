import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "@/lib/logger";

const COLLECTION_NAME = "knowledge_chunks";

let _client: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!_client) {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url) throw new Error("QDRANT_URL is not configured.");
    _client = new QdrantClient({ url, ...(apiKey && { apiKey }) });
  }
  return _client;
}

export function isQdrantEnabled(): boolean {
  return Boolean(process.env.QDRANT_URL);
}

// ─── Collection Management ────────────────────────────────────────────────────

export async function ensureCollection(vectorSize = 1536): Promise<void> {
  const client = getClient();
  try {
    await client.getCollection(COLLECTION_NAME);
  } catch {
    await client.createCollection(COLLECTION_NAME, {
      vectors: { size: vectorSize, distance: "Cosine" }
    });
    logger.info("qdrant.collection_created", { collection: COLLECTION_NAME, vectorSize });
  }
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

export interface QdrantChunkPayload {
  tenantId: string;
  botId: string;
  documentId: string;
  categoryId: string;
  collectionId: string;
  chunkIndex: number;
  text: string;
  keywords: string[];
  embeddingProvider: string;
  isTemporary: boolean;
  expiresAt?: string | null;
  sourceTitle?: string;
  sourceUrl?: string;
  contentHash: string;
  mongoId: string;
}

export async function upsertChunk(
  mongoId: string,
  vector: number[],
  payload: QdrantChunkPayload
): Promise<void> {
  if (!isQdrantEnabled()) return;
  const client = getClient();
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: [
      {
        id: mongoIdToUuid(mongoId),
        vector,
        payload: payload as unknown as Record<string, unknown>
      }
    ]
  });
}

export async function upsertChunkBatch(
  points: Array<{ mongoId: string; vector: number[]; payload: QdrantChunkPayload }>
): Promise<void> {
  if (!isQdrantEnabled() || points.length === 0) return;
  const client = getClient();
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: points.map(({ mongoId, vector, payload }) => ({
      id: mongoIdToUuid(mongoId),
      vector,
      payload: payload as unknown as Record<string, unknown>
    }))
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteChunk(mongoId: string): Promise<void> {
  if (!isQdrantEnabled()) return;
  const client = getClient();
  await client.delete(COLLECTION_NAME, {
    wait: true,
    points: [mongoIdToUuid(mongoId)]
  });
}

export async function deleteChunksByDocument(documentId: string, tenantId: string): Promise<void> {
  if (!isQdrantEnabled()) return;
  const client = getClient();
  await client.delete(COLLECTION_NAME, {
    wait: true,
    filter: {
      must: [
        { key: "tenantId", match: { value: tenantId } },
        { key: "documentId", match: { value: documentId } }
      ]
    }
  });
}

export async function deleteExpiredChunks(): Promise<number> {
  if (!isQdrantEnabled()) return 0;
  const client = getClient();
  const now = new Date().toISOString();
  const result = await client.delete(COLLECTION_NAME, {
    wait: true,
    filter: {
      must: [
        { key: "isTemporary", match: { value: true } },
        { key: "expiresAt", range: { lt: now } }
      ]
    }
  });
  const deleted = (result as any)?.result?.deleted ?? 0;
  logger.info("qdrant.expired_chunks_deleted", { count: deleted });
  return deleted;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface QdrantSearchResult {
  mongoId: string;
  score: number;
  payload: QdrantChunkPayload;
}

export interface QdrantSearchFilter {
  tenantId: string;
  botId?: string;
  documentId?: string;
  categoryId?: string;
  collectionId?: string;
  embeddingProvider?: string;
  excludeTemporaryExpired?: boolean;
}

export async function semanticSearch(
  vector: number[],
  filter: QdrantSearchFilter,
  limit = 10,
  scoreThreshold = 0.4
): Promise<QdrantSearchResult[]> {
  if (!isQdrantEnabled()) return [];
  const client = getClient();

  const must: any[] = [
    { key: "tenantId", match: { value: filter.tenantId } }
  ];

  if (filter.botId) must.push({ key: "botId", match: { value: filter.botId } });
  if (filter.documentId) must.push({ key: "documentId", match: { value: filter.documentId } });
  if (filter.categoryId) must.push({ key: "categoryId", match: { value: filter.categoryId } });
  if (filter.collectionId) must.push({ key: "collectionId", match: { value: filter.collectionId } });
  if (filter.embeddingProvider) must.push({ key: "embeddingProvider", match: { value: filter.embeddingProvider } });

  // Exclude expired temporary chunks
  if (filter.excludeTemporaryExpired !== false) {
    const now = new Date().toISOString();
    // Must satisfy: NOT (isTemporary=true AND expiresAt < now)
    // Equivalent: isTemporary=false OR expiresAt >= now OR expiresAt is null
    must.push({
      should: [
        { key: "isTemporary", match: { value: false } },
        { key: "expiresAt", range: { gte: now } },
        { is_null: { key: "expiresAt" } }
      ]
    });
  }

  const results = await client.search(COLLECTION_NAME, {
    vector,
    limit,
    score_threshold: scoreThreshold,
    filter: { must },
    with_payload: true
  });

  return results.map((r) => ({
    mongoId: uuidToMongoId(String(r.id)),
    score: r.score,
    payload: r.payload as unknown as QdrantChunkPayload
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a 24-char MongoDB ObjectId hex string to a deterministic UUID v4-like string.
 * Qdrant requires UUIDs or unsigned integers as point IDs.
 * We pad the 24-char hex to 32 chars and format as UUID.
 */
function mongoIdToUuid(mongoId: string): string {
  const padded = mongoId.padEnd(32, "0").slice(0, 32);
  return [
    padded.slice(0, 8),
    padded.slice(8, 12),
    padded.slice(12, 16),
    padded.slice(16, 20),
    padded.slice(20, 32)
  ].join("-");
}

function uuidToMongoId(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 24);
}
