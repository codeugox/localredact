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

Pre-built test fixture PDFs are available at `tests/fixtures/*.pdf`. Validators MUST use these fixtures instead of creating PDFs on-the-fly. The fixtures are designed with precise spacing to test context-sensitive detection correctly.

**CRITICAL for context-sensitive assertions (VAL-DETECT-007, VAL-DETECT-011):** These fixtures place labeled and unlabeled values on SEPARATE PAGES to prevent context label bleed. Do NOT create single-page fixtures for these assertions — the 80-char context lookbehind window will cause false positives if both values are on the same page.

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
- Automation note: the upload control is a hidden `input[type=file]`; validators should target that element directly instead of the visible browse button.
- Automation note: set `--download-path` when opening the browser session. In headless runs, downloaded files may appear with UUID filenames; use the app's download filename attribute plus latest downloaded artifact for verification.
- Automation note: if headless PDF viewer rendering is limited, verify rasterization/text absence and metadata via artifact-side inspection (e.g., pdfjs/pypdf) and capture evidence output.

## Flow Validator Guidance: agent-browser

- Stay on the assigned assertion list only; do not test unrelated contract IDs.
- Use a unique non-default browser session per validator to keep state isolated.
- Use the shared app URL: `http://localhost:5173`.
- Do not start/stop the shared Vite service from flow validators.
- Keep any generated fixtures and downloaded outputs inside your assigned evidence directory only.
- If a flow requires multiple attempts (e.g., wrong password then correct), keep them within the same session and capture both results.
- Capture required evidence for each assertion (screenshots, DOM checks, console/network observations) in the flow report.
