# Local Redact

Redact PII from PDFs entirely in your browser.

---

## What It Does

Drop a PDF and Local Redact finds personal information — SSNs, addresses, phone numbers, credit cards, account numbers, and more — using client-side regex pattern matching. Review color-coded highlights, toggle anything the detector got wrong, then download a new PDF with the sensitive content permanently removed.

Everything runs in your browser tab. Your document never leaves your device.

## 🔒 Privacy

Local Redact has a zero-server architecture. There is no backend, no database, and no accounts.

- **CSP `connect-src 'none'`** — the page cannot make network requests
- **No storage** — nothing is written to localStorage, IndexedDB, or cookies
- **No analytics** — no tracking scripts, no telemetry, no third-party requests

Open DevTools → Network tab while using the app. You will see zero outbound requests after the page loads. The architecture makes data transmission technically impossible, not just a policy choice.

## Redaction Modes

### Identity Only

Removes everything that identifies a person — names, SSN, address, phone, email, bank accounts — while **keeping all dollar amounts** (wages, taxes, withholding, deductions). Recommended for sharing tax documents with an accountant or financial institution.

### Full Redaction

Removes all detected PII including financial figures. Use when no content from the original should survive.

## How It Works

1. **Detect** — Structured PII is found via regex patterns with validation (Luhn checksum for credit cards, format rules for SSNs/EINs, etc.). Runs instantly with no model download.
2. **Review** — Detected entities are shown as color-coded highlights grouped by category. Toggle individual items on or off before committing.
3. **Burn** — Each page is rendered to a high-resolution image. Black bars are drawn over detected regions at the pixel level. Pages are repackaged into a new PDF at **300 DPI**. The output contains no text layer and no recoverable content — the original data is destroyed, not hidden.

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| Preact | 10.25 | UI framework |
| pdfjs-dist | 5.5 | PDF rendering and text extraction |
| jsPDF | 2.5 | Output PDF assembly |
| Vite | 6 | Dev server and bundler |
| TypeScript | 5.8 | Type safety |
| Vitest | 3.1 | Unit and integration tests |

No backend. No database. No accounts.

## Run Locally

```bash
git clone https://github.com/yourname/local-redact.git
cd local-redact
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Scripts

| Command | Description |
|---|---|
| `npm test` | Run unit and integration tests |
| `npm run typecheck` | TypeScript type checking (no emit) |
| `npm run build` | Type check + production build |

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 118+ | Fully supported |
| Firefox | 115+ | Fully supported |
| Safari | 16.4+ | Fully supported |
| Edge | 118+ | Fully supported |
| Mobile Chrome | Latest | Works (desktop recommended) |
| Mobile Safari | Latest | Works (desktop recommended) |
| Internet Explorer | Any | Not supported |

The app is optimized for desktop browsers. On mobile devices, a banner will suggest switching to desktop for the best experience. See the [FAQ](/faq.html) for more details.

## Roadmap

| Version | Milestone | Status |
|---|---|---|
| V1.0 | Regex + checksum detection, rasterized redaction, identity-only and full modes | Done |
| V1.1 | NER model for names and contextual PII in narrative text | Planned |
| V1.2 | Image and OCR support for scanned documents | Planned |

## FAQ

See the [Frequently Asked Questions](/faq.html) page for answers about browser support, privacy verification, PII types detected, and more.

## License

MIT — free to use, modify, and distribute.
