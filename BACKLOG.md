# Backlog — Deferred from V1.0

Items that were identified during V1.0 development but deferred. Organized by target version.

---

## V1.1 — NER Model Integration

- **AI-powered NER model** — Add `@huggingface/transformers` (3.x or 4.x) for detecting names, organizations, and contextual entities in running text (not just labeled fields).
- **Service Worker + vite-plugin-pwa** — Cache the ONNX model persistently so users only download it once.
- **Names in running text (unlabeled)** — Currently only labeled names are detected via regex; narrative-text names are missed.
- **Organization names** — Currently not detected at all; NER model would cover these.
- **COOP/COEP headers** — Needed for `SharedArrayBuffer`, which some ONNX runtimes require. Deferred from V1.0 since GitHub Pages can't set them (Revision 14); re-add via Cloudflare when the model ships.

## V1.2 — Image/OCR Support

- **Tesseract.js integration** — Handle scanned/image-only PDFs that have no text layer.
- **Image preprocessing** — Deskew, contrast enhancement to improve OCR accuracy on photographed documents.
- **Scanned PDF error** — Currently shows an error for scanned PDFs; this version would process them instead.

## V1.3 — Batch Processing

- **Multiple PDF input** — Accept and process multiple PDFs in a single session with a per-file progress indicator.
- **Zip download** — Package all redacted files into a single ZIP download (JSZip or fflate).

## Deferred UX Polish

- **Browser back/forward navigation** — Add `pushState` integration so the back button navigates between app screens instead of exiting the app.
- **Manual redaction drawing** — Let users draw rectangles on the document to redact areas the detector missed.
- **Responsive mobile layout** — Currently shows a "best on desktop" banner but the sidebar doesn't collapse on small screens.
- **CHANGELOG.md** — Track version changes formally.

## Deferred Infrastructure

- **GitHub Actions CI/CD** — Add `.github/workflows/deploy.yml` for automated deployment on push to main.
- **Cloudflare CSP response headers** — Currently using a `<meta>` tag; HTTP headers are more secure and support directives like `frame-ancestors` that meta tags cannot.
- **Cloudflare security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` are currently set via meta tags where possible; should be proper HTTP headers.
- **ESLint / Prettier setup** — Currently using `tsc --noEmit` as the only lint step.

## Deferred Technical Debt

- **`build.target: 'esnext'`** — Vite config spec calls for `'esnext'` but currently uses the Vite default `'modules'`.
- **html2canvas + DOMPurify in bundle** — Pulled in as transitive jsPDF dependencies (~55 KB gzipped); investigate tree-shaking or a lighter alternative.
- **General DATE entity type** — Beyond `DATE_OF_BIRTH`; low priority since generic dates rarely constitute PII.
- **Spy-level test ordering** — Sequential canvas processing in the redaction pipeline tests depends on execution order; needs proper isolation.
- **Processing gate controller cleanup** — Gate controller is not cleared on successful detection completion (cosmetic, no user impact).
