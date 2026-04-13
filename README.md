<p align="center">
  <img src="public/favicon.svg" width="64" alt="Local Redact" />
</p>

<h1 align="center">Local Redact</h1>

<p align="center">
  Redact PII from PDF documents entirely in your browser.<br />
  No uploads. No server. Your document stays on your device.
</p>

<p align="center">
  <a href="https://localredact.app"><strong>localredact.app</strong></a>
</p>

---

## What it does

Drop a PDF. The app finds and highlights personal information
(SSNs, names, addresses, phone numbers, credit cards, account
numbers) and lets you review every detection before anything
is removed.

Choose your mode. **Identity only** keeps all financial figures
(wages, withholding, deductions) while removing everything that
identifies you. **Full redaction** removes everything detected.

Review the highlights. Click any highlight to toggle it. When
you're satisfied, click **Download redacted PDF**.

The output is a new PDF where each page has been converted to a
high-resolution image (300 DPI) with black bars burned in at the
pixel level. The output contains no text layer and no searchable
content. The redacted information is not hidden behind a box,
it is replaced with solid black pixels.

---

## Who it's for

Anyone who needs to share a document without sharing everything
in it.

- Sharing a W-2 or 1099 with your accountant but not your SSN
- Uploading a financial statement without exposing account numbers
- Sending a document for review without your identity attached

---

## Privacy

Everything runs in your browser tab. There is no backend.
No data is transmitted.

You can verify this yourself: open your browser's DevTools,
go to the Network tab, and drop a file. Zero outbound requests
after the page loads.

The app enforces `connect-src 'none'` via Content Security Policy,
which instructs the browser to block all outbound connections.
Your documents are processed locally and never uploaded by this app.

---

## Redaction modes

### Identity only (recommended for tax documents)

Removes everything that identifies a person:

- Social Security Number / ITIN
- Employer Identification Number (EIN)
- Street address, city, state, ZIP
- Phone numbers and email addresses
- Credit card numbers
- Bank account and routing numbers
- Dates of birth
- Passport numbers
- Person names (when labeled, e.g. "Patient: Jane Doe")

Keeps all financial data:

- All dollar amounts (wages, taxes, deductions)
- Tax year and pay period dates
- Form numbers and box labels

### Full redaction

Removes everything detected, including financial figures.

---

## How the redaction works

Most redaction tools draw a black box on top of text. The text
is still in the file. Select it, copy it, or open the PDF in
a text editor and it's readable. This is how well-known document
leak incidents have happened.

Local Redact works differently. Each page is rendered to a
high-resolution image (300 DPI). Black rectangles are drawn
over the detected regions at the pixel level. The images are
then assembled into a new PDF. The output contains only raster
images, no text layer, no searchable content, and no original
metadata.

---

## Detection

Local Redact uses **pattern matching** to detect structured PII:

- SSNs and ITINs (with SSA validity rules)
- EINs (context-aware: labels like "EIN:" boost confidence)
- Credit card numbers (Visa, Mastercard, Amex, Discover, validated with Luhn checksum)
- US phone numbers
- Email addresses
- Street addresses and city/state/ZIP
- Bank account and routing numbers (context-required to avoid false positives)
- Dates of birth
- Passport numbers
- Person names (when preceded by a form label like "Name:", "Patient:", etc.)
- Dollar amounts (detected and kept visible in Identity mode)

Detection is context-sensitive: when a value like `12-3456789`
appears near a label like "EIN:", confidence is higher. Without
context, ambiguous patterns are flagged for your review rather
than auto-redacted.

---

## Features

- Context-sensitive regex detection with confidence scoring
- Rasterized redaction at 300 DPI (no text layer in output)
- Identity-only and full-redaction modes
- Interactive preview with per-entity toggle and live summary
- Password-protected PDF support
- Keyboard shortcuts (Tab / R / K) for efficient review

More detection capabilities and file format support coming soon.

---

## Stack

| Library | Purpose |
|---|---|
| [Preact](https://preactjs.com/) + [Signals](https://preactjs.com/guide/v10/signals/) | UI framework (~3KB) with fine-grained reactivity |
| [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla) | PDF rendering and text extraction |
| [jsPDF](https://github.com/parallax/jsPDF) | Output PDF assembly |
| [Vite](https://vite.dev/) + TypeScript | Build tooling |

No backend. No database. No accounts. No analytics. No third-party scripts.

---

## Run locally

```bash
git clone https://github.com/codeugox/localredact.git
cd localredact
npm install
npm run dev
```

Open `http://localhost:5173`

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build |
| `npm test` | Run all tests |
| `npm run typecheck` | TypeScript type checking only |

---

## Contributing

Issues and pull requests are welcome.

If you find a document type where detection is weak, open an
[issue](https://github.com/codeugox/localredact/issues) describing what was missed and what type of document it
was. **Never share real documents or real PII in issues.** Use
synthetic examples.

---

## License

[MIT](LICENSE)

---

## Background

Built because people upload W-2s, 1099s, and bank statements
to AI tools and file-sharing platforms without realizing the
data leaves their device. Local Redact solves that by keeping
the browser in charge of all the work.

The zero-data architecture is not a marketing claim. It is
a technical constraint. The app ships with `connect-src 'none'`
in its Content Security Policy, and there is no server endpoint
to send data to.
