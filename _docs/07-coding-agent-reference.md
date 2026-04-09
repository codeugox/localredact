# Coding Agent Reference

Everything a coding agent needs to know before writing a single line.
Read this file before reading anything else in the repo.

---

## What This Project Is

A browser-based PII redaction tool. Drop a PDF, detect sensitive
information using regex and (later) a local NER model, review
highlighted results, download a new PDF with black bars burned
irreversibly into the pixels. No server. No uploads. Nothing leaves
the browser tab.

Three deployment targets share one TypeScript core:
- V1.0 — static web app, GitHub Pages
- V1.1 — same app + ONNX NER model loaded on demand
- V3.0 — Tauri desktop app wrapping same core (future)

**Current target: V1.0 — browser, regex only, no model.**

---

## Exact Package Versions

Always install exact versions. Do not use `latest`.

```json
{
  "dependencies": {
    "pdfjs-dist": "4.2.67",
    "pdf-lib": "1.17.1",
    "workbox-window": "7.1.0",
    "workbox-routing": "7.1.0",
    "workbox-strategies": "7.1.0",
    "workbox-cacheable-response": "7.1.0"
  },
  "devDependencies": {
    "vite": "5.2.0",
    "typescript": "5.4.5",
    "vitest": "1.6.0",
    "@types/node": "20.12.0"
  }
}
```

Add for V1.1 only — do not install now:
```json
{
  "@xenova/transformers": "2.17.2",
  "tesseract.js": "5.1.0"
}
```

---

## Vite Configuration

WASM and Web Workers require specific Vite config. Get this right
before writing any application code.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',  // Required for GitHub Pages subdirectory deploys

  worker: {
    format: 'es',  // ES module workers — required for Transformers.js
  },

  optimizeDeps: {
    exclude: ['pdfjs-dist'],  // PDF.js must not be pre-bundled
  },

  build: {
    target: 'esnext',  // Required for top-level await in workers
    rollupOptions: {
      output: {
        // Separate chunks for large dependencies
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          pdflib: ['pdf-lib'],
        },
      },
    },
  },

  server: {
    headers: {
      // Required for SharedArrayBuffer (used by Tesseract.js in v1.2)
      // Add now so you don't have to reconfigure later
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

**Why `base: './'`:** GitHub Pages may serve from a subdirectory
(`/appname/`). Relative base ensures assets resolve correctly.

**Why exclude pdfjs-dist:** PDF.js uses dynamic imports internally
that Vite's pre-bundler breaks. Must be excluded.

**Why COOP/COEP headers:** SharedArrayBuffer — required by
Tesseract.js for its WASM memory model — is restricted to
cross-origin isolated contexts. Set these headers now even though
Tesseract.js is a v1.2 feature.

---

## PDF.js Setup — Critical Details

### Worker Setup

PDF.js requires its own worker file. Configure it before any
`getDocument` call:

```typescript
// src/utils/pdf-text.ts
import * as pdfjsLib from 'pdfjs-dist'

// Point to the bundled worker — Vite copies this to dist/
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()
```

If this is missing, PDF.js silently falls back to a fake worker
that blocks the main thread and breaks on large files.

### Text Extraction with Positions

```typescript
export async function extractTextWithPositions(
  file: File
): Promise<PageTextData[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: PageTextData[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.0 })
    const textContent = await page.getTextContent()

    const items = textContent.items
      .filter((item): item is pdfjsLib.TextItem => 'str' in item)
      .map(item => ({
        text: item.str,
        // Transform from PDF space to viewport space
        // PDF origin is bottom-left; viewport origin is top-left
        x: item.transform[4],
        y: viewport.height - item.transform[5],
        width: item.width,
        height: item.height,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
      }))

    pages.push({ pageNum, items, viewport })
  }

  return pages
}
```

### Password-Protected PDFs

```typescript
try {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
} catch (err) {
  if (err instanceof pdfjsLib.PasswordException) {
    if (err.code === pdfjsLib.PasswordResponses.NEED_PASSWORD) {
      // First attempt — show password prompt
      showPasswordModal()
    } else if (err.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD) {
      // Subsequent attempt — wrong password
      showPasswordError()
    }
  } else {
    // Unrelated error — corrupted file, unsupported format
    showGenericError()
  }
}
```

### Page Rendering for Rasterization

```typescript
export async function renderPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  scaleFactor: number = 2.0  // 2x = ~144 DPI, sufficient for redaction
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: scaleFactor })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  return canvas
}
```

**Why scale 2.0 not 4.0:** At 4x, canvas memory usage on a
multi-page document can exceed browser limits and cause silent
failures. 2x is sufficient for pixel-level redaction. 300 DPI
is a goal, not a requirement for visual correctness.

---

## Coordinate Transform — Most Common Bug Source

PDF coordinate space and canvas coordinate space are different.
Getting this wrong produces misaligned redaction bars.

```
PDF space:
  Origin: bottom-left corner
  Y axis: increases upward
  Units:  points (1 point = 1/72 inch)

Canvas space:
  Origin: top-left corner
  Y axis: increases downward
  Units:  pixels at render scale
```

```typescript
// src/utils/coords.ts

export interface PDFCoords {
  x: number       // from left edge, in points
  y: number       // from bottom edge, in points
  width: number   // in points
  height: number  // in points
}

export interface CanvasCoords {
  x: number       // from left edge, in pixels
  y: number       // from top edge, in pixels
  width: number   // in pixels
  height: number  // in pixels
}

export function pdfToCanvas(
  pdf: PDFCoords,
  pageHeight: number,   // page height in points (from viewport at scale 1)
  scale: number         // render scale factor
): CanvasCoords {
  return {
    x: pdf.x * scale,
    y: (pageHeight - pdf.y - pdf.height) * scale,
    width: pdf.width * scale,
    height: pdf.height * scale,
  }
}
```

**Always test this with a known document.** Draw a red border around
the bounding box of a detected SSN and verify it aligns with the
text on the rendered canvas before implementing the actual burn step.

---

## Redaction Pipeline — Exact Order of Operations

Do not change this order. Each step depends on the previous.

```
1. Load PDF into PDF.js
2. Extract text with positions from all pages (page coordinate space)
3. Run regex detection on concatenated text, record char offsets
4. Map char offsets back to PDF items, get PDF-space bounding boxes
5. Transform PDF-space boxes to canvas-space boxes (pdfToCanvas)
6. For each page:
   a. Render page to canvas at scale 2.0
   b. Get 2D context
   c. Set fillStyle = '#000000'
   d. For each REDACT entity on this page:
      fillRect(box.x, box.y, box.width, box.height)
   e. Convert canvas to PNG blob (canvas.toBlob)
7. Assemble PNG blobs into PDF using pdf-lib
8. Trigger download
```

---

## Burning Black Bars — Exact Implementation

```typescript
// src/core/redactor/burner.ts

export function burnRedactions(
  canvas: HTMLCanvasElement,
  entities: DetectedEntity[]  // only entities with decision === 'REDACT'
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D context')

  ctx.fillStyle = '#000000'

  for (const entity of entities) {
    const { x, y, width, height } = entity.boundingBox
    // Add padding so bars extend slightly beyond text bounds
    // Prevents thin slivers of text showing at edges
    const padding = 2
    ctx.fillRect(
      x - padding,
      y - padding,
      width + padding * 2,
      height + padding * 2
    )
  }

  return canvas
}
```

**Do not use `clearRect` then `fillRect`** — this creates a
transparent hole rather than a black bar. Use `fillRect` directly
on the rendered canvas content.

---

## PDF Assembly with pdf-lib

```typescript
// src/core/redactor/repackager.ts
import { PDFDocument } from 'pdf-lib'

export async function assembleRedactedPDF(
  canvases: HTMLCanvasElement[]
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()

  for (const canvas of canvases) {
    // Convert canvas to PNG bytes
    const pngBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    })
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer())

    // Embed in PDF
    const pngImage = await pdfDoc.embedPng(pngBytes)
    const { width, height } = pngImage.scale(1)

    // Add page sized exactly to the image
    const page = pdfDoc.addPage([width, height])
    page.drawImage(pngImage, { x: 0, y: 0, width, height })
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
```

**The output has no text layer** because pdf-lib only embeds PNG
images — there is no step that adds searchable text back. This is
intentional. Do not add a text layer.

---

## Output Filename Generation

```typescript
// src/utils/filename.ts

export function redactedFilename(originalName: string): string {
  // Remove .pdf extension, add -redacted, re-add extension
  const base = originalName.replace(/\.pdf$/i, '')
  return `${base}-redacted.pdf`
}

// Examples:
// "W2_2024.pdf"          → "W2_2024-redacted.pdf"
// "my tax return.pdf"    → "my tax return-redacted.pdf"
// "document"             → "document-redacted.pdf"
```

---

## Download Trigger

```typescript
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after small delay to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
```

**Always revoke the object URL** after the download triggers.
Failing to do so leaks memory, which compounds across multiple
documents in the same session.

---

## Regex Detection Implementation Pattern

```typescript
// src/core/detectors/patterns.ts

export interface RegexMatch {
  text: string
  start: number   // character offset in full page text string
  end: number
  type: EntityType
  confidence: number
}

export function runAllPatterns(text: string): RegexMatch[] {
  const results: RegexMatch[] = []

  // Each pattern runs against the full text string
  // Use exec() in a loop to get all matches with their positions

  const ssnPattern = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g
  let match: RegExpExecArray | null

  while ((match = ssnPattern.exec(text)) !== null) {
    results.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: 'US_SSN',
      confidence: 0.99,
    })
  }

  // Repeat for each pattern...

  return results
}
```

**Always use the `g` flag** on regex patterns and `exec()` in
a loop — not `match()`. `match()` with the `g` flag does not
return index positions. You need the index to map back to
PDF coordinates.

---

## Mapping Text Offsets to PDF Coordinates

After regex returns character offsets in the full text string,
you need to find which PDF text items those characters belong to
and get their coordinates.

```typescript
// src/utils/pdf-text.ts

export function buildTextIndex(
  pages: PageTextData[]
): { text: string; index: TextIndexEntry[] } {
  let fullText = ''
  const index: TextIndexEntry[] = []

  for (const page of pages) {
    for (const item of page.items) {
      index.push({
        start: fullText.length,
        end: fullText.length + item.text.length,
        pageNum: page.pageNum,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        pageHeight: item.pageHeight,
      })
      fullText += item.text + ' '  // space between items
    }
  }

  return { text: fullText, index }
}

export function offsetToBoundingBox(
  start: number,
  end: number,
  index: TextIndexEntry[],
  scale: number
): { pageNum: number; box: CanvasCoords } | null {
  // Find all index entries that overlap with [start, end]
  const overlapping = index.filter(
    entry => entry.start < end && entry.end > start
  )

  if (overlapping.length === 0) return null

  const pageNum = overlapping[0].pageNum

  // Merge bounding boxes of all overlapping entries
  const minX = Math.min(...overlapping.map(e => e.x))
  const minY = Math.min(...overlapping.map(e => e.y))
  const maxX = Math.max(...overlapping.map(e => e.x + e.width))
  const maxY = Math.max(...overlapping.map(e => e.y + e.height))
  const pageHeight = overlapping[0].pageHeight

  return {
    pageNum,
    box: pdfToCanvas(
      { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      pageHeight,
      scale
    ),
  }
}
```

---

## SVG Overlay — Positioning

The SVG overlay must be positioned exactly over the PDF canvas.
Both must have the same pixel dimensions.

```typescript
// src/ui/components/highlight-overlay.ts

export function createOverlay(
  canvas: HTMLCanvasElement
): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(canvas.width))
  svg.setAttribute('height', String(canvas.height))
  svg.style.position = 'absolute'
  svg.style.top = '0'
  svg.style.left = '0'
  svg.style.pointerEvents = 'none'  // canvas receives events by default

  // Individual rects re-enable pointer events
  return svg
}

export function addHighlightRect(
  svg: SVGSVGElement,
  entity: DetectedEntity,
  onClick: (id: string) => void,
  onHover: (entity: DetectedEntity | null) => void
): SVGRectElement {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('id', entity.id)
  rect.setAttribute('x', String(entity.boundingBox.x))
  rect.setAttribute('y', String(entity.boundingBox.y))
  rect.setAttribute('width', String(entity.boundingBox.width))
  rect.setAttribute('height', String(entity.boundingBox.height))
  rect.setAttribute('data-decision', entity.decision)
  rect.setAttribute('data-entity-type', entity.type)
  rect.classList.add('highlight-rect')
  rect.style.pointerEvents = 'all'  // override parent SVG setting

  rect.addEventListener('click', () => onClick(entity.id))
  rect.addEventListener('mouseenter', () => onHover(entity))
  rect.addEventListener('mouseleave', () => onHover(null))

  svg.appendChild(rect)
  return rect
}

// Update a rect's decision without re-rendering everything
export function updateHighlightDecision(
  svg: SVGSVGElement,
  id: string,
  decision: RedactionDecision
): void {
  const rect = svg.querySelector(`#${id}`)
  if (rect) rect.setAttribute('data-decision', decision)
}
```

---

## GitHub Actions Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run build

      - uses: actions/configure-pages@v4

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - uses: actions/deploy-pages@v4
        id: deployment
```

**Required GitHub repo setting:**
Go to Settings → Pages → Source → set to "GitHub Actions"
(not "Deploy from branch").

---

## Cloudflare Configuration

After GitHub Pages is working, add Cloudflare in front:

1. Add your domain to Cloudflare (free plan)
2. Set DNS: CNAME record pointing `yourdomain.app` to
   `yourname.github.io`
3. Set SSL/TLS to "Full" (not "Flexible")
4. Enable "Always Use HTTPS"
5. Add custom headers rule for COOP/COEP:

```
# Cloudflare Transform Rule → Modify Response Headers
# Apply to: All incoming requests

Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Why Cloudflare handles the headers:** GitHub Pages does not
allow custom response headers. Cloudflare's Transform Rules
add them at the edge. This is required for SharedArrayBuffer
(Tesseract.js in v1.2).

---

## Known Gotchas

### PDF.js
- Always set `workerSrc` before calling `getDocument`. Without it,
  PDF.js falls back silently to a main-thread worker that blocks UI.
- `textContent.items` contains both `TextItem` and `TextMarkedContent`
  objects. Filter with `'str' in item` before accessing `.str`.
- `item.transform[4]` is the x coordinate. `item.transform[5]` is
  the y coordinate (in PDF space, from bottom).
- `item.width` and `item.height` are in the same units as the
  viewport (points at scale 1.0, pixels at higher scales).

### pdf-lib
- `embedPng` is async. `embedJpg` is also async. Always await both.
- `page.drawImage` coordinates use PDF coordinate space
  (origin bottom-left). When the page is sized exactly to the
  image (as above), use `y: 0` and it renders correctly.
- Maximum reliable PDF size from pdf-lib in browser: ~200MB of
  image data. Beyond that, consider splitting the download into
  page ranges.

### Canvas API
- `canvas.toBlob` is asynchronous and callback-based, not
  Promise-based. Wrap in a Promise as shown above.
- `canvas.toDataURL('image/png')` is synchronous but blocks the
  main thread for large canvases. Use `toBlob` with Promises.
- Canvas has a maximum size limit that varies by browser.
  Chrome: ~16384×16384 pixels. Firefox: ~11180×11180. Safari: ~4096×4096.
  At scale 2.0, an A4 page is ~1684×2384 pixels. Well within limits.

### Service Worker
- Service Workers only work on HTTPS or localhost. The Vite dev
  server on localhost works fine. GitHub Pages is HTTPS. Good.
- Register the Service Worker in `main.ts` after the app mounts,
  not in a module that might be imported multiple times.
- During development, disable the Service Worker cache in Chrome
  DevTools → Application → Service Workers → check
  "Bypass for network". Otherwise stale cached assets cause
  confusing bugs.

### Regex
- Always use the `g` flag for global matching.
- Always use `exec()` in a loop to get match positions.
- Reset `lastIndex` to 0 before reusing a regex object across
  multiple calls: `pattern.lastIndex = 0`.
- Or create a new regex object per call — safer.

### TypeScript
- `canvas.getContext('2d')` returns `CanvasRenderingContext2D | null`.
  Always null-check or use the non-null assertion `!` with a comment
  explaining why null is impossible at that point.
- PDF.js types are in `@types/pdfjs-dist` — install this as a dev
  dependency alongside `pdfjs-dist`.

---

## Unit Test Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',  // required for DOM APIs in tests
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
```

```typescript
// tests/unit/patterns.test.ts — template for all pattern tests

import { describe, it, expect, beforeEach } from 'vitest'
import { runAllPatterns } from '../../src/core/detectors/patterns'

describe('US_SSN detection', () => {
  it('detects formatted SSN', () => {
    const results = runAllPatterns('My SSN is 412-67-9823.')
    const ssns = results.filter(r => r.type === 'US_SSN')
    expect(ssns).toHaveLength(1)
    expect(ssns[0].text).toBe('412-67-9823')
  })

  it('rejects SSN with 000 area', () => {
    const results = runAllPatterns('000-67-9823')
    expect(results.filter(r => r.type === 'US_SSN')).toHaveLength(0)
  })

  // Add every PASS and FAIL case from 02-detection-layer.md
})
```

---

## File Creation Order

Build in this order. Each step is testable before moving to the next.

```
1.  src/core/detectors/entities.ts          type definitions
2.  src/core/detectors/patterns.ts          regex patterns
3.  src/core/detectors/confidence.ts        thresholds
4.  src/utils/coords.ts                     coordinate transform
5.  tests/unit/patterns.test.ts             all regex tests passing
6.  tests/unit/coords.test.ts               transform tests passing
7.  src/utils/pdf-text.ts                   PDF.js text extraction
8.  src/core/detectors/merger.ts            dedup logic
9.  src/core/redactor/rasterizer.ts         page to canvas
10. src/core/redactor/burner.ts             black bars on canvas
11. src/core/redactor/repackager.ts         canvas to PDF via pdf-lib
12. tests/integration/redaction.test.ts     end-to-end pipeline
13. src/ui/app.ts                           state machine
14. src/ui/drop-screen.ts                   file input
15. src/ui/processing-screen.ts             progress UI
16. src/ui/components/highlight-overlay.ts  SVG overlay
17. src/ui/components/summary-panel.ts      left panel
18. src/ui/components/page-nav.ts           navigation
19. src/ui/components/entity-tooltip.ts     hover tooltip
20. src/ui/preview-screen.ts                assembles above
21. src/utils/filename.ts                   output naming
22. main.ts                                 entry point, SW registration
23. sw.ts                                   Service Worker
24. .github/workflows/deploy.yml            CI/CD
```

Do not skip steps. Do not merge steps. Each one should work and be
tested before the next begins.

---

## Environment Setup Commands

```bash
# Scaffold the project
npm create vite@5.2.0 appname -- --template vanilla-ts
cd appname

# Install runtime dependencies
npm install pdfjs-dist@4.2.67 pdf-lib@1.17.1
npm install workbox-window@7.1.0 workbox-routing@7.1.0
npm install workbox-strategies@7.1.0 workbox-cacheable-response@7.1.0

# Install dev dependencies
npm install -D vitest@1.6.0 @vitest/ui jsdom
npm install -D @types/node@20.12.0

# Verify everything installed
npm run dev
# Should open at http://localhost:5173 with no errors
```

---

## Definition of Done — V1.0

Before declaring V1.0 complete, every item below must be true:

```
Detection
[ ] All regex patterns pass their unit tests
[ ] Luhn validation tested against 10+ known valid/invalid cards
[ ] Coordinate transform tested with known input/output pairs
[ ] Merger tested with overlapping and duplicate spans

Pipeline
[ ] Digital PDF (text layer) → extract → detect → burn → download
[ ] Output PDF has no text layer (verify in Adobe Acrobat or similar)
[ ] Output filename is [original]-redacted.pdf
[ ] Password-protected PDF shows password prompt, not crash

UI
[ ] File drop and browse both work
[ ] Processing screen shows page-by-page progress
[ ] All highlight states render correctly (red, green, yellow)
[ ] Click toggles decision and updates CSS immediately
[ ] Tooltip appears on hover with correct entity type and text
[ ] Summary panel counts update when entities are toggled
[ ] Page navigation works on multi-page documents
[ ] Footer button shows uncertain count when items unresolved
[ ] Footer button triggers redaction when all resolved
[ ] Done screen confirms download and shows zero-data message

Infrastructure
[ ] GitHub Actions deploys on push to main
[ ] Custom domain resolves correctly
[ ] Service Worker registers and caches app shell
[ ] No console errors on clean load in Chrome, Firefox, Safari
[ ] Network tab shows zero outbound requests after page load
```
