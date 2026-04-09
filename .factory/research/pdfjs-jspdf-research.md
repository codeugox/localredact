# pdfjs-dist 5.x & jsPDF 2.5.x Research

> Researched 2026-04-09 | pdfjs-dist 5.5.207 target | jsPDF 2.5.2 target

---

## 1. pdfjs-dist 5.x — Migration from 4.x

### 1.1 Package Structure (v5.5.207+)

The `build/` folder contains **only `.mjs` files** (no `.js`):

```
build/
  pdf.mjs              (810 KB, main entry)
  pdf.min.mjs          (430 KB, minified)
  pdf.worker.mjs       (2.19 MB)
  pdf.worker.min.mjs   (1.24 MB)
  pdf.sandbox.mjs
  pdf.sandbox.min.mjs
types/
  src/pdf.d.ts         (entry for TypeScript types)
  web/                  (viewer component types)
```

**`package.json` key fields:**
```json
{
  "name": "pdfjs-dist",
  "version": "5.6.205",
  "main": "build/pdf.mjs",
  "types": "types/src/pdf.d.ts"
}
```

There is **no** `build/pdf.js` or `build/pdf.worker.js` anymore — everything is ESM (`.mjs`).

### 1.2 Worker Setup in v5

The worker file is `pdf.worker.min.mjs` (not `.js`). Set it up via `GlobalWorkerOptions.workerSrc`:

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Option A: URL constructor (recommended for Vite/bundlers)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Option B: CDN fallback
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs`;
```

**Key change from v3/v4:** The file extension changed from `.js` → `.mjs`. Old `pdf.worker.js` / `pdf.worker.min.js` paths no longer exist.

### 1.3 TypeScript Types

pdfjs-dist 5.x **ships its own types** via `"types": "types/src/pdf.d.ts"` in package.json. No need for `@types/pdfjs-dist`.

Key types to import:
```typescript
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextItem,
  TextMarkedContent,
  TextContent,
  PageViewport,
  DocumentInitParameters,
  RenderParameters,
} from 'pdfjs-dist';

// For TextItem type checking:
// TextItem has: str, dir, transform, width, height, fontName, hasEOL
// TextMarkedContent has: type, id
```

The `TextItem` interface in v5:
```typescript
interface TextItem {
  str: string;
  dir: 'ttb' | 'ltr' | 'rtl';
  transform: number[];  // 6-element transformation matrix
  width: number;         // Width in device space
  height: number;        // Height in device space
  fontName: string;
  hasEOL: boolean;
}
```

### 1.4 getTextContent() API — BREAKING CHANGE in v5.5+

**In v5.5.207**, `getTextContent()` was converted to an `async` method (PR #20648). Previously it returned a `Promise` built by manually pumping a `ReadableStream`; now it's a proper `async` function internally using `for await...of`.

**From the caller's perspective, the return type is the same**: `Promise<TextContent>`. So existing code like:

```typescript
const textContent = await page.getTextContent();
// textContent.items: Array<TextItem | TextMarkedContent>
// textContent.styles: Record<string, TextStyle>
// textContent.lang: string | null
```

...continues to work unchanged. The parameters interface:

```typescript
interface getTextContentParameters {
  includeMarkedContent?: boolean;  // default: false
  disableNormalization?: boolean;  // default: false
}
```

There is also `page.streamTextContent(params)` which returns a `ReadableStream` for streaming access, but for our use case `getTextContent()` is preferred.

### 1.5 getViewport() API — Unchanged

```typescript
interface GetViewportParameters {
  scale: number;        // Required
  rotation?: number;    // Degrees, defaults to page rotation
  offsetX?: number;     // Default 0
  offsetY?: number;     // Default 0
  dontFlip?: boolean;   // Default false
}

const viewport: PageViewport = page.getViewport({ scale: 300 / 72 });
// viewport.width / viewport.height are in CSS pixels at the given scale
```

No breaking changes to `getViewport()` in v5.

### 1.6 render() API — Minor Changes

The `RenderParameters` interface in v5:

```typescript
interface RenderParameters {
  canvas: HTMLCanvasElement | null;     // NEW: can pass canvas directly
  viewport: PageViewport;
  canvasContext?: CanvasRenderingContext2D;  // Deprecated; use canvas instead
  intent?: 'display' | 'print' | 'any';
  annotationMode?: number;  // AnnotationMode enum
  transform?: any[];
  background?: string | CanvasGradient | CanvasPattern;
  pageColors?: object;
  optionalContentConfigPromise?: Promise<any>;
  annotationCanvasMap?: Map<string, HTMLCanvasElement>;
  printAnnotationStorage?: any;
  isEditing?: boolean;
  recordImages?: boolean;       // NEW in v5
  recordOperations?: boolean;   // NEW in v5
  operationsFilter?: (index: number) => boolean;  // NEW in v5
}
```

**Key change**: v5 prefers passing `canvas` directly rather than `canvasContext`. However, `canvasContext` still works for backward compatibility:

```typescript
// v5 preferred pattern:
const renderTask = page.render({
  canvas: canvas,
  viewport: viewport,
});
await renderTask.promise;

// v4 pattern (still works):
const renderTask = page.render({
  canvasContext: ctx,
  viewport: viewport,
});
await renderTask.promise;
```

### 1.7 Password Handling — Unchanged

Password is provided via `DocumentInitParameters.password`:

```typescript
const loadingTask = pdfjsLib.getDocument({
  data: pdfBytes,       // or url: '...'
  password: 'secret',   // Optional: for encrypted PDFs
});

// Password callback via onPassword on the loading task:
loadingTask.onPassword = (updateCallback, reason) => {
  // reason: 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
  const password = prompt('Enter PDF password:');
  updateCallback(password);
};

const pdfDoc = await loadingTask.promise;
```

### 1.8 Major Breaking Changes Summary (v4 → v5)

1. **`MissingPDFException` and `UnexpectedResponseException` removed** — replaced with a single unified exception (PR #19264).

2. **`wasmUrl` API option required for JPEG 2000 / ICC profiles** — OpenJPEG decoder moved to separate `.wasm` file (PR #19329). If not set, a JS fallback is used (slower).

3. **`iccUrl` API option** — New option for ICC profile support (PR #19620).

4. **New CSS variables required** — Text and annotation layers depend on new CSS variables (PR #19469).

5. **Viewer component `render` methods changed to take parameter objects** (PR #19365) — affects viewer components, not the low-level page render API.

6. **All build files are now `.mjs`** — No more `.js` builds in the main `build/` folder.

7. **`getTextContent()` converted to async** (v5.5+, PR #20648) — Return type unchanged (`Promise<TextContent>`), but internally different.

8. **Minimum Chrome version bumped to 118** (v5.5+, PR #20645).

9. **`enableHWA` option removed** from viewer components (v5.6+, PR #20849).

---

## 2. jsPDF 2.5.x — addImage & Multi-Page Assembly

### 2.1 Constructor & Units

```typescript
import { jsPDF } from 'jspdf';

const doc = new jsPDF({
  orientation: 'portrait',  // or 'landscape', 'p', 'l'
  unit: 'px',               // 'pt', 'mm', 'cm', 'in', 'px'
  format: [widthPx, heightPx],  // Custom size as [width, height] array
  compress: true,            // Enable PDF stream compression
  putOnlyUsedFonts: true,
});
```

**Units**: jsPDF supports `'px'` directly. When using `'px'`, coordinates and dimensions are in pixels. This is ideal for our canvas-based workflow.

**Important**: When `unit: 'px'` is used, the internal scaling factor is `72/96 = 0.75` (since PDF points are 72 per inch, and CSS px assumes 96 DPI). The `format` array dimensions should be specified in the chosen unit.

### 2.2 addImage() API Signature

```typescript
doc.addImage(
  imageData: string | HTMLImageElement | HTMLCanvasElement | Uint8Array,
  format: string,        // 'PNG', 'JPEG', etc.
  x: number,             // x position (in declared units)
  y: number,             // y position (in declared units)
  width: number,         // image width (in declared units)
  height: number,        // image height (in declared units)
  alias?: string,        // Optional alias for reuse
  compression?: string,  // 'NONE' | 'FAST' | 'MEDIUM' | 'SLOW' (JPEG only)
  rotation?: number      // Degrees 0-359
): jsPDF;
```

**Key**: `imageData` accepts `HTMLCanvasElement` directly — no need to convert to data URL first.

### 2.3 Multi-Page PDF Assembly Pattern

For assembling a multi-page PDF where each page matches source dimensions:

```typescript
import { jsPDF } from 'jspdf';

function assembleRedactedPDF(
  canvases: HTMLCanvasElement[],
  pageWidthsPt: number[],   // Original page widths in PDF points
  pageHeightsPt: number[]   // Original page heights in PDF points
): Blob {
  // Use 'pt' (points) to match PDF coordinate space exactly
  // First page dimensions set in constructor
  const doc = new jsPDF({
    orientation: pageWidthsPt[0] > pageHeightsPt[0] ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageWidthsPt[0], pageHeightsPt[0]],
    compress: true,
    putOnlyUsedFonts: true,
  });

  for (let i = 0; i < canvases.length; i++) {
    if (i > 0) {
      // addPage accepts format as [width, height] array
      doc.addPage(
        [pageWidthsPt[i], pageHeightsPt[i]],
        pageWidthsPt[i] > pageHeightsPt[i] ? 'landscape' : 'portrait'
      );
    }

    // Add canvas as image filling entire page
    doc.addImage(
      canvases[i],       // HTMLCanvasElement directly
      'PNG',             // Use PNG for lossless (preserves redaction fidelity)
      0,                 // x = 0 (full bleed)
      0,                 // y = 0 (full bleed)
      pageWidthsPt[i],   // width = page width
      pageHeightsPt[i],  // height = page height
      `page-${i}`,       // alias for deduplication
      'NONE'             // No additional JPEG compression
    );
  }

  // Strip metadata
  doc.setProperties({
    title: 'Redacted Document',
    creator: '',
    producer: '',
    author: '',
    subject: '',
    keywords: '',
  });

  return doc.output('blob');
}
```

### 2.4 addPage() API

```typescript
doc.addPage(
  format?: string | [number, number],  // Page size name or [w, h] array
  orientation?: 'portrait' | 'landscape' | 'p' | 'l'
): jsPDF;
```

The `format` parameter accepts the same values as the constructor. Using `[width, height]` allows different page sizes per page (critical for mixed-dimension PDFs).

### 2.5 setProperties() — Metadata Control

```typescript
doc.setProperties({
  title: string,
  subject: string,
  author: string,
  keywords: string,
  creator: string,   // Application that created the document
  producer: string,  // PDF producer (jsPDF sets this by default)
});
```

**Note on metadata leaks**: jsPDF sets `producer` to `"jsPDF <version>"` and `creator` to `"jsPDF <version>"` by default. Call `setProperties()` with empty strings to minimize metadata leakage. However, **jsPDF hard-codes the producer string in the PDF trailer** — setting `producer: ''` may not fully remove it. The output PDF will still contain a `/Producer` entry. For full metadata stripping, post-processing might be needed, but for our use case (redacting PII from document content, not hiding the tool used), this is acceptable.

### 2.6 Output as Blob

```typescript
// Output as Blob
const blob: Blob = doc.output('blob');

// Output options:
doc.output('blob');                    // → Blob
doc.output('arraybuffer');             // → ArrayBuffer
doc.output('datauristring');           // → data:application/pdf;base64,...
doc.output('bloburi');                 // → blob:// URL string
doc.save('filename.pdf');              // → triggers download
doc.save('filename.pdf', { returnPromise: true });  // → Promise
```

### 2.7 Coordinate System Considerations

When using `unit: 'pt'` (72 points per inch), and canvas rendered at 300 DPI:

```
PDF page size: e.g. 612 × 792 pt (Letter)
Canvas at 300 DPI: 612 * (300/72) = 2550 × 3300 px

When adding image to jsPDF with unit='pt':
  - x=0, y=0, width=612, height=792
  - jsPDF scales the 2550×3300 canvas image to fit 612×792 pt
```

This approach preserves the exact page dimensions while embedding the high-DPI rasterized content.

### 2.8 Using JPEG Instead of PNG (Performance Trade-off)

For large documents, PNG embedding can be slow and produce large files. Alternative:

```typescript
// Convert canvas to JPEG data URL for smaller file size
const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
doc.addImage(jpegDataUrl, 'JPEG', 0, 0, w, h);

// Or pass canvas directly with JPEG compression
doc.addImage(canvas, 'JPEG', 0, 0, w, h, undefined, 'MEDIUM');
```

**Recommendation**: Use PNG for redacted documents to ensure black rectangles are pixel-perfect. JPEG artifacts could theoretically reveal edges of redacted content.

---

## 3. Vite + pdfjs-dist 5.x Configuration

### 3.1 Worker Import Strategy

The recommended approach for Vite is using the `new URL()` pattern with `import.meta.url`:

```typescript
// src/lib/pdf-setup.ts
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
```

Vite recognizes the `new URL(..., import.meta.url)` pattern and handles it correctly during both dev and build, creating a proper asset reference.

### 3.2 Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // Exclude pdfjs-dist from dependency pre-bundling
    // This prevents Vite from trying to bundle the worker
    exclude: ['pdfjs-dist'],
  },
  build: {
    // Ensure the worker file is properly handled
    rollupOptions: {
      output: {
        // Prevent mangling of worker file names
        manualChunks: undefined,
      },
    },
  },
});
```

### 3.3 Why `optimizeDeps.exclude` Is Needed

Vite's dependency pre-bundling (powered by esbuild) tries to bundle all dependencies into a single file for dev performance. pdfjs-dist has complex internals (worker threads, dynamic imports, WASM) that don't work well with esbuild's bundling. Excluding it from optimizeDeps ensures:

1. The worker file remains a separate importable asset
2. WASM files are not mangled
3. Dynamic worker creation via `new Worker()` functions correctly

### 3.4 Known Issues & Workarounds

**Issue 1: "Setting up fake worker" warning**
- Cause: `workerSrc` not set before `getDocument()` is called
- Fix: Set `GlobalWorkerOptions.workerSrc` at module load time, before any PDF operations

**Issue 2: Worker resolution in dev vs build**
- In Vite dev mode, `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` resolves to a node_modules path
- In production build, Vite copies the file to the output directory
- Both work correctly as long as `optimizeDeps.exclude` includes `'pdfjs-dist'`

**Issue 3: Vite 6.x + pdfjs-dist 5.x**
- Based on research, Vite 6.x works with pdfjs-dist 5.x using the same `optimizeDeps.exclude` pattern
- The PR #19922 in pdf.js v5.3+ specifically "preserves webpack/vite ignore comments when minifying", showing awareness of bundler compatibility
- If issues persist, the CDN fallback approach works universally:

```typescript
// Fallback: use CDN-hosted worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
```

### 3.5 Alternative: Copy Worker to Public Directory

```bash
# Copy worker to public/ for guaranteed availability
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

This is the most reliable approach but requires a build step or postinstall script.

### 3.6 Complete Vite Config for Our Project

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // or vue, svelte, etc.

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  worker: {
    format: 'es', // Use ES modules for workers
  },
});
```

---

## 4. Complete Integration Pattern

### 4.1 PDF Loading → Text Extraction → Redaction → Assembly

```typescript
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// 1. Set up worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// 2. Load PDF
async function loadPDF(data: ArrayBuffer, password?: string): Promise<PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
    password,
  });

  loadingTask.onPassword = (callback, reason) => {
    // reason: 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
    // Handle via UI callback
  };

  return loadingTask.promise;
}

// 3. Extract text with positions
async function getPageTextItems(page: PDFPageProxy): Promise<TextItem[]> {
  const content = await page.getTextContent({ disableNormalization: false });
  return content.items.filter(
    (item): item is TextItem => 'str' in item
  );
}

// 4. Render page to canvas at 300 DPI
const DPI = 300;
const SCALE = DPI / 72;

async function renderPageToCanvas(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // v5 preferred: pass canvas directly
  const renderTask = page.render({
    canvas: canvas,
    viewport: viewport,
  });

  await renderTask.promise;
  return canvas;
}

// 5. Burn redaction rectangles onto canvas
function burnRedactions(
  canvas: HTMLCanvasElement,
  regions: Array<{ x: number; y: number; w: number; h: number }>
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  for (const r of regions) {
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

// 6. Assemble output PDF
function assembleOutputPDF(
  canvases: HTMLCanvasElement[],
  originalPages: PDFPageProxy[]
): Blob {
  const firstPage = originalPages[0];
  const firstVp = firstPage.getViewport({ scale: 1 }); // scale=1 → pt
  
  const doc = new jsPDF({
    orientation: firstVp.width > firstVp.height ? 'l' : 'p',
    unit: 'pt',
    format: [firstVp.width, firstVp.height],
    compress: true,
    putOnlyUsedFonts: true,
  });

  for (let i = 0; i < canvases.length; i++) {
    const vp = originalPages[i].getViewport({ scale: 1 });
    
    if (i > 0) {
      doc.addPage(
        [vp.width, vp.height],
        vp.width > vp.height ? 'l' : 'p'
      );
    }

    doc.addImage(
      canvases[i],
      'PNG',
      0, 0,
      vp.width, vp.height,
      `page${i}`,
      'NONE'
    );
  }

  doc.setProperties({
    title: 'Redacted Document',
    creator: '',
    author: '',
    subject: '',
    keywords: '',
  });

  return doc.output('blob');
}
```

---

## 5. Sources & References

- pdfjs-dist npm: https://www.npmjs.com/package/pdfjs-dist
- pdfjs-dist 5.6.205 build files: https://app.unpkg.com/pdfjs-dist@5.6.205/files/build
- pdfjs-dist package.json: `"main": "build/pdf.mjs"`, `"types": "types/src/pdf.d.ts"`
- pdf.js API docs: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html
- pdf.js v5.0.375 release (breaking changes): https://github.com/mozilla/pdf.js/releases/tag/v5.0.375
- pdf.js v5.5.207 release (getTextContent async): https://github.com/mozilla/pdf.js/pull/20648
- Vite + pdfjs-dist worker discussion: https://github.com/mozilla/pdf.js/discussions/19520
- jsPDF docs (constructor): https://artskydj.github.io/jsPDF/docs/jsPDF.html
- jsPDF docs (addImage): https://artskydj.github.io/jsPDF/docs/module-addImage.html
- jsPDF GitHub: https://github.com/parallax/jsPDF
