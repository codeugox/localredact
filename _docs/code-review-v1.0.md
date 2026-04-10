# Local Redact V1.0 — Pre-Production Code Review

**Date:** 2026-04-10  
**Scope:** Full codebase review before git push and deploy to localredact.app  
**Result:** All 723 tests pass. Build succeeds. TypeScript compiles clean.

The core architecture is solid — browser-only processing, `connect-src 'none'`, raster burn-in, and JSX text rendering (no HTML injection) are all excellent choices. Below are findings organized by severity.

---

## 🔴 CRITICAL (Must fix before deploy)

### C1. Phone regex misses the opening parenthesis

`PHONE_US` uses `\b` before `\(?`, so `\b` anchors to the first digit, not the `(`. For input `"Phone: (212) 555-1212"`, the match is `"212) 555-1212"` — the `(` is left unredacted, and worse, the redaction bar starts one character late, potentially leaving the area code partially visible.

**File:** `src/core/detectors/patterns.ts:88-89`

---

### C2. Encrypted PDFs break on mode switch in preview

`SummaryPanel.rerunDetection()` calls `detectDocument(file, mode, progress)` **without passing the stored password or onPassword callback**. If the user unlocks an encrypted PDF and then switches between Identity/Full mode, the re-detection will fail silently or crash.

**File:** `src/components/SummaryPanel.tsx:108-131`

---

### C3. No burn padding — risk of glyph edge leaks in final output

`burnRedactions()` draws quads with exact calculated coordinates but **no safety margin**. The preview overlay adds 1px padding via `quadToRect()`, but the final burn path does not. Combined with the proportional-width approximation in `resolveMatchToQuads()` (assumes equal-width glyphs), this risks leaving partial glyph edges visible at the redaction boundary. For a **redaction tool**, slight over-redaction is always preferable to under-redaction.

**Files:** `src/core/redactor/burner.ts:30-43`, `src/core/text-index.ts:316-318`

---

### C4. Password trimming rejects valid passwords with spaces

`PasswordModal` does `passwordRef.current.trim()` before submitting. PDF passwords can legally contain leading/trailing spaces. This silently corrupts such passwords.

**File:** `src/components/PasswordModal.tsx:55`

---

## 🟠 IMPORTANT (Should fix before deploy)

### I1. Adjacent entity merger is too aggressive

`mergeAdjacentEntities()` merges **any same-type entities within 3 chars** — this can wrongly merge distinct values like two separate emails (`a@b.com, c@d.com`), two phone numbers (`555-1212 / 555-3434`), or two dollar amounts. One toggle then controls both values, and the user can't redact them independently.

**File:** `src/core/detectors/merger.ts:7-8, 166-193`

---

### I2. jsPDF bundles 224KB of unused dependencies

The production build includes `html2canvas` (202KB) and `dompurify` (22KB) as jsPDF transitive dependencies. These are only needed for `jsPDF.html()` which Local Redact never calls. This adds ~224KB raw (~56KB gzipped) to the bundle for zero functionality.

**Build output:**
```
dist/assets/html2canvas.esm-QH1iLAAe.js  202.38 kB │ gzip:  47.71 kB
dist/assets/purify.es-BwoZCkIS.js         22.03 kB │ gzip:   8.72 kB
```

---

### I3. CSP/security headers delivered only via `<meta>` tags

`X-Frame-Options`, `frame-ancestors`, `Permissions-Policy`, and `Referrer-Policy` via `<meta http-equiv>` are **not effective** — browsers only honor these as HTTP response headers. The meta CSP itself works, but for production at `localredact.app`, you should configure these as real HTTP headers (Cloudflare, Netlify, etc.) and keep the meta tags as fallback only.

**File:** `index.html:7-11`

---

### I4. Thumbnail rendering race condition on reset

`PageNav.renderThumbnails()` is async with no cancellation. If the user resets (Start over) while thumbnails are rendering, the async callback can write stale data into the signal after the new document is loaded. The `onReset(clearThumbnailCache)` clears the cache synchronously, but the in-flight render can re-populate it after the clear.

**File:** `src/components/PageNav.tsx:87-131`

---

### I5. Password not cleared after successful completion

`pdfPassword` signal is only cleared on `RESET`. After `REDACTION_COMPLETE`, the password remains in memory until the user clicks "Start over" or "Redact another document." It should be cleared as soon as redaction completes.

**File:** `src/app/state.ts:373` (only cleared in resetState, not in REDACTION_COMPLETE)

---

### I6. Entity counter never resets between documents in production

`entityCounter` is a module-level mutable that only resets via `resetEntityCounter()` (exported for testing). In production, IDs accumulate across documents (`entity-1`, `entity-2`, ... `entity-500`). Not a functional bug, but sloppy and could mask debugging issues. Should reset on each detection run.

**File:** `src/core/pipeline/detect-document.ts:247-257`

---

### I7. `console.log` left in production code

`resetState()` logs `'LocalRedact: cleanup complete — ...'` on every reset. This should be removed before production — it leaks operational details and clutters the console.

**File:** `src/app/state.ts:382`

---

### I8. Raw error messages exposed in FooterBar

`FooterBar.handleDownload()` passes `err.message` directly to the user on redaction failure. Unlike `DropScreen` which has `sanitizeError()`, this path can leak internal file paths, PDF.js parser errors, or jsPDF internals to the user.

**File:** `src/components/FooterBar.tsx:78-81`

---

### I9. `READY` state missing from spec implementation

The spec defines 6 states: `IDLE, LOADING, NEEDS_REVIEW, READY, PROCESSING, DONE`. The code only implements 5 (uses `NEEDS_REVIEW` for both review and ready). This works because download readiness is derived from `uncertainCount === 0`, but it's an undocumented spec deviation. Either update the spec or add `READY` as a state.

---

## 🟡 MINOR (Nice to fix, not blockers)

### M1. `browser-check.ts` uses `innerHTML` with hardcoded string

Safe since the string is constant, but it establishes an innerHTML pattern that could become a future XSS sink if anyone adds dynamic content. Should use DOM API.

**File:** `src/browser-check.ts:10-14`

---

### M2. Position-only text item deduplication may drop real content

`deduplicateItems()` deduplicates by position only (x, y, width, height), ignoring text content. This can discard legitimate text items in PDFs with OCR overlays, accessibility layers, or bold/overlay rendering.

**File:** `src/core/text-index.ts:66-84`

---

### M3. `resetState()` zeroes ALL canvases in the document

`document.querySelectorAll('canvas')` is too global — it would affect any canvas not owned by the app (unlikely but fragile). Should track app-owned canvases explicitly.

**File:** `src/app/state.ts:351-358`

---

### M4. `renderPage` doesn't get a 2D context — relies on caller

The rasterizer's `renderPage()` passes `{ canvas, viewport }` to `page.render()` without getting a context. PDF.js internally calls `canvas.getContext('2d')`. This works but means if the context is already acquired with different settings (e.g., `willReadFrequently`), the internal call could fail silently.

**File:** `src/core/redactor/rasterizer.ts:80-84`

---

### M5. No `rel="noopener noreferrer"` on some external links

The GitHub link in `DropScreen` has `rel="noopener"` but not `noreferrer`. Minor, but for a security-conscious app, `noreferrer` is appropriate.

**File:** `src/components/DropScreen.tsx:428-433`

---

### M6. No `aria-live` region for state transitions

Screen readers won't announce when the app moves between states (drop → processing → preview → done). Adding `aria-live="polite"` to the main content area would improve accessibility.

---

### M7. Keyboard Tab override blocks standard tab navigation

`PreviewScreen` captures all `Tab` key presses to cycle uncertain entities, preventing standard tab navigation for keyboard-only users. Should use a modifier key (e.g., `Alt+N` or a dedicated button) instead.

**File:** `src/components/PreviewScreen.tsx:33-35`

---

### M8. ITIN regex gap at middle-digit 93 (correct but undocumented)

The regex correctly excludes middle-digit 93 (matching IRS rules), but the spec doc says "90-92, 94-99" without explicitly calling out that 93 is invalid. The code is correct; the spec should clarify.

---

### M9. GitHub link is a placeholder

`href="https://github.com"` in DropScreen and DoneScreen points to github.com root, not the actual repo. Should be updated before deploy or removed.

**Files:** `src/components/DropScreen.tsx:429`, `src/components/DoneScreen.tsx:79`

---

### M10. No `<meta name="robots">` tag

Not critical for a SPA, but adding `<meta name="robots" content="index, follow">` would be good SEO practice since you want this discoverable.

---

### M11. DPI fallback test mode accessible in production

`isDpiFallbackTestEnabled()` checks URL params in production, meaning anyone can trigger simulated failures via `?dpi-fallback-test=true`. Should be gated behind `import.meta.env.DEV`.

**File:** `src/core/redactor/rasterizer.ts:22-29`

---

## ✅ What's Already Good

- **Zero network requests**: `connect-src 'none'` CSP, no fetch/XHR/WebSocket/sendBeacon anywhere in source
- **No storage**: no localStorage/sessionStorage/IndexedDB usage
- **Safe rendering**: all user data (entity text, filenames, errors) rendered via JSX text nodes, not innerHTML
- **Raster burn-in**: output is rasterized images, no text layer, no reversible annotations
- **Memory management**: sequential page processing, canvas.width=0 release, blob URL tracking/revocation, PDF.destroy()
- **Solid test coverage**: 723 tests across 29 test files, including fixture-based integration tests
- **Clean build**: TypeScript strict mode, no errors, no warnings (except the known Vite mixed import notice)
- **Password handling**: correct PDF.js onPassword callback wiring, wrong password retry flow
- **Context-sensitive detection**: label/value split prevents redacting labels like "Account Number:"
- **Favicon, meta description, noscript fallback, mobile banner, beforeunload warning** — all present
