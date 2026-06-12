# Qdrant RAG Implementation Report

## Scope

This update adds a production-safe Qdrant-backed RAG layer to the current Chatzi / NewChatwot knowledge system while preserving the existing MongoDB hybrid fallback and the smart raw-document fallback.

The goal is not to replace the current Knowledge Base behavior abruptly, but to make Qdrant the primary semantic retrieval engine when it is configured and healthy.

---

## What changed

### 1. Qdrant client hardening

Updated `src/lib/qdrant.ts` with:

- Configurable collection name via `QDRANT_COLLECTION`.
- Health inspection helper.
- Safe vector validation.
- Collection creation based on embedding vector size.
- Batch upsert support.
- Document-level delete support.
- Semantic search with tenant/bot/provider filters.
- Expired temporary-knowledge filtering after search.

Qdrant is enabled when either:

```env
KNOWLEDGE_RAG_ENGINE=qdrant
```

or:

```env
QDRANT_URL=...
```

is configured.

---

### 2. Knowledge training now indexes into Qdrant

Updated `src/lib/knowledge.ts` so that `trainKnowledgeDocument()` now:

1. Deletes old Qdrant points for the document.
2. Deletes old Mongo chunks.
3. Splits the document into chunks.
4. Creates embeddings.
5. Saves chunks in MongoDB.
6. Upserts usable real embeddings into Qdrant.
7. Keeps MongoDB fallback available even if Qdrant fails.

Local hash embeddings are not stored in Qdrant because they are only a fallback and do not provide high-quality semantic search.

---

### 3. Search is now Qdrant-first hybrid RAG

Updated `searchKnowledge()` so the retrieval order is:

```txt
Qdrant semantic search
+
MongoDB keyword search
+
MongoDB semantic fallback when Qdrant is missing/weak
+
raw KnowledgeDocument fallback for pending onboarding/template documents
```

This provides the following behavior:

- If Qdrant is configured and returns useful results, it becomes the primary retriever.
- MongoDB keyword search still runs to catch exact product names, prices, policies, and Arabic/English terms.
- MongoDB semantic fallback is used if Qdrant returns too few results.
- Raw document fallback still protects new tenants while chunks/embeddings are pending.

---

### 4. Update/delete/rewrite now keeps Qdrant synchronized

When a Knowledge Document is edited, deleted, or rewritten:

- Old chunks are removed from MongoDB.
- Old Qdrant points are removed.
- Retraining is automatically enqueued after edit/rewrite.

This prevents stale knowledge from being used by the bot.

---

### 5. Qdrant migration and health scripts

Added scripts:

```bash
npm run knowledge:qdrant:migrate
npm run knowledge:qdrant:health
```

`knowledge:qdrant:migrate` migrates existing MongoDB chunks into Qdrant.

`knowledge:qdrant:health` prints the Qdrant collection status.

---

### 6. Qdrant health API

Added:

```txt
GET /api/health/qdrant
```

It supports normal admin authorization or `HEALTHCHECK_SECRET` bearer checks like the other health endpoints.

---

## Required environment variables

Example file added:

```txt
docs/deployment/QDRANT_RAG_ENV.example
```

Minimum required:

```env
QDRANT_URL=http://127.0.0.1:6333
KNOWLEDGE_RAG_ENGINE=qdrant
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Optional:

```env
QDRANT_API_KEY=
QDRANT_COLLECTION=knowledge_chunks
KNOWLEDGE_QDRANT_SCORE_THRESHOLD=0.35
KNOWLEDGE_QDRANT_LIMIT=20
```

---

## Deployment steps

After applying this version on the server:

```bash
cd /opt/chatzi/app
npm install --legacy-peer-deps --registry=https://registry.npmjs.org/
npm run build
pm2 reload ecosystem.config.js --update-env
```

Then check Qdrant:

```bash
npm run knowledge:qdrant:health
```

If you already have knowledge chunks in MongoDB, migrate them:

```bash
npm run knowledge:qdrant:migrate
```

Then requeue/retrain if needed:

```bash
npm run knowledge:requeue
pm2 logs worker-knowledge --lines 100
```

---

## Fallback behavior

If Qdrant is down or misconfigured, the system does not stop.

Fallback order:

1. MongoDB keyword search.
2. MongoDB local semantic fallback.
3. raw KnowledgeDocument fallback.
4. Bot asks a scoped clarification instead of leaving the business context.

---

## Current readiness

| Area | Status |
|---|---|
| Qdrant client | Implemented |
| Qdrant indexing from worker | Implemented |
| Qdrant-first retrieval | Implemented |
| Mongo fallback | Preserved |
| Raw document fallback | Preserved |
| Migration script | Implemented |
| Health script/API | Implemented |
| Full build in sandbox | Not run because node_modules are unavailable |

---

## Notes

This is a safe staged implementation:

```txt
Qdrant primary when healthy
MongoDB fallback always available
Raw document fallback for pending onboarding knowledge
```

This keeps the bot smarter without risking total failure if Qdrant is temporarily unavailable.
