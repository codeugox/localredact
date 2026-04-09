# V1 Scope, Roadmap, and Release Strategy

## The Line Between V1 and Everything After

V1.0 ships one thing done exceptionally well: drop a PDF, review what gets detected, download a redacted version with black bars burned irreversibly into the page. Nothing uploaded, nothing stored, nothing recoverable.

Every feature below that line is genuinely useful. None of it is needed to ship something worth sharing.

---

## V1.0 — What Ships

### Core Features

**Single PDF input**
Drag and drop plus click-to-browse fallback. PDF only. One file at a time. Max 50MB.

**Regex detection layer**
All structured PII in a tax document:
- Social Security Numbers (formatted and unformatted)
- ITINs
- EINs (with context label detection)
- Credit card numbers (with Luhn validation)
- US phone numbers (all common formats)
- Email addresses
- Street addresses
- City / State / ZIP combinations
- Standalone ZIP codes (flagged uncertain)
- Dates of birth
- Bank account numbers (with context label)
- Routing numbers
- Dollar amounts (tagged KEEP in identity-only mode)
- Passport numbers (flagged uncertain)

**Two redaction modes**
Identity only and full redaction. Identity only keeps all financial figures — wages, withholding, deductions — while removing name, SSN, address, phone, email, and account numbers. This is the primary use case for tax document sharing.

**Irreversible rasterized redaction**
Pages are converted to high-resolution images. Black rectangles are burned into the pixel data. The output PDF has no text layer, no searchable content, no metadata. Not overlay redaction — pixel destruction.

**Preview screen with full interaction**
Color-coded highlights (red = redact, green = keep, yellow = uncertain), click to toggle any entity, tooltip on hover showing entity type and matched text, summary panel with entity type breakdown, page navigation with thumbnail strip, uncertain item resolution flow, footer button that gates download until all uncertain items are resolved.

**Output**
Downloaded as `[original-filename]-redacted.pdf`. Browser native download dialog. Never stored, never transmitted.

**Zero-data trust signals**
"Your document never left this browser tab" visible on the drop screen, preview screen, and done screen. No network requests after initial page load — verifiable in browser DevTools.

**Service Worker**
App shell cached for offline use after first visit. Infrastructure in place for model caching in v1.1.

**Password-protected PDF handling**
Clean error with password prompt. Does not crash.

---

### What V1.0 Explicitly Does Not Include

| Feature | Why it's out | When it comes |
|---|---|---|
| NER model (names in narrative text) | Adds download dependency, model loading complexity, potential failures. Regex handles labeled fields which covers most tax docs. | v1.1 |
| Image file support (JPG, PNG) | Separate OCR pipeline, different coordinate system, more edge cases. | v1.2 |
| Batch processing | Multiple files, queue management, zip download. Clean up single-file flow first. | v1.3 |
| Audit log | Report of everything found and redacted. Useful but not essential for core use case. | v2.1 |
| Custom saved profiles | LocalStorage preferences. Useful for repeat users, not needed for first use. | v2.2 |
| Mobile optimization | Desktop use case first. Mobile layout needs real testing on real devices. | v1.1 |
| Dark mode | Not now. | Later |
| Fine-tuned model | Tax-specific fine-tune. Build v1 first, then measure what regex misses. | v2.0 |
| Desktop app | Tauri shell, Presidio backend, bundled model. | v3.0 |
| Accounts / history | Never. No server, no storage. | Never |

---

## Roadmap

### V1.0 — Launch
*Regex detection, rasterized redaction, full preview screen*

The foundation. Ships when the single-file PDF flow works cleanly end to end on W-2s, 1099s, and bank statements. No regressions on password-protected files or large documents.

Launch checklist:
- [ ] Regex layer fully tested against all entity types
- [ ] Rasterization pipeline tested on digital and scanned PDFs
- [ ] Preview screen interactions work across Chrome, Firefox, Safari
- [ ] Service Worker caching working
- [ ] GitHub Actions deploy pipeline working
- [ ] Custom domain pointing to GitHub Pages
- [ ] README live with accurate description and live URL
- [ ] No console errors on clean load

---

### V1.1 — NER Model
*Names and addresses in narrative text*

Add the ONNX NER model as an on-demand feature. User clicks "Enable name detection" and the model downloads once (~45-80MB), cached permanently. Results merge with existing regex results in the preview screen without a page reload.

What this adds:
- Catches names and employer names that appear in narrative text (not labeled fields)
- Catches addresses written in paragraph form
- Raises overall detection confidence on less-structured documents

What this requires:
- Transformers.js Web Worker setup
- Service Worker model caching strategy
- Progress UI for first-time model download
- Merge logic between NER and regex results
- Testing that NER results don't conflict with regex results on the same spans

---

### V1.2 — Image Support
*JPG, PNG, TIFF input*

Extend the drop zone to accept image files. Tesseract.js handles OCR, same detection and redaction pipeline runs on the extracted text, output is a redacted image file (not PDF).

What this requires:
- Tesseract.js Web Worker integration
- Image coordinate system (simpler than PDF — no page transforms needed)
- Output format decision: redacted PNG or wrapped in a single-page PDF
- Testing on phone-photographed documents (common real-world case)

---

### V1.3 — Batch Processing
*Multiple files at once*

Accept multiple PDFs (and images after v1.2) in a single session. Process sequentially. Download as a ZIP of redacted files. Show a per-file progress indicator.

What this requires:
- File queue management
- Sequential processing (parallel is risky with WASM memory limits)
- ZIP assembly in the browser (JSZip or fflate)
- Per-file status (pending / processing / done / error)
- Bulk download trigger

---

### V2.0 — Fine-Tuned Model
*Tax-document-specific NER*

Fine-tune the NER model specifically on synthetic W-2, 1099, 1040, bank statement, and SSA letter documents. Replace the generic `ab-ai/pii_model` with the fine-tuned version. Publish a before/after accuracy comparison.

This is a portfolio signal — "we measured what the generic model missed and built a better one." Requires a synthetic data generation pipeline, Google Colab training run, ONNX export, and real-document evaluation.

What this requires (separate workstream):
- Synthetic data generation with Faker (~1000+ labeled examples)
- HuggingFace fine-tuning script
- ONNX export + quantization
- Evaluation against real documents
- A/B accuracy comparison to publish with the release

---

### V2.1 — Audit Log
*Downloadable report of what was found*

After redaction, offer a second download: a plain text or JSON report listing every entity found, its type, its confidence score, and its page location. Useful for compliance-aware users who need a record of what was removed.

Note: since the output PDF has no text layer, the audit log is the only post-redaction record of what was under the bars. Worth framing that way in the UI.

---

### V2.2 — Custom Profiles
*Saved redaction preferences*

Let users configure a custom mode — "always redact employer name, always keep tax year" — and save it to localStorage. No server, no account. Session-persistent preferences only.

---

### V3.0 — Desktop App
*Mac + Windows, Tauri + Presidio*

Full native desktop app. Same UI, same core logic, with:
- Tauri shell (Rust backend, ~10MB)
- Microsoft Presidio running as a bundled Python sidecar
- Native Tesseract binary (faster than WASM)
- MuPDF for PDF handling (handles encrypted and non-standard PDFs better than PDF.js)
- Bundled spaCy NER model (no download required)
- Native file system access
- Batch folder processing

Installer size target: ~130MB. Normal for a capable document processing app.

Mac and Windows ship simultaneously. Mac requires notarization via Apple Developer Program ($99/yr). Windows requires code signing certificate (~$200/yr from a CA).

---

## Build Sequence — Week by Week

```
Week 1  Core detection engine
        patterns.ts with all regex patterns
        entities.ts type definitions
        merger.ts dedup logic
        confidence.ts thresholds
        Unit tests for every pattern
        All tests passing before moving on

Week 2  PDF processing pipeline
        PDF.js text extraction
        Coordinate transform (coords.ts)
        Rasterizer — pages to canvas images
        Burner — black rectangles on canvas
        Repackager — canvas images to PDF via pdf-lib
        Integration test: load PDF → detect → redact → download

Week 3  Preview screen UI
        Drop screen
        Processing screen with progress
        SVG overlay on PDF canvas
        Highlight rendering from detection output
        Click to toggle with CSS state changes
        Tooltip on hover
        Summary panel with live counts
        Page navigation and thumbnail strip
        Footer button gating logic
        Done screen

Week 4  Polish and launch
        Password-protected PDF handling
        Error states for all failure modes
        Service Worker setup via Workbox
        Cross-browser testing (Chrome, Firefox, Safari)
        GitHub Actions deploy pipeline
        Custom domain configuration
        README finalized
        Launch
```

---

## Testing Strategy

### Unit Tests (Vitest)

One `describe` block per entity type in `patterns.test.ts`. Every PASS and FAIL case from the detection layer document becomes a test case.

```typescript
describe('US_SSN', () => {
  it('matches formatted SSN', () => {
    expect(detectSSN('412-67-9823')).toHaveLength(1)
  })
  it('rejects invalid area 000', () => {
    expect(detectSSN('000-67-9823')).toHaveLength(0)
  })
  // ...
})
```

Luhn validation gets its own test file — test against known valid and invalid card numbers.

Coordinate transform gets its own test file — test the PDF-to-canvas transform math with known input/output pairs.

### Integration Tests

`detection.test.ts` — load sample text strings representing W-2 and 1099 content, run the full detection pipeline, assert expected entities are found with expected types and decisions.

`redaction.test.ts` — load a test PDF, run full pipeline end to end, assert output PDF has no text layer, assert output is a valid PDF blob.

### Manual Testing Matrix

Before each release, test against these real document types:
- W-2 (digital, text layer)
- 1099-INT (digital)
- 1099-DIV (digital)
- Bank statement (digital)
- Scanned W-2 (image-based, no text layer) — v1.2
- Password-protected PDF
- Multi-page document (5+ pages)
- Large document (40+ pages, stress test)
- PDF with no detectable PII (verify no false positives)

### Browser Compatibility

V1.0 targets:
- Chrome 120+
- Firefox 121+
- Safari 17+
- Edge 120+

Test each release in all four before deploying.

---

## Launch Distribution

**Day 1**
- Post the live URL with a one-paragraph description and the zero-data story
- Tweet/post: "Built a PII redactor that runs entirely in your browser. No uploads. Drop your W-2, download a redacted version. Your data never leaves the tab. [URL]"
- Submit to Hacker News Show HN

**Week 1**
- Post on Reddit: r/privacy, r/programming, r/devops
- Share in relevant Discord/Slack communities (developer privacy, security)
- Post on LinkedIn with the GRC portfolio framing — this is also a security and compliance tool

**Ongoing**
- Tax season timing is your biggest organic distribution opportunity
- Every post about "don't upload your tax documents to AI tools" is a distribution channel for this tool
