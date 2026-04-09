# Architecture Revisions (Supersedes Earlier Docs)

**App Name: Local Redact**

Read this file first. It overrides specific sections of docs 01–07.
If something in this file contradicts an earlier doc, this file wins.

All references to `[AppName]` in earlier docs resolve to **Local Redact**.

---

## Revision 1 — Text Index Layer (NEW)

**Problem:** The original architecture assumes regex matches map cleanly to
PDF.js text items. They don't. A single regex match like a street address
spans multiple PDF.js text items, and there is no documented strategy for
mapping character offsets back to bounding geometry.

**Solution:** Add a text index layer between PDF.js extraction and detection.

### Pipeline

```
PDF.js extracts text items per page
        ↓
Text indexer builds a normalized page string
  - concatenates item.str values
  - inserts synthetic spaces based on x-gap between items
  - inserts synthetic newlines based on y-position changes
  - records a mapping: char range → source item(s)
        ↓
Regex runs on the normalized string
        ↓
Each match's char range maps back to one or more source items
        ↓
Source items provide PDF-space geometry → quads
```

### New File

```
src/core/text-index.ts
```

Exports:

```typescript
interface TextItem {
  str: string
  transform: number[]    // 6-element PDF transform matrix
  width: number
  height: number
  hasEOL: boolean
}

// Each entry maps a range in the normalized string back to a specific
// substring within a specific PDF.js text item. This supports partial-item
// matches (e.g., "SSN: 123-45-6789" where only "123-45-6789" should redact).
interface CharMapEntry {
  normStart: number       // start index in normalized page string
  normEnd: number         // end index in normalized page string
  itemIndex: number | null // null for synthetic whitespace/newlines
  itemCharStart?: number  // start index within item.str
  itemCharEnd?: number    // end index within item.str
}

interface IndexedPage {
  pageNum: number
  text: string                    // normalized full-page string
  charMap: CharMapEntry[]         // per-segment mapping (not per-item)
  items: TextItem[]
  viewport: { width: number; height: number }
}

function indexPage(items: TextItem[], viewport: Viewport): IndexedPage
function resolveMatchToQuads(
  match: { start: number; end: number },
  page: IndexedPage
): Quad[]
```

### Indexer Edge Cases to Handle

1. **Substring within one item** — A single PDF.js item like
   `"SSN: 123-45-6789"` must allow redacting only `"123-45-6789"`.
   The charMap tracks sub-item char ranges so the resolver can compute
   a proportional sub-quad (using item width × char fraction).
2. **Synthetic whitespace** — Spaces/newlines inserted between items
   have `itemIndex: null` and produce no geometry.
3. **Reading order** — For tables and multi-column layouts, cluster items
   by y-position (with tolerance), then sort by x within each line.
4. **`hasEOL`** — Use PDF.js `hasEOL` flag when available rather than
   relying solely on y-position gaps.
5. **Duplicate/overlapping items** — Some PDFs contain duplicate text
   items at the same position. Deduplicate by position before indexing.
6. **PDF.js normalization** — Use `getTextContent({ disableNormalization: true })`
   to prevent offset drift, then normalize manually while preserving the map.

This replaces the simple `pdf-text.ts` text extraction helper.

---

## Revision 2 — Quad-Based Geometry (Replaces BoundingBox)

**Problem:** A single axis-aligned rectangle cannot represent multi-word
spans, multi-line addresses, or rotated text.

**Solution:** Replace `BoundingBox` with `Quad[]` stored in PDF coordinate
space. Transform to canvas/SVG space only at render time.

### Updated Type Definitions

```typescript
// Replaces BoundingBox in entities.ts

// 8 numbers: x1,y1 x2,y2 x3,y3 x4,y4 (four corners, PDF space)
export type Quad = [number, number, number, number, number, number, number, number]

export interface DetectedEntity {
  id: string
  type: EntityType
  text: string
  layer: DetectionLayer
  confidence: number
  decision: RedactionDecision
  page: number                                // 1-indexed (detection is page-local)
  textOffset: { start: number; end: number }  // in normalized page string
  quads: Quad[]                               // one or more quads in PDF space
}
```

### Coordinate Transform

Use the full 6-element PDF transform matrix, not the simplified x/y formula.

```typescript
// src/utils/coords.ts

// Convert a PDF-space quad to canvas-pixel-space quad
export function quadToCanvas(
  quad: Quad,
  viewport: PDFPageViewport
): Quad {
  // Use viewport.convertToViewportPoint for each corner
  // This handles rotation, scale, and origin flip correctly
}

// Convert a quad to an axis-aligned bounding rect for SVG overlay
export function quadToRect(quad: Quad): { x: number; y: number; width: number; height: number } {
  // Take the bounding box of all 4 corners
  // Add 1-2px padding to prevent glyph edge leaks
}
```

PDF.js `viewport.convertToViewportPoint([pdfX, pdfY])` handles the full
transform matrix correctly. Use it instead of manual math.

### SVG Overlay Update

Each entity may produce multiple `<rect>` elements (one per quad) in the
SVG overlay, grouped by entity ID. Click/hover handlers attach to the group.

```html
<g data-entity-id={entity.id} data-decision={entity.decision}>
  <rect x=... y=... width=... height=... />
  <rect x=... y=... width=... height=... />  <!-- multi-line -->
</g>
```

### Burner: Use Quad Polygons for Final Output

For the preview SVG overlay, axis-aligned rects (from `quadToRect`) are fine.
For the final burn step, fill the actual quad as a polygon to handle rotated text:

```typescript
// In burner.ts — for each quad on the final canvas
ctx.beginPath()
ctx.moveTo(x1, y1)
ctx.lineTo(x2, y2)
ctx.lineTo(x3, y3)
ctx.lineTo(x4, y4)
ctx.closePath()
ctx.fillStyle = '#000'
ctx.fill()
```

---

## Revision 3 — Use Preact (Replaces Vanilla TS)

**Problem:** The preview screen has SVG overlays, tooltips, a live summary
panel, page navigation with thumbnails, keyboard shortcuts, and a state
machine. Vanilla DOM manipulation for this is error-prone and produces
more code than a lightweight framework.

**Solution:** Use Preact + Preact Signals.

```
Preact        ~3KB gzipped, React-compatible API
Signals       fine-grained reactivity, no re-render overhead
```

### What Changes

| Before (Vanilla) | After (Preact) |
|---|---|
| Manual `document.createElement` | JSX components |
| Manual event binding | Declarative event handlers |
| Manual DOM updates on state change | Signal-driven reactive rendering |
| State machine in imperative code | State machine in a signal/reducer |
| CSS class swaps via `setAttribute` | Conditional class names in JSX |

### Package Addition

```json
{
  "dependencies": {
    "preact": "10.25.x"
  }
}
```

### Vite Config Addition

```typescript
// vite.config.ts
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  // ... rest unchanged
})
```

### Component Structure

```
src/
  app/
    state.ts               signals, computed values, dispatch (unit-testable)
  components/
    App.tsx                 root component, thin shell
    DropScreen.tsx          file input
    ProcessingScreen.tsx    progress bar
    PreviewScreen.tsx       main layout
    DocumentViewer.tsx      canvas + SVG overlay
    HighlightGroup.tsx      SVG group per entity
    SummaryPanel.tsx        left panel
    PageNav.tsx             page navigation + thumbnails
    EntityTooltip.tsx       hover tooltip
    FooterBar.tsx           action button
    PasswordModal.tsx       password prompt
    DoneScreen.tsx          download confirmation
    ErrorMessage.tsx        error display
  core/                    unchanged — framework-agnostic
    pdf/
      loader.ts            PDF.js loading, worker setup, password, cleanup
    pipeline/
      detect-document.ts   orchestrates load → index → detect → merge
      redact-document.ts   orchestrates render → burn → repackage
  utils/                   unchanged — framework-agnostic
  styles/
    app.css                all styles (highlight states, layout, screens)
  main.tsx                 entry point, renders <App />
```

The `/core` and `/utils` directories remain framework-agnostic TypeScript.
Only `/components` uses Preact.

### File Extension

Preact components use `.tsx`. Core logic uses `.ts`.

---

## Revision 4 — Updated Package Versions

**Problem:** Pinned versions in doc 07 are from 2024 and several are stale
or deprecated.

### V1.0 Dependencies

```json
{
  "dependencies": {
    "pdfjs-dist": "5.5.207",
    "jspdf": "2.5.2",
    "preact": "10.25.4",
    "@preact/signals": "2.0.2"
  },
  "devDependencies": {
    "vite": "6.3.2",
    "@preact/preset-vite": "2.9.4",
    "typescript": "5.8.3",
    "vitest": "3.1.1",
    "jsdom": "26.0.0",
    "@types/node": "22.14.0"
  }
}
```

### Notes

- **pdfjs-dist 5.x** has breaking changes from 4.x:
  - Worker setup: use `pdf.worker.min.mjs` (not `.js`)
  - `TextItem` type access may differ — verify during implementation
  - `@types/pdfjs-dist` may not be needed; 5.x ships its own types
- **jsPDF 2.5.2** replaces pdf-lib. Actively maintained (last release
  March 2026). Handles our use case: create pages with custom dimensions,
  embed JPEG/PNG images, output as blob. Eliminates unmaintained-dependency risk.
- **Vite 6.x** is the current stable line. 
  Check that `optimizeDeps.exclude: ['pdfjs-dist']` still applies.
- **@xenova/transformers is deprecated.** For V1.1, use
  `@huggingface/transformers` (3.x stable, 4.x preview).
  Do not install until V1.1.
- **Workbox removed from V1.0.** See Revision 6.

---

## Revision 5 — Two-Pass Render Quality

**Problem:** The original doc specifies 2x scale (~144 DPI) for
rasterization. This is insufficient for compliance-grade output where
300 DPI is expected.

**Solution:** Use different scales for preview and final output.

### Preview Rendering

```
Scale: 1.5x (~108 DPI)
Purpose: fast visual preview in the browser
All pages can be rendered — lightweight enough for multi-page docs
```

### Final Redaction Output

```
Scale: ~4.17x (300 DPI for letter-size)
Purpose: production-quality redacted PDF
Processed one page at a time to manage memory:

  for each page:
    render to canvas at 300 DPI
    burn redaction rectangles
    export as PNG blob
    embed into output PDF via pdf-lib
    release canvas and blob from memory
    continue to next page
```

### Memory Management

Letter page at 300 DPI = 2550 × 3300 pixels = ~33MB uncompressed RGBA.
This is within browser canvas limits for a single page.

Never hold more than one full-resolution canvas in memory at a time.
Process sequentially: render → burn → embed → release → next.

### Fallback

If canvas creation fails (memory limit), retry at 240 DPI with a
user-visible warning:

```
⚠ Reduced output quality due to memory constraints.
  The redaction is still complete and irreversible.
```

---

## Revision 6 — No Service Worker in V1.0

**Problem:** V1.0 has no model to cache and no offline requirement.
Service Worker adds development complexity and stale-cache debugging
issues with no user benefit.

**Solution:** Remove all Workbox dependencies and Service Worker setup
from V1.0 scope.

### Removed from V1.0

```
workbox-window
workbox-routing
workbox-strategies
workbox-cacheable-response
sw.ts
```

### When to Add

V1.1 — when the ONNX model needs persistent caching.
Use `vite-plugin-pwa` instead of hand-rolling Workbox modules.

```json
// V1.1 addition
{
  "devDependencies": {
    "vite-plugin-pwa": "1.x"
  }
}
```

---

## Revision 7 — Tightened Privacy Claims

**Problem:** "Nothing leaves the browser tab" is too absolute. Browser
extensions, local malware, and managed-device software can read page
content. The claim should be accurate without being misleading.

### Updated Copy

**Drop screen (below drop zone):**
```
🔒 Your document is processed locally and is never uploaded by this app.
```

**Preview screen (left panel):**
```
🔒 All processing happens in your browser. Nothing is uploaded.
```

**Done screen:**
```
🔒 Your document was processed entirely on your device.
   No data was sent to any server.
```

### Security Guardrails (Implementation)

- No analytics scripts. No tracking pixels. No third-party fonts.
- No `fetch()` or `XMLHttpRequest` after initial page load (verifiable
  in Network tab).
- Strict Content Security Policy header:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'none'
  ```
  `connect-src: 'none'` makes it technically impossible for app code
  to make network requests after load.
- Revoke all `URL.createObjectURL()` references after download.
- Clear canvas contexts after redaction completes.
- Terminate any Web Workers after processing.

### What We Do NOT Claim

We do not claim protection against:
- Browser extensions that read page content
- Local malware or keyloggers
- Managed device monitoring software
- Screenshots

These are outside the app's control and outside the threat model.

---

## Revision 8 — Context-Sensitive Regex: Separate Value from Label

**Problem:** Several regex patterns (BANK_ACCOUNT, ROUTING_NUMBER, EIN,
DATE_OF_BIRTH, ZIP_CODE, PASSPORT) include context labels in the match.
With quad-based redaction, this would black out "Account Number:" along
with the actual account number.

**Solution:** Split detection into value match + context scoring.

### Pattern

```typescript
// Example: BANK_ACCOUNT
// OLD — matches label + value as one span (bad)
// /\b(?:account\s*(?:number|#|no\.?)?:?\s*)\d{8,17}\b/gi

// NEW — match only the value
export const BANK_ACCOUNT_VALUE = /\b\d{8,17}\b/g

// Context check — run separately to boost confidence
export const BANK_ACCOUNT_CONTEXT =
  /(?:account\s*(?:number|#|no\.?)?:?\s*)/gi

// Detection logic:
// 1. Find value match
// 2. Check if context label appears within N chars before the match
// 3. If context found → confidence 0.95
// 4. If no context → discard (too many false positives for raw 8-17 digit numbers)
```

Apply this pattern to all context-dependent detectors:
- **BANK_ACCOUNT** — value only, require context label
- **ROUTING_NUMBER** — value only, context boosts confidence
- **EIN** — value only, context boosts confidence
- **DATE_OF_BIRTH** — value only, "DOB"/"Date of Birth" context determines REDACT vs KEEP
- **ZIP_CODE** — value only, state abbreviation context boosts confidence
- **PASSPORT** — value only, "Passport" context boosts confidence

### Context Window

Check for context labels within 80 characters before the value match
start position in the normalized page string. This accommodates labels
that may be on the previous line (separated by synthetic newline).

### Credit Card Pattern Fix

Update the credit card regex to handle:
- Amex (15 digits, different grouping)
- Mastercard 2-series (2221–2720)

```typescript
export const CREDIT_CARD =
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|2(?:2[2-9][1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[01][0-9]|720)[0-9]{12}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g
```

All matches still require Luhn validation.

---

## Revision 9 — PDF Loader Module (NEW)

**Problem:** There is no clear owner for PDF.js document loading, worker
setup, password handling, and cleanup.

**Solution:** Add `src/core/pdf/loader.ts`.

```typescript
// src/core/pdf/loader.ts

import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

export interface LoadResult {
  pdf: PDFDocumentProxy
  numPages: number
}

export async function loadPDF(
  file: File,
  onPassword?: () => Promise<string>
): Promise<LoadResult>

export async function destroyPDF(pdf: PDFDocumentProxy): Promise<void>
```

Password handling uses `loadingTask.onPassword` callback (cleaner than
catch/retry). The `onPassword` callback prompts the user via the UI and
returns the entered password.

---

## Revision 10 — Pipeline Orchestration (NEW)

**Problem:** Without explicit pipeline modules, `App.tsx` will become a
monolithic controller mixing UI and business logic.

**Solution:** Add framework-agnostic pipeline modules.

```
src/core/pipeline/
  detect-document.ts    loads PDF, indexes pages, runs patterns, returns entities
  redact-document.ts    takes entities + PDF, renders/burns/repackages, returns blob
```

```typescript
// src/core/pipeline/detect-document.ts
export async function detectDocument(
  file: File,
  mode: RedactionMode,
  onProgress: (page: number, total: number) => void,
  onPassword: () => Promise<string>
): Promise<{ entities: DetectedEntity[]; pages: IndexedPage[] }>

// src/core/pipeline/redact-document.ts
export async function redactDocument(
  file: File,
  entities: DetectedEntity[],  // only those with decision === 'REDACT'
  onProgress: (page: number, total: number) => void
): Promise<Blob>
```

These are the only two functions the UI calls. Everything else is internal.

---

## Revision 11 — State Management (NEW)

**Problem:** App state should be unit-testable separately from Preact
components.

**Solution:** Extract state to `src/app/state.ts` using Preact Signals.

```typescript
// src/app/state.ts
import { signal, computed } from '@preact/signals'

export const appState = signal<AppState>('IDLE')
export const entities = signal<DetectedEntity[]>([])
export const currentPage = signal(1)
export const totalPages = signal(0)
// ... etc

export const uncertainCount = computed(() =>
  entities.value.filter(e => e.decision === 'UNCERTAIN').length
)

export function dispatch(event: AppEvent): void {
  // state transitions
}
```

This keeps `App.tsx` as a thin shell that reads signals and renders
the appropriate screen.

---

## Revision 12 — Security: No Document Storage

Explicitly: the app must never write document content to any persistent
browser storage.

**Prohibited:**
- `localStorage` — no document bytes, text, entities, or passwords
- `sessionStorage` — same
- `IndexedDB` — same
- `Cache Storage` — no document-derived data (V1.0 has no Service Worker)

**On "Start Over" and after download, clear:**
- File references and ArrayBuffers
- Normalized text strings
- Entity arrays
- Password strings
- Canvas contexts (set width=0 to release memory)
- Object URLs (via `URL.revokeObjectURL`)

---

## Revision 13 — Expanded CSP

Update the Content-Security-Policy to:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  connect-src 'none';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
  worker-src 'self'
```

Note: GitHub Pages cannot set custom headers. These must be set via
Cloudflare Transform Rules (Modify Response Headers) for production.
Document the exact Cloudflare rule in the deploy checklist.

---

## Revision 14 — Remove COOP/COEP from V1.0

**Problem:** `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`
are only needed for `SharedArrayBuffer` (Tesseract.js in V1.2). In V1.0
they serve no purpose and create a dev/prod mismatch since GitHub Pages
cannot set them.

**Solution:** Remove from Vite dev server config. Re-add in V1.2 with
matching Cloudflare production headers.

---

## Revision 15 — OWASP Client-Side Security

The OWASP Server-Side Top 10 does not apply (no backend). The **OWASP
Client-Side Top 10** is the relevant standard.

### Applicable Risks and Mitigations

**DOM-based XSS (#2)**
- Never use `dangerouslySetInnerHTML` in Preact components.
- Preact auto-escapes JSX expressions. All user-derived strings (filenames,
  entity text, error messages) render via JSX, never raw innerHTML.
- Do not construct HTML strings from user input.

**Sensitive Data Leakage (#3)**
- No analytics, tracking pixels, or third-party scripts (see Rev 7).
- CSP `connect-src 'none'` prevents any outbound requests.
- No external fonts — use system font stack only.

**Vulnerable and Outdated Components (#4)**
- Pin exact dependency versions (see Rev 4).
- Run `npm audit` before every release.
- All runtime dependencies (pdfjs-dist, jspdf, preact) are actively maintained.

**Sensitive Data Stored Client-Side (#7)**
- See Rev 12: no localStorage, sessionStorage, or IndexedDB for any
  document-derived data.

**Not Using Browser Security Controls (#9)**
- CSP header (see Rev 13).
- Add to Cloudflare response headers:
  ```
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  ```

**Malicious PDF Input Validation**
- Validate `file.type === 'application/pdf'` before processing.
- Enforce 50MB file size limit before reading into memory.
- Wrap all PDF.js calls in try/catch — never expose stack traces to UI.
- PDF.js runs in a Web Worker by default, providing some isolation.

---

## Revision 16 — Memory Management

Explicit rules for managing memory during PDF processing.

### Memory Budget (Approximate)

```
Input PDF ArrayBuffer          up to 50MB
PDF.js document proxy          ~10-30MB (internal structures)
Preview canvas (1.5x, letter)  ~8MB RGBA per page
Final canvas (300 DPI, letter) ~33MB RGBA per page
Thumbnail canvas (0.2x)        ~0.2MB per page
Output PDF blob                varies (PNG-compressed pages)
```

### Rules

1. **One full-resolution canvas at a time.**
   During final redaction, render page N → burn → embed into PDF →
   set canvas.width = 0 → move to page N+1.
   Never hold multiple 300 DPI canvases simultaneously.

2. **Release the input ArrayBuffer after PDF.js loads.**
   ```typescript
   const arrayBuffer = await file.arrayBuffer()
   const pdf = await getDocument({ data: arrayBuffer }).promise
   // arrayBuffer is now copied into PDF.js worker memory
   // let it fall out of scope — do not retain a reference
   ```

3. **Call page.cleanup() after each page is processed.**
   This releases internal rendering data for that page.

4. **Call pdf.destroy() when processing is complete.**
   This terminates the PDF.js worker and releases all document memory.

5. **Release canvas memory explicitly.**
   Setting `canvas.width = 0` or `canvas.height = 0` triggers immediate
   GPU memory release in most browsers (more reliable than waiting for GC).

6. **Revoke object URLs immediately after use.**
   ```typescript
   const url = URL.createObjectURL(blob)
   triggerDownload(url)
   URL.revokeObjectURL(url)
   ```

7. **Preview: only render the current page at full preview resolution.**
   Thumbnail strip uses 0.2x scale canvases (~0.2MB each).
   When navigating pages, release the previous page's preview canvas
   before rendering the new one.

8. **On "Start Over" — full cleanup.**
   - pdf.destroy()
   - All canvas.width = 0
   - All URL.revokeObjectURL()
   - entities signal reset to []
   - Normalized text arrays cleared
   - File reference released
   - Password string set to empty

9. **Memory pressure fallback.**
   If canvas creation throws (browser memory limit), catch the error
   and retry at 240 DPI with a user-visible warning.

### Canvas Size Limits by Browser

```
Chrome:  16384 × 16384 pixels (268 megapixels)
Firefox: 11180 × 11180 pixels (124 megapixels)
Safari:  4096 × 4096 pixels  (16 megapixels, iOS)
         16384 × 16384        (macOS Safari)

Letter at 300 DPI: 2550 × 3300 = 8.4 megapixels — safe everywhere.
Letter at 600 DPI: 5100 × 6600 = 33.7 megapixels — may fail on iOS Safari.
```

300 DPI is the maximum safe target for cross-browser compatibility.

---

## Revised Vite Configuration

Replaces the config in doc 07.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  base: './',

  plugins: [preact()],

  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },

  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          jspdf: ['jspdf'],
        },
      },
    },
  },

  worker: {
    format: 'es',
  },
})
```

---

## Revised Repository Structure

Replaces the structure in doc 01.

```
/repo-root
  /src
    /app
      state.ts              signals, computed, dispatch (unit-testable)
    /core
      /detectors
        patterns.ts         all regex patterns, named exports
        entities.ts         EntityType, DetectedEntity, Quad, all type defs
        merger.ts           dedup and merge overlapping spans
        confidence.ts       confidence scoring and thresholds
      /redactor
        rasterizer.ts       PDF page to canvas at target DPI
        burner.ts           draw black quads (polygon fill) on canvas
        repackager.ts       canvas images to output PDF via jsPDF
      /modes
        identity-only.ts    mode config, decision defaults
        full-redaction.ts   mode config, decision defaults
      /pdf
        loader.ts           PDF.js loading, worker, password, cleanup
      /pipeline
        detect-document.ts  orchestrates load → index → detect → merge
        redact-document.ts  orchestrates render → burn → repackage
      text-index.ts         normalized text builder + char-to-quad mapping
    /components
      App.tsx               root shell (Preact)
      DropScreen.tsx
      ProcessingScreen.tsx
      PreviewScreen.tsx
      DocumentViewer.tsx    canvas + SVG overlay
      HighlightGroup.tsx    SVG group per entity (multi-quad)
      SummaryPanel.tsx
      PageNav.tsx
      EntityTooltip.tsx
      FooterBar.tsx
      PasswordModal.tsx
      DoneScreen.tsx
      ErrorMessage.tsx
    /utils
      coords.ts             quad transforms, PDF→canvas conversion
      filename.ts           output filename generation
    /styles
      app.css               all styles
    main.tsx                entry point, renders <App />
  /public
  /tests
    /unit
      patterns.test.ts
      merger.test.ts
      confidence.test.ts
      luhn.test.ts
      coords.test.ts
      text-index.test.ts
      state.test.ts
    /integration
      detection.test.ts
      redaction.test.ts
  index.html
  vite.config.ts
  tsconfig.json
  vitest.config.ts
  .github/
    workflows/
      deploy.yml
  README.md
  CHANGELOG.md
```

---

## Revised File Creation Order

Replaces the order in doc 07.

```
Phase 0 — Project Bootstrap
 0a. package.json                            dependencies locked
 0b. vite.config.ts                          build config
 0c. tsconfig.json                           TS config
 0d. vitest.config.ts                        test config (jsdom environment)
 0e. index.html                              HTML shell
 0f. src/main.tsx                            minimal entry point (renders "hello")
     → verify: npm run dev starts without errors

Phase 1 — Core Detection Engine
 1.  src/core/detectors/entities.ts          type definitions (Quad, DetectedEntity, etc.)
 2.  src/core/detectors/patterns.ts          regex patterns + context-split runner
 3.  src/core/detectors/confidence.ts        thresholds + scoring
 4.  src/core/text-index.ts                  text indexer + char-to-quad resolver
 5.  src/utils/coords.ts                     quad transforms
 6.  tests/unit/patterns.test.ts             all regex tests passing
 7.  tests/unit/coords.test.ts               transform tests passing
 8.  tests/unit/text-index.test.ts           indexer tests (partial-item, multi-item, gaps)
 9.  src/core/detectors/merger.ts            dedup logic
10.  src/core/modes/identity-only.ts         mode defaults
11.  src/core/modes/full-redaction.ts        mode defaults

Phase 2 — PDF Pipeline
12.  src/core/pdf/loader.ts                  PDF.js loading, worker, password
13.  src/core/pipeline/detect-document.ts    orchestrates load → index → detect → merge
14.  tests/integration/detection.test.ts     full pipeline on sample text
15.  src/core/redactor/rasterizer.ts         page to canvas (dual DPI)
16.  src/core/redactor/burner.ts             quad polygon fill on canvas
17.  src/core/redactor/repackager.ts         canvas to PDF via jsPDF
18.  src/core/pipeline/redact-document.ts    orchestrates render → burn → repackage
19.  tests/integration/redaction.test.ts     end-to-end: load PDF → detect → redact → blob

Phase 3 — UI
20.  src/styles/app.css                      all styles
21.  src/app/state.ts                        signals, dispatch, computed values
22.  tests/unit/state.test.ts                state transitions unit tests
23.  src/components/App.tsx                  root shell + screen routing
24.  src/components/DropScreen.tsx           file input
25.  src/components/ProcessingScreen.tsx     progress bar
26.  src/components/DocumentViewer.tsx       canvas + SVG overlay
27.  src/components/HighlightGroup.tsx       multi-quad entity highlight
28.  src/components/SummaryPanel.tsx         left panel
29.  src/components/PageNav.tsx              navigation + thumbnails
30.  src/components/EntityTooltip.tsx        hover tooltip
31.  src/components/FooterBar.tsx            action button
32.  src/components/PreviewScreen.tsx        assembles viewer + panel
33.  src/components/PasswordModal.tsx        password prompt
34.  src/components/DoneScreen.tsx           download confirmation
35.  src/components/ErrorMessage.tsx         error display
36.  src/utils/filename.ts                  output naming

Phase 4 — Polish & Deploy
37.  .github/workflows/deploy.yml           CI/CD
```

---

## Revised Definition of Done — V1.0

Replaces the checklist in doc 07.

```
Detection
[ ] All regex patterns pass their unit tests (every PASS/FAIL case)
[ ] Context-sensitive patterns redact only the value, not the label
[ ] Luhn validation tested against 10+ known valid/invalid cards
[ ] Coordinate transform tested with known input/output pairs
[ ] Merger tested with overlapping and duplicate spans

Text Index
[ ] Partial-item match: value inside "SSN: 123-45-6789" redacts only the number
[ ] Multi-item single-line match: address split across items produces correct quads
[ ] Multi-line match: street + city/state/ZIP resolves to quads on separate lines
[ ] Synthetic whitespace: inserted spaces/newlines produce no geometry
[ ] hasEOL handling: newlines inserted once, not doubled
[ ] Reading order: multi-column layout items sorted correctly
[ ] Duplicate text items: overlapping identical items do not double-detect
[ ] No-text PDF: fails gracefully with expected error message

Pipeline
[ ] Digital PDF (text layer) → index → detect → burn → download
[ ] Output PDF has no text layer (verify in PDF reader)
[ ] Output PDF has no original metadata (producer/creator scrubbed or set to app name)
[ ] Output at 300 DPI — text is sharp and legible
[ ] Output filename is [original]-redacted.pdf
[ ] Password-protected PDF shows password prompt, not crash
[ ] Wrong password shows inline error, retry works
[ ] Memory stays stable on 10+ page documents (sequential processing)
[ ] No-PII document processes without crash or false positives

UI (Preact)
[ ] File drop and browse both work
[ ] Processing screen shows page-by-page progress
[ ] All highlight states render correctly (red, green, yellow)
[ ] Multi-quad highlights render correctly for multi-word spans
[ ] Click toggles decision and updates visuals immediately
[ ] Tooltip appears on hover with correct entity type and text
[ ] Summary panel counts update when entities are toggled
[ ] Page navigation works on multi-page documents
[ ] Footer button shows uncertain count when items unresolved
[ ] Footer button triggers redaction when all resolved
[ ] Done screen confirms download and shows privacy message
[ ] "Start over" clears all state (file refs, text, entities, canvases, URLs)

Security
[ ] No network requests after page load (verify in DevTools)
[ ] No analytics, no third-party scripts, no external fonts
[ ] No document data written to localStorage/sessionStorage/IndexedDB
[ ] Object URLs revoked after download
[ ] Canvas contexts cleared after redaction (width set to 0)
[ ] Password string cleared from memory after use

Infrastructure
[ ] GitHub Actions deploys on push to main
[ ] No console errors on clean load in Chrome, Firefox, Safari
[ ] CSP headers configured in Cloudflare (documented in deploy checklist)
```
