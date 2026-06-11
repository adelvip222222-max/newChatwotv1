# Knowledge Async Training — Architecture

## Problem

The original `createKnowledgeDocument()` called `trainKnowledgeDocument()` synchronously inside the HTTP request. For large documents (PDFs with many pages), this caused:
- HTTP 504/timeout errors
- Poor UX (long blocking upload)
- No progress feedback
- Failed uploads appearing as network errors

## Solution

Knowledge training is now fully async via BullMQ.

## Flow

```
HTTP Request                Worker (knowledge-training-queue)
─────────────               ─────────────────────────────────
createKnowledgeDocument()
  1. Extract text (fast)
  2. Store rawText in DB
  3. Create doc {status:"pending"}
  4. Enqueue training job ──────────────────────────────────►
  5. Return documentId     
                                trainKnowledgeDocument()
                                  1. doc.status = "processing"
                                  2. Delete old chunks
                                  3. Split into chunks
                                  4. Create embeddings
                                  5. Insert KnowledgeChunk[]
                                  6. doc.status = "ready"
                                  (on error → doc.status = "error")
```

## Files

| File | Responsibility |
|------|---------------|
| `src/lib/queues/index.ts` | `knowledgeTrainingQueue` export |
| `workers/knowledge-worker.ts` | BullMQ worker that calls `trainKnowledgeDocument()` |
| `src/lib/knowledge.ts` | `createKnowledgeDocument` (enqueues), `trainKnowledgeDocument` (worker target), `retrainAllKnowledge` (bulk enqueue) |
| `src/app/api/knowledge/documents/[id]/status/route.ts` | Progress polling endpoint |

## Queue Config

```
Queue:    knowledge-training-queue
Attempts: 3
Backoff:  exponential (1s base)
Concurrency: 2 (configurable via KNOWLEDGE_WORKER_CONCURRENCY)
```

## Status Lifecycle

```
pending → processing → ready
                    → error (with statusReason)
```

- `pending`: Job enqueued, not yet started
- `processing`: Worker actively chunking/embedding
- `ready`: All chunks stored, document searchable
- `error`: Permanent failure after retries exhausted; `statusReason` contains the error

## Progress API

```
GET /api/knowledge/documents/{id}/status
Authorization: requires knowledge.read permission

Response:
{
  "status": "pending | processing | ready | error",
  "statusReason": "null | error description",
  "chunkCount": 0,
  "embeddingCount": 0,
  "needsRetraining": false
}
```

Frontend can poll this endpoint every 2–5 seconds to show progress.

## Embedding Provider Isolation

OpenAI embeddings (1536 dims) and local-hash embeddings (128 dims) **must not be compared**. The system enforces this at two levels:

1. **`searchKnowledge()`**: Determines the query embedding provider first, then filters `KnowledgeChunk` documents by `embeddingProvider: queryProvider` before computing similarity.
2. **`cosineSimilarity()`**: Returns `0` immediately if `a.length !== b.length` instead of silently truncating with `Math.min()`.

### Migration for existing chunks

If the embedding provider changes (e.g. OpenAI key added after local-hash training), chunks are not automatically retrained. The search will return `needsRetraining: N` where N is the count of chunks using a different provider. Use `/api/knowledge/retrain` to queue a full retrain.

## retrainAllKnowledge

Old behavior: sequential `await trainKnowledgeDocument()` for each document — blocks for potentially hours.

New behavior: `knowledgeTrainingQueue.addBulk()` — all jobs enqueued in one call, processed concurrently by the worker pool.
