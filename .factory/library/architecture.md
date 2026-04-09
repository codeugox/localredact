# Architecture — Local Redact V1.0

How the system works: components, relationships, data flows, invariants.

---

## 1. System Overview

Local Redact is a browser-only PDF redaction tool. The user drops a PDF, the app detects PII using regex-based pattern matching against a text index built from PDF.js, presents an interactive review screen, and burns redactions permanently into a rasterised output PDF. No data ever leaves the browser tab — there is no server, no analytics, and no persistent storage.

---

## 2. Tech Stack

| Library | Version | Role |
|---|---|---|
| **pdfjs-dist** | 5.5.207 | Load PDFs, extract text items with geometry, rasterise pages to canvas. Ships own TS types; no `@types` package needed. |
| **jsPDF** | 2.5.2 | Assemble final output PDF from per-page canvas images. Chosen over pdf-lib (unmaintained). |
| **Preact** | 10.25.4 | UI rendering — 3 KB gzipped, React-compatible JSX API. |
| **@preact/signals** | 2.0.2 | Fine-grained reactive state without full re-renders. |
| **Vite** | 6.3.2 | Dev server and production bundler. Uses `@preact/preset-vite` for JSX transform. |
| **Vitest** | 3.1.1 | Unit and integration tests (jsdom environment). |
| **TypeScript** | 5.8.3 | Type safety across all layers. |

All runtime dependencies are actively maintained. `pdfjs-dist` is excluded from Vite's `optimizeDeps` so its Web Worker resolves correctly in dev and production.

---

## 3. Architecture Layers

```
┌──────────────────────────────────┐
│          UI (Preact)             │  Components + Signals state
│  src/components/  src/app/       │  Only layer that imports Preact
├──────────────────────────────────┤
│          Core                    │  Framework-agnostic TypeScript
│  src/core/pipeline/              │  Two entry points: detectDocument, redactDocument
│  src/core/detectors/             │  Patterns, entities, merger, confidence
│  src/core/redactor/              │  Rasteriser, burner, repackager
│  src/core/pdf/                   │  PDF.js loader, worker setup, cleanup
│  src/core/text-index.ts          │  Normalised text + char→item mapping
├──────────────────────────────────┤
│          Utils                   │  Framework-agnostic helpers
│  src/utils/coords.ts             │  Quad ↔ canvas transforms
│  src/utils/filename.ts           │  Output filename generation
└──────────────────────────────────┘
```

**Rule:** Core and Utils never import Preact. The UI layer calls exactly two Core functions (`detectDocument`, `redactDocument`) and reads their return values through signals.

---

## 4. Data Flow

The complete pipeline, from file drop to download:

```
File (user drops PDF)
  │
  ▼
Load ── loader.ts opens via PDF.js, handles password prompt
  │
  ▼
Index ── text-index.ts builds normalised page string + char→item map
  │       per page (handles multi-item spans, synthetic whitespace)
  │
  ▼
Detect ── patterns.ts runs value-only regex on normalised string
  │        confidence.ts scores each match using context proximity
  │
  ▼
Merge ── merger.ts deduplicates overlapping spans, resolves quads
  │
  ▼
Preview ── DocumentViewer renders page at 1.5× scale,
  │         SVG overlay draws highlight groups per entity
  │
  ▼
Review ── user clicks highlights to toggle REDACT / KEEP / UNCERTAIN
  │        SummaryPanel shows live counts, FooterBar tracks resolution
  │
  ▼
Burn ── rasteriser.ts renders each page at 300 DPI (~4.17× scale),
  │      burner.ts fills quad polygons in black on the canvas
  │      (one page at a time — render → burn → embed → release)
  │
  ▼
Repackage ── repackager.ts creates output PDF via jsPDF,
  │           embeds each canvas as PNG, sets page dimensions in pt,
  │           strips metadata
  │
  ▼
Download ── blob URL trigger, then full memory cleanup
```

The pipeline is split into two orchestrators in `src/core/pipeline/`:

- **`detectDocument(file, mode, onProgress, onPassword)`** → `{ entities, pages }`
- **`redactDocument(file, entities, onProgress)`** → `Blob`

These are the only functions the UI calls into Core.

---

## 5. Key Types

Defined in `src/core/detectors/entities.ts`:

```typescript
type EntityType =
  | 'SSN' | 'CREDIT_CARD' | 'BANK_ACCOUNT' | 'ROUTING_NUMBER'
  | 'EIN' | 'PHONE' | 'EMAIL' | 'ADDRESS'
  | 'DATE_OF_BIRTH' | 'PASSPORT' | 'DRIVERS_LICENSE'
  | 'ZIP_CODE' | 'FULL_NAME'
  // ... (all PII categories)

// Four corners in PDF coordinate space (8 numbers)
type Quad = [number, number, number, number, number, number, number, number]

interface DetectedEntity {
  id: string
  type: EntityType
  text: string
  confidence: number
  decision: 'REDACT' | 'KEEP' | 'UNCERTAIN'
  page: number                                // 1-indexed
  textOffset: { start: number; end: number }  // in normalised page string
  quads: Quad[]                               // one or more quads in PDF space
}
```

Defined in `src/core/text-index.ts`:

```typescript
interface IndexedPage {
  pageNum: number
  text: string               // normalised full-page string
  charMap: CharMapEntry[]    // maps char ranges → source PDF.js items
  items: TextItem[]
  viewport: { width: number; height: number }
}
```

App-level state enum (in `src/app/state.ts`):

```typescript
type AppState = 'IDLE' | 'LOADING' | 'NEEDS_REVIEW' | 'PROCESSING' | 'DONE'
```

---

## 6. State Management

All app state lives in Preact Signals in `src/app/state.ts`. Components read signals directly — no prop drilling, no context boilerplate.

```
Signals:  appState, entities, currentPage, totalPages, progress, error, ...
Computed: uncertainCount, redactCount, keepCount (derived from entities)
Dispatch: dispatch(event) applies state transitions
```

**State machine:**

```
IDLE ──(file dropped)──▶ LOADING ──(detection done)──▶ NEEDS_REVIEW
                                                            │
                         DONE ◀──(burn complete)── PROCESSING
                           │                            ▲
                           │                     (user confirms)
                      (start over)──▶ IDLE
```

`App.tsx` is a thin shell: it reads `appState` and renders the corresponding screen component. All logic stays in `state.ts` (unit-testable without a DOM).

---

## 7. Coordinate System

PDF.js uses a coordinate system where the origin is bottom-left with Y pointing up. Canvas/SVG use top-left origin with Y pointing down. All entity geometry is stored as **Quad[]** in PDF space and transformed to canvas space only at render time.

**Transform rule:** Use `viewport.convertToViewportPoint([pdfX, pdfY])` for every corner. This handles rotation, scale, and origin flip correctly. Never do manual coordinate math.

**Quad → SVG overlay:** Convert each quad to an axis-aligned bounding rect via `quadToRect()` (with 1–2 px padding to prevent glyph edge leaks). Each entity renders as a `<g>` group containing one `<rect>` per quad.

**Quad → final burn:** Fill the actual quad polygon on canvas (`moveTo` / `lineTo` / `closePath` / `fill`). This handles rotated text correctly.

---

## 8. Text Index Layer

PDF.js gives us an array of `TextItem` objects per page — each with `.str`, `.transform`, `.width`, `.height`. A single regex match (e.g., a street address) can span multiple items. The text index solves the mapping problem.

**How it works:**

1. Concatenate all `item.str` values into one normalised page string
2. Insert synthetic spaces (based on x-gap between items) and newlines (based on y-position changes)
3. Record a `charMap`: each entry maps a range in the normalised string back to a specific item and sub-item character range

**Why this exists:** Regex runs against the normalised string. When a match is found at `[start, end]`, the charMap resolves it back to one or more source items, which provide PDF-space geometry for quads. This supports partial-item matches (e.g., only the number in `"SSN: 123-45-6789"`), multi-item single-line spans, and multi-line spans.

**Edge cases handled:** Reading order (cluster by y, sort by x), `hasEOL` flag, duplicate/overlapping items, and `disableNormalization: true` to prevent offset drift.

---

## 9. Detection Strategy

Detection uses **value-only regex + context scoring**, not label-inclusive patterns. This ensures redaction covers only the sensitive value, not surrounding labels.

**Pattern:**

1. A value regex matches the bare data (e.g., `\b\d{8,17}\b` for bank accounts)
2. A context regex checks for labels within 80 characters before the match (e.g., `account number:`)
3. If context is found → high confidence (0.90–0.95). If no context → discard or low confidence depending on type

**Confidence thresholds determine default decisions:**

- High confidence (≥ 0.90) → default `REDACT`
- Medium confidence (0.70–0.89) → default `UNCERTAIN` (user must resolve)
- Low confidence (< 0.70) → default `KEEP`

**Modes:**

- **Identity-only** — detects SSN, name, DOB, driver's license, passport
- **Full redaction** — all PII categories (financial, contact, identity)

All credit card matches require Luhn validation. All patterns are unit-tested with explicit PASS/FAIL cases.

---

## 10. Rendering Pipeline

Two render scales serve different purposes:

| Stage | Scale | DPI | Purpose |
|---|---|---|---|
| Preview | 1.5× | ~108 | Fast in-browser preview with SVG overlay |
| Final burn | ~4.17× | 300 | Production-quality redacted output |

**Final burn is sequential, one page at a time:**

```
for each page:
  render to canvas at 300 DPI       (~33 MB RGBA for letter)
  burn black quad polygons
  embed canvas as PNG into jsPDF
  release canvas (set width = 0)    → frees GPU memory
  call page.cleanup()               → frees PDF.js internal data
  → next page
```

**Memory rules:**
- Never hold more than one 300 DPI canvas in memory
- Letter at 300 DPI = 2550 × 3300 px = ~33 MB — safe on all browsers
- If canvas creation fails, retry at 240 DPI with a user-visible warning
- Preview: only the current page is at full preview resolution; thumbnails use 0.2× scale

---

## 11. Output Assembly

The repackager uses jsPDF to build the output PDF:

```typescript
new jsPDF({ unit: 'pt', format: [pageWidthPt, pageHeightPt], compress: true })
```

**Per-page pattern:**
1. `doc.addPage([w, h], orientation)` — each page matches source dimensions
2. `doc.addImage(canvas, 'PNG', 0, 0, w, h)` — canvas fills entire page, PNG for lossless fidelity
3. After all pages: `doc.setProperties({ title: 'Redacted Document', creator: '', ... })`
4. Output as `Blob` via `doc.output('blob')`

**Key details:**
- Use `unit: 'pt'` so page dimensions match PDF coordinate space exactly
- Use PNG (not JPEG) — JPEG artifacts could reveal redacted content edges
- jsPDF hard-codes a `/Producer` field; this is acceptable (we're hiding document PII, not the tool)
- Output filename: `[original]-redacted.pdf`
- The output PDF has no text layer — it is a rasterised image PDF

---

## 12. Security Model

**Zero-server architecture.** After the initial page load, no network requests occur.

**Enforced via CSP:**
```
connect-src 'none';   ← makes outbound requests technically impossible
script-src 'self';    ← no inline scripts, no third-party JS
object-src 'none';    ← no plugins
frame-ancestors 'none'; ← no embedding
```

**No persistent storage.** The app never writes to localStorage, sessionStorage, IndexedDB, or Cache Storage. Document bytes, text, entities, and passwords exist only in memory.

**Full cleanup on completion and "Start Over":**
- `pdf.destroy()` → terminates PDF.js worker
- All canvases set to `width = 0` → releases GPU memory
- All `URL.revokeObjectURL()` calls made
- Entity arrays, normalised text, file references, and password strings cleared

**No third-party code.** No analytics, tracking pixels, external fonts, or CDN resources. System font stack only.

**Input validation:**
- File type check (`application/pdf`) before processing
- 50 MB size limit before reading into memory
- All PDF.js calls wrapped in try/catch — stack traces never shown to user

**Out of scope:** Browser extensions, local malware, managed-device monitoring, and screenshots are outside the app's threat model and are not claimed against.
