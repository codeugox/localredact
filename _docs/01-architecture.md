# Architecture and Stack

## What We're Building

A browser-based PII redaction tool. Drop a PDF, review what gets detected, download a redacted version with black bars burned irreversibly into the page. Nothing is uploaded. Nothing leaves the browser tab.

Three deployment targets share one core detection engine:

- **V1.0** — browser app, static site, no server
- **V1.x** — progressive feature additions (NER model, image support, batch)
- **V3.0** — desktop app (Mac + Windows) wrapping the same core

---

## Open Source Foundation

We build on top of existing libraries rather than from scratch. The detection patterns are informed by and compatible with **Microsoft Presidio** — the most mature open source PII framework available. Presidio runs natively in the desktop version (v3) as a Python sidecar. In the browser, we port its battle-tested patterns to TypeScript and run the same ONNX-compatible models via Transformers.js.

| Library | Purpose | Version target |
|---|---|---|
| Microsoft Presidio | PII detection engine reference + desktop backend | v3.0 desktop |
| PDF.js (Mozilla) | PDF rendering + text extraction | v1.0 browser |
| Tesseract.js | OCR for scanned documents | v1.2 browser |
| Transformers.js (HuggingFace) | ONNX model inference in browser | v1.1 browser |
| pdf-lib | Output PDF assembly | v1.0 browser |
| Workbox (Google) | Service Worker + caching strategy | v1.0 browser |
| Vite | Build tooling + dev server | v1.0 |
| TypeScript | Type safety across all modules | v1.0 |
| Tauri | Desktop app shell | v3.0 |
| spaCy + ONNX Runtime | NER backend for desktop | v3.0 |

---

## Browser Version — Full Stack

### Hosting and Deployment

```
Porkbun              domain registration (~$12/yr)
GitHub               source code, public repo
GitHub Pages         free hosting, auto-deploys on push to main
Cloudflare (free)    CDN layer, caches ONNX model at edge nodes globally
                     speeds up first-load model download worldwide
```

Deploy flow:
```
Push to main branch
        ↓
GitHub Actions builds via Vite
        ↓
Deploys to GitHub Pages
        ↓
Cloudflare serves and caches
        ↓
Live in ~2 minutes
```

### Frontend

```
Vanilla TypeScript + Vite
```

No React, no Next.js, no UI framework. This is a single-page app with one flow. A framework adds bundle weight and abstraction with no benefit at this scope. Vite handles builds and local dev. TypeScript provides type safety across all modules.

### PDF Processing

```
PDF.js      renders PDF pages to canvas
            extracts text content with exact page coordinates
            handles digital PDFs (has a text layer)
```

PDF.js does two things in the pipeline:
1. Extracts the text layer — every word, its content, and its coordinates in PDF space
2. Renders each page to a canvas element — the visual source for the overlay and rasterization

### Coordinate Mapping (Critical)

PDF.js text positions are in **PDF coordinate space**: origin bottom-left, units in points (1 point = 1/72 inch). Canvas renders in **screen coordinate space**: origin top-left, units in pixels, at whatever scale PDF.js chose to render.

Every detected text span needs its coordinates transformed before the overlay can draw correctly. This is handled in `src/utils/coords.ts`.

```
PDF space:    origin bottom-left, y increases upward,  units = points
Canvas space: origin top-left,    y increases downward, units = pixels

Transform:
  canvasX = pdfX * scale
  canvasY = canvasHeight - (pdfY * scale) - (textHeight * scale)
  canvasW = pdfWidth * scale
  canvasH = textHeight * scale
```

### OCR (v1.2)

```
Tesseract.js    runs in a Web Worker
                handles scanned PDFs and images where PDF.js finds no text layer
                returns text with bounding box coordinates
```

When PDF.js finds no text layer, the page is a scanned image. Tesseract.js reads the rendered canvas and returns text with bounding boxes. Slower than text layer extraction but handles everything.

### PII Detection

Two layers. Both run on every document. The output is a unified list of detected spans with type, confidence, and coordinates.

```
Layer 1 — Regex + checksums
  Runs instantly, zero dependencies
  Handles all structured PII: SSN, EIN, credit cards, phones, emails,
  addresses, account numbers, routing numbers, dates of birth

Layer 2 — ONNX NER model (v1.1, loads on demand)
  Quantized DistilBERT or ab-ai/pii_model (~45-80MB)
  Runs in a Web Worker via Transformers.js
  Downloads once, cached via Service Worker
  Handles contextual PII: names, addresses in narrative text
```

### Redaction Pipeline

Three stages. Irreversible.

```
Stage 1 — Rasterize
  Render each PDF page to a high-resolution canvas (300 DPI equivalent)
  The page is now a flat image — the original text layer is discarded

Stage 2 — Burn
  For each span marked REDACT, get its bounding box in canvas coordinates
  Draw a filled black rectangle over those pixels
  The underlying pixels are gone — no overlay, no recoverable text

Stage 3 — Repackage
  Collect all redacted page canvases
  Bundle into a new PDF using pdf-lib
  Output PDF has no text layer, no searchable content, no metadata
  User downloads directly — never touched a server
```

### Service Worker

```
Workbox     caches app shell for offline use after first visit
            caches ONNX model after first download (~45-80MB, one time)
            handles cache versioning on app updates
```

### Password-Protected PDFs

PDF.js throws when it encounters a password-protected file. Handle gracefully:

1. Catch the `PasswordException` from PDF.js
2. Prompt user for password in a modal
3. Pass password to `pdfjsLib.getDocument({ password: '...' })`
4. If wrong password, show clear error — do not crash

### Full Dependency List

```
Runtime
  pdfjs-dist                 PDF rendering + text extraction
  tesseract.js               OCR (v1.2)
  @xenova/transformers        Transformers.js ONNX runtime (v1.1)
  pdf-lib                    output PDF assembly
  workbox-window             Service Worker registration
  workbox-strategies         caching strategies

Dev
  vite                       build + dev server
  typescript                 type safety
  vitest                     unit + integration testing
  @types/pdfjs-dist          types
```

---

## Desktop Version (V3.0)

### Shell

```
Tauri       Rust backend, native Mac + Windows wrapper
            smaller binary than Electron (~10MB vs ~120MB)
            lower memory footprint
            system webview for the UI (same HTML/TS as browser)
```

### What Changes From Browser

| Concern | Browser | Desktop |
|---|---|---|
| PII detection | Regex + Transformers.js ONNX | Regex + Presidio + spaCy |
| NER model | Loaded via Transformers.js | Presidio with spaCy pipeline |
| OCR | Tesseract.js WASM | Native Tesseract binary (faster) |
| PDF processing | PDF.js + pdf-lib | MuPDF (higher fidelity, encrypted PDFs) |
| File access | Browser File API, one at a time | Native file system, batch folders |
| Model storage | Browser Cache Storage | Bundled with app installer |

### Presidio as Python Sidecar

```
Tauri app launches a bundled Python process on startup
Python process runs Presidio analyzer + anonymizer
Tauri communicates via local socket (localhost only, not network)
Presidio results return as JSON, same DetectedEntity schema
UI layer is identical to browser version
```

### Installer Size Target

```
Tauri runtime          ~10MB
App code               ~2MB
Tesseract native       ~20MB
MuPDF                  ~5MB
Python + Presidio      ~80MB
spaCy model            ~15MB
Total                  ~130MB
```

---

## Repository Structure

```
/repo-root
  /src
    /core
      /detectors
        patterns.ts         all regex patterns, named exports
        entities.ts         EntityType, DetectedEntity, all type defs
        merger.ts           dedup and merge overlapping spans
        confidence.ts       confidence scoring and thresholds
      /redactor
        rasterizer.ts       PDF page to canvas image
        burner.ts           draw black rectangles on canvas
        repackager.ts       canvas images to output PDF via pdf-lib
      /workers
        ocr.worker.ts       Tesseract.js Web Worker
        ner.worker.ts       Transformers.js Web Worker (v1.1)
      /modes
        identity-only.ts    mode config, decision defaults
        full-redaction.ts   mode config, decision defaults
    /ui
      app.ts                root, state machine
      drop-screen.ts        file input screen
      processing-screen.ts  spinner, progress states
      preview-screen.ts     main preview, highlights, panel
      /components
        highlight-overlay.ts  SVG overlay on PDF canvas
        summary-panel.ts      left panel entity counts
        page-nav.ts           prev/next, thumbnail strip
        entity-tooltip.ts     hover tooltip
    /utils
      pdf-text.ts           PDF.js text extraction helpers
      coords.ts             coordinate space transform
      filename.ts           output filename generation
    main.ts                 entry point
  /public
    /models                 ONNX model files (v1.1)
  /tests
    /unit
      patterns.test.ts      one describe block per entity type
      merger.test.ts
      confidence.test.ts
      luhn.test.ts
      coords.test.ts
    /integration
      detection.test.ts     full detection pipeline on sample text
      redaction.test.ts     rasterize → burn → output PDF
  index.html
  vite.config.ts
  tsconfig.json
  .github
    /workflows
      deploy.yml            GitHub Actions deploy to Pages
  README.md
  CHANGELOG.md
```

---

## Naming Conventions

```
Files           kebab-case.ts
Components      kebab-case.ts (no framework, no PascalCase files)
Types           PascalCase
Interfaces      PascalCase, no I prefix
Constants       SCREAMING_SNAKE_CASE
Functions       camelCase
Variables       camelCase
CSS classes     kebab-case
Test files      same name as source + .test.ts
```

---

## Cost To Run V1 Forever

```
GitHub              free
GitHub Pages        free
Cloudflare          free (generous free tier)
Domain              ~$12/year
Total               $12/year
```
