# Knowledge Architecture
**Project:** ChatZi
**Date:** 2026-06-11

---

## Overview

The knowledge system is a 4-level taxonomy that enables RAG (Retrieval-Augmented Generation) for AI agents. Content is chunked, embedded, and searched using a hybrid semantic+keyword approach.

---

## Data Model

```
Tenant
  └── Bot (scopes knowledge per bot)
        └── KnowledgeCategory (e.g. "Products", "Support")
              └── KnowledgeCollection (e.g. "Electronics", "General")
                    └── KnowledgeDocument (source file or text)
                          └── KnowledgeChunk[] (searchable segments)
```

### KnowledgeDocument
```typescript
{
  tenantId, botId, categoryId, collectionId,
  title: string,
  sourceType: "pdf" | "docx" | "txt" | "csv" | "excel" |
              "faq" | "website" | "html" | "product_catalog" |
              "services_catalog" | "policies" | "terms" | "pricing" |
              "manual" | "support_article" | "custom_text",
  rawText: string,       // cleaned source text
  textHash: string,      // SHA-256 for deduplication
  status: "pending" | "processing" | "ready" | "error" | "duplicate",
  isTemporary: boolean,  // for temporary knowledge
  expiresAt?: Date,      // expiration for temporary knowledge
  chunkCount: number,
  embeddingCount: number,
  needsRetraining: boolean
}
```

### KnowledgeChunk
```typescript
{
  tenantId, botId, documentId, categoryId, collectionId,
  chunkIndex: number,
  text: string,           // original chunk text
  normalizedText: string, // lowercased, punctuation-stripped
  keywords: string[],     // extracted terms (max 32)
  embedding: number[],    // vector (1536-dim OpenAI OR 128-dim local hash)
  embeddingProvider: "openai" | "local-hash",
  isTemporary: boolean,
  expiresAt?: Date,
  contentHash: string,    // SHA-256 of chunk text
  sourceTitle: string,
  sourceUrl: string
}
```

---

## Ingestion Pipeline

```
Input: file (PDF/DOCX/Excel/TXT) OR URL OR plain text
         │
         ▼ [1] Text Extraction
         │   PDF    → pdf-parse
         │   DOCX   → mammoth
         │   Excel  → ExcelJS
         │   URL    → fetch + HTML strip
         │   Text   → direct
         │
         ▼ [2] Text Cleaning
         │   → remove null bytes, normalize whitespace
         │   → deduplicate identical lines
         │   → min length check (>10 chars)
         │
         ▼ [3] Deduplication Check
         │   SHA-256 hash → check existing documents
         │   → mark as "duplicate" if found
         │
         ▼ [4] Document Creation
         │   KnowledgeDocument.create({ status: "processing" })
         │
         ▼ [5] Chunking
         │   chunkSize = 420 words, overlap = 70 words
         │   → sliding window with overlap for context preservation
         │
         ▼ [6] Embedding Generation (per chunk)
         │   IF apiKey configured:
         │     → OpenAI text-embedding-3-small (1536 dimensions)
         │   ELSE:
         │     → Local hash embedding (128 dimensions, fallback)
         │
         ▼ [7] KnowledgeChunk.insertMany(records)
         │
         ▼ [8] Document status → "ready"
              chunkCount, embeddingCount updated
```

**Current Problem:** Steps 5-7 run synchronously in the request handler. For large documents, this times out Next.js API routes. Must be moved to a BullMQ job.

---

## Core Knowledge vs Temporary Knowledge

### Core Knowledge (Permanent)
```
isTemporary: false
expiresAt: undefined

Use cases:
  - Product catalog
  - Company policies
  - FAQs
  - Support documentation
  - Pricing tables

Behavior:
  - Never expires
  - Requires manual deletion or retrain
  - Included in all searches
```

### Temporary Knowledge
```
isTemporary: true
expiresAt: Date

Use cases:
  - Seasonal promotions (expires after campaign)
  - Event-specific information
  - Temporary pricing
  - Beta feature documentation

Behavior:
  - Automatically excluded from search after expiresAt
  - Filter: { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }
  - Does NOT auto-delete from DB (cleanup job needed)
  - Manual deletion or auto-cleanup cron required
```

---

## Retrieval System

### Current Implementation (MongoDB)

```typescript
searchKnowledge({ tenantId, botId, question, limit })

Step 1: Semantic Candidates
  → KnowledgeChunk.find({ tenantId, botId, not-expired })
    .sort({ updatedAt: -1 })
    .limit(250)   // ← PROBLEM: loads 250 chunks into memory

Step 2: Keyword Candidates
  → KnowledgeChunk.find({ $text: { $search: keywords } })
    .sort({ $meta: textScore })
    .limit(80)

Step 3: Hybrid Scoring (in JavaScript)
  score = cosine_similarity(queryEmbedding, chunkEmbedding) × 0.68
        + keyword_overlap(queryKeywords, chunkKeywords) × 0.32

Step 4: Return top-k (default: 10)
```

**Problem:** O(n) in-memory cosine similarity. At 10,000 chunks it's slow. At 100,000 it's unusable.

### Target Implementation (Qdrant)

```
Qdrant Collection per tenant+bot:
  collection_name = "chatzi_{tenantId}_{botId}"
  vector_size = 1536
  distance = Cosine

Upsert on chunk creation:
  payload = { chunkId, tenantId, botId, text, keywords, isTemporary, expiresAt, ... }

Search:
  qdrant.search({
    collection_name,
    vector: queryEmbedding,
    filter: {
      must: [
        { key: "tenantId", match: { value: tenantId } },
        { key: "isTemporary", match: { value: false } },
        OR { key: "expiresAt", range: { gt: now } }
      ]
    },
    limit: 20,
    with_payload: true
  })

Post-process:
  → Combine with keyword scores from MongoDB $text
  → Final hybrid ranking
```

---

## Embeddings Strategy

| Provider | Model | Dimensions | Notes |
|---|---|---|---|
| OpenAI | text-embedding-3-small | 1536 | Production default |
| Local | Hash-based | 128 | Fallback, poor quality |
| Future | text-embedding-3-large | 3072 | For premium plans |

**Critical Issue:** Mixing embedding providers creates incompatible vectors. A chunk embedded with local-hash (128-dim) cannot be compared with OpenAI (1536-dim). Current code compares vectors with `Math.min(a.length, b.length)` — silently returns wrong scores.

**Fix Required:** Tag chunks with `embeddingProvider` (already done) and filter search by provider. When API key is added, retrain all local-hash chunks.

---

## Expiration Rules

| Type | Rule | Implementation |
|---|---|---|
| Temporary chunks | Excluded from search if `expiresAt < now` | Query filter in `searchKnowledge` ✅ |
| Expired chunk cleanup | Delete chunks older than expiresAt | ❌ Not implemented — needs cron job |
| Expired document cleanup | Mark document as expired | ❌ Not implemented |
| Retrain triggers | `needsRetraining = true` flag | ✅ Set on training failure |
| Manual retrain | `/api/knowledge/retrain` | ✅ Implemented (but synchronous) |

### Recommended Cleanup Cron
```typescript
// Run daily at 3am
async function cleanupExpiredKnowledge() {
  const expired = await KnowledgeChunk.find({
    expiresAt: { $lt: new Date() },
    isTemporary: true
  }).select('documentId').distinct('documentId');

  await KnowledgeChunk.deleteMany({
    isTemporary: true,
    expiresAt: { $lt: new Date() }
  });

  // Mark documents as expired
  await KnowledgeDocument.updateMany(
    { _id: { $in: expired } },
    { $set: { status: 'expired' } }
  );
}
```

---

## Default Taxonomy

Auto-created for every new tenant:
```
Categories (Arabic): المنتجات | الخدمات | الأسعار | الشحن | الاسترجاع | الضمان | الدعم الفني | الأسئلة الشائعة
Each category gets a default collection: "عام"
```

---

## Scalability Plan

| Phase | Change | Impact |
|---|---|---|
| Now | MongoDB in-memory cosine | Max ~5k chunks reliably |
| Day 3-4 | Move training to BullMQ job | Removes request timeout risk |
| Day 5 | Qdrant integration | Scales to millions of chunks |
| Day 6 | Async retrain queue | Parallel document processing |
| Day 7 | Cleanup cron job | Manage temporary knowledge lifecycle |
