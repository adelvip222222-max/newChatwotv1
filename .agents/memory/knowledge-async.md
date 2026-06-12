---
name: Knowledge Async Training
description: Knowledge training moved to BullMQ, no longer synchronous in HTTP request
---

## Rule
`createKnowledgeDocument()` must NOT call `trainKnowledgeDocument()` synchronously.

## Flow
1. `createKnowledgeDocument()`: extract text → save rawText → create doc with `status:"pending"` → enqueue job → return documentId
2. Worker `workers/knowledge-worker.ts`: calls `trainKnowledgeDocument(documentId, tenantId)` which reads rawText from DB
3. Status: `pending → processing → ready | error`
4. `retrainAllKnowledge()`: uses `addBulk()` not sequential awaits

## Queue
- Name: `knowledge-training-queue`
- Concurrency: 2 (configurable via `KNOWLEDGE_WORKER_CONCURRENCY`)
- Attempts: 3, exponential backoff 1s base
- Start worker: `npm run worker:knowledge`

## Why
Original synchronous training caused HTTP 504 timeouts for large documents (PDFs).

## Embedding isolation
openai=1536 dims, local-hash=128 dims. `cosineSimilarity()` returns 0 if `a.length !== b.length`.
`searchKnowledge()` filters chunks by `embeddingProvider: queryProvider` before similarity computation.
If provider changes, `needsRetraining` count returned in search results.
