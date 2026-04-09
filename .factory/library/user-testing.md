# User Testing

Testing surface, required testing skills/tools, and resource cost classification.

---

## Validation Surface

**Primary surface:** Browser (Vite dev server at http://localhost:5173)
**Tool:** agent-browser
**App type:** Single-page application, no auth, no backend

### User Entry Point
Navigate to http://localhost:5173. The drop screen loads immediately — no login, no setup.

### Test Data Requirements
- PDF files with known PII patterns (SSN, email, phone, address, credit card, EIN, etc.)
- Password-protected PDF for password flow testing
- Multi-page PDF (3+ pages) with entities on different pages
- PDF with only generic text (no PII) for no-PII testing
- Non-PDF files (.txt, .jpg) for rejection testing
- PDF with scanned images only (no text layer) for edge case testing

Workers should create test fixture PDFs programmatically or include minimal test PDFs in `/tests/fixtures/`.

### Key Flows to Test
1. Drop file → processing → preview → review → download → done
2. Mode selection (Identity only vs Full redaction)
3. Entity toggle (click, keyboard R/K, Tab navigation)
4. Page navigation (thumbnails, prev/next)
5. Start over (from preview, from done)
6. Password-protected PDF flow
7. Error handling (non-PDF, oversized, corrupted, scanned)

## Validation Concurrency

**Machine:** 32GB RAM, 10 CPU cores
**Baseline usage:** ~6-8GB RAM used by system processes
**Available headroom:** ~24GB, using 70% = ~16.8GB budget

**agent-browser:**
- Dev server (Vite): ~200MB
- Each agent-browser instance: ~300MB
- 5 instances + dev server = 1.7GB (well within budget)
- **Max concurrent validators: 5**

## Notes
- No auth barriers — validators can navigate directly to the app
- File interactions require drag-and-drop or file picker automation via agent-browser
- Output PDF verification requires downloading and inspecting the file
