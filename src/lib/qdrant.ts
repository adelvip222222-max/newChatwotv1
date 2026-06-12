import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "@/lib/logger";

const DEFAULT_COLLECTION_NAME = "knowledge_chunks";

function getCollectionName(): string {
  return process.env.QDRANT_COLLECTION || DEFAULT_COLLECTION_NAME;
}

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
  return process.env.KNOWLEDGE_RAG_ENGINE === "qdrant" || Boolean(process.env.QDRANT_URL);
}

export function isVectorUsableForQdrant(vector: number[], provider?: string): boolean {
  // Do not store local/hash fallback vectors in Qdrant. They are only for in-memory fallback.
  return Array.isArray(vector) && vector.length >= 256 && provider !== "local-hash";
}

// ─── Collection Management ────────────────────────────────────────────────────

export async function ensureCollection(vectorSize = 1536): Promise<void> {
  if (!isQdrantEnabled()) return;
  const client = getClient();
  const collection = getCollectionName();
  try {
    const info = await client.getCollection(collection);
    const existingSize = Number((info as any)?.config?.params?.vectors?.size || 0);
    if (existingSize && existingSize !== vectorSize) {
      logger.warn("qdrant.collection_vector_size_mismatch", {
        collection,
        existingSize,
        requestedSize: vectorSize
      });
    }
  } catch {
    await client.createCollection(collection, {
      vectors: { size: vectorSize, distance: "Cosine" }
    });
    logger.info("qdrant.collection_created", { collection, vectorSize });
  }
}

export async function getQdrantHealth(): Promise<{
  enabled: boolean;
  collection: string;
  status: "disabled" | "ok" | "error";
  pointsCount?: number;
  vectorsCount?: number;
  error?: string;
}> {
  const collection = getCollectionName();
  if (!isQdrantEnabled()) return { enabled: false, collection, status: "disabled" };
  try {
    const info = await getClient().getCollection(collection);
    return {
      enabled: true,
      collection,
      status: "ok",
      pointsCount: Number((info as any)?.points_count || 0),
      vectorsCount: Number((info as any)?.vectors_count || 0)
    };
  } catch (error) {
    return {
      enabled: true,
      collection,
      status: "error",
      error: error instanceof Error ? error.message : "unknown"
    };
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
  sourceType?: string;
  tags?: string[];
}

export async function upsertChunk(
  mongoId: string,
  vector: number[],
  payload: QdrantChunkPayload
): Promise<void> {
  await upsertChunkBatch([{ mongoId, vector, payload }]);
}

export async function upsertChunkBatch(
  points: Array<{ mongoId: string; vector: number[]; payload: QdrantChunkPayload }>
): Promise<void> {
  const usable = points.filter(({ vector, payload }) => isVectorUsableForQdrant(vector, payload.embeddingProvider));
  if (!isQdrantEnabled() || usable.length === 0) return;

  const vectorSize = usable[0]?.vector.length || 1536;
  await ensureCollection(vectorSize);

  const client = getClient();
  const collection = getCollectionName();
  await client.upsert(collection, {
    wait: true,
    points: usable.map(({ mongoId, vector, payload }) => ({
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
  await client.delete(getCollectionName(), {
    wait: true,
    points: [mongoIdToUuid(mongoId)]
  });
}

export async function deleteChunksByDocument(documentId: string, tenantId: string): Promise<void> {
  if (!isQdrantEnabled()) return;
  const client = getClient();
  await client.delete(getCollectionName(), {
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
  const result = await client.delete(getCollectionName(), {
    wait: true,
    filter: {
      must: [{ key: "isTemporary", match: { value: true } }, { key: "expiresAt", range: { lt: now } }]
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
  scoreThreshold = 0.35
): Promise<QdrantSearchResult[]> {
  if (!isQdrantEnabled() || !isVectorUsableForQdrant(vector, filter.embeddingProvider)) return [];
  const client = getClient();

  const must: any[] = [{ key: "tenantId", match: { value: filter.tenantId } }];

  if (filter.botId) must.push({ key: "botId", match: { value: filter.botId } });
  if (filter.documentId) must.push({ key: "documentId", match: { value: filter.documentId } });
  if (filter.categoryId) must.push({ key: "categoryId", match: { value: filter.categoryId } });
  if (filter.collectionId) must.push({ key: "collectionId", match: { value: filter.collectionId } });
  if (filter.embeddingProvider) must.push({ key: "embeddingProvider", match: { value: filter.embeddingProvider } });

  const results = await client.search(getCollectionName(), {
    vector,
    limit,
    score_threshold: scoreThreshold,
    filter: { must },
    with_payload: true
  });

  const now = Date.now();
  return results
    .map((r) => ({
      mongoId: uuidToMongoId(String(r.id)),
      score: Number(r.score || 0),
      payload: r.payload as unknown as QdrantChunkPayload
    }))
    .filter((result) => {
      if (filter.excludeTemporaryExpired === false) return true;
      if (!result.payload?.isTemporary) return true;
      if (!result.payload?.expiresAt) return true;
      return new Date(result.payload.expiresAt).getTime() > now;
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a 24-char MongoDB ObjectId hex string to a deterministic UUID-like string.
 * Qdrant requires UUIDs or unsigned integers as point IDs.
 */
export function mongoIdToUuid(mongoId: string): string {
  const padded = mongoId.padEnd(32, "0").slice(0, 32);
  return [
    padded.slice(0, 8),
    padded.slice(8, 12),
    padded.slice(12, 16),
    padded.slice(16, 20),
    padded.slice(20, 32)
  ].join("-");
}

export function uuidToMongoId(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 24);
}
