# README and Copy (V2 — Updated for V1.0 Release)

Supersedes the original 05-readme-and-copy.md.
All copy reflects the actual shipped V1.0 codebase.

---

## GitHub README

*Copy this verbatim into README.md in the repo root.*

---

```markdown
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

Drop a PDF. The app finds and highlights personal information —
SSNs, names, addresses, phone numbers, credit cards, account
numbers — and lets you review every detection before anything
is removed.

Choose your mode. **Identity only** keeps all financial figures
(wages, withholding, deductions) while removing everything that
identifies you. **Full redaction** removes everything detected.

Review the highlights. Click any highlight to toggle it. When
you're satisfied, click **Download redacted PDF**.

The output is a new PDF where each page has been converted to a
high-resolution image (300 DPI) with black bars burned in at the
pixel level. The output contains no text layer and no searchable
content — the redacted information is not hidden behind a box,
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
- Person names (when labeled — e.g., "Patient: Jane Doe")

Keeps all financial data:

- All dollar amounts (wages, taxes, deductions)
- Tax year and pay period dates
- Form numbers and box labels

### Full redaction

Removes everything detected, including financial figures.

---

## How the redaction works

Most redaction tools draw a black box on top of text. The text
is still in the file — select it, copy it, or open the PDF in
a text editor and it's readable. This is how well-known document
leak incidents have happened.

Local Redact works differently. Each page is rendered to a
high-resolution image (300 DPI). Black rectangles are drawn
over the detected regions at the pixel level. The images are
then assembled into a new PDF. The output contains only raster
images — no text layer, no searchable content, and no original
metadata.

---

## Detection

V1.0 uses **pattern matching** to detect structured PII:

- SSNs and ITINs (with SSA validity rules)
- EINs (context-aware — labels like "EIN:" boost confidence)
- Credit card numbers (Visa, Mastercard, Amex, Discover — validated with Luhn checksum)
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
| `npm test` | Run all tests (723 tests) |
| `npm run typecheck` | TypeScript type checking only |

---

## Roadmap

- [x] Regex + checksum detection (SSN, EIN, credit cards, phones, emails, addresses, accounts)
- [x] Context-sensitive scoring (labels boost confidence, ambiguous values flagged for review)
- [x] Rasterized redaction — pixel-level, no text layer in output
- [x] Identity-only and full-redaction modes
- [x] Preview screen with per-entity toggle and live summary
- [x] Password-protected PDF support
- [x] Keyboard shortcuts (Tab / R / K) for efficient review
- [ ] NER model for names in narrative text (v1.1)
- [ ] Scanned document / OCR support (v1.2)
- [ ] Image file support — JPG, PNG (v1.2)
- [ ] Batch processing — multiple files, ZIP download (v1.3)
- [ ] Desktop app — Mac + Windows (v3.0)

---

## Contributing

Issues and pull requests are welcome.

If you find a document type where detection is weak, open an
issue describing what was missed and what type of document it
was. **Never share real documents or real PII in issues** — use
synthetic examples.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

## Background

Built because people upload W-2s, 1099s, and bank statements
to AI tools and file-sharing platforms without realizing the
data leaves their device. Local Redact solves that by keeping
the browser in charge of all the work.

The zero-data architecture is not a marketing claim — it is
a technical constraint. The app ships with `connect-src 'none'`
in its Content Security Policy, and there is no server endpoint
to send data to.
```

---

## Logo

The logo is the inline SVG favicon at `public/favicon.svg` — a document icon with a black redaction bar across the middle. To include it in the README:

```markdown
<p align="center">
  <img src="public/favicon.svg" width="64" alt="Local Redact" />
</p>
```

GitHub renders SVGs from the repo natively. The `width="64"` keeps it crisp without dominating the page. If you later want a wider wordmark version (icon + "localredact" text), export one to `_design/logo.svg` or `public/logo.svg` and swap the path.

For social previews (Twitter/LinkedIn cards), you'll need a PNG or JPG `og:image` since most platforms don't render SVG in link previews. Export a 1200×630 PNG with the logo centered on the `#F4F1EC` background color and add it as:

```html
<meta property="og:image" content="https://localredact.app/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
```

---

## Repo Description (One Line)

*Used as the GitHub repo's About description.*

```
Browser-based PII redaction for PDFs. No uploads. No server. Your document stays on your device.
```

---

## Zero-Data Trust Copy

Three versions at different lengths. Use the right one for each context.

---

### One Line
*For the preview screen left panel and done screen confirmation.*

```
Your document was processed locally and never uploaded by this app.
```

---

### Two Sentences
*For below the drop zone on the landing screen.*

```
Everything runs locally in your browser.
Your document is never uploaded or transmitted.
```

---

### Short Paragraph
*For an About or FAQ section, or a dedicated explainer block.*

```
Most online tools process your documents on a server
somewhere. This one does not. Detection and redaction run
entirely inside your browser tab. There is no backend and
no server to send data to. The app enforces connect-src
'none' in its Content Security Policy, which blocks all
outbound network requests. Open your browser's Network tab
while using the app and you will see zero outbound requests
after the page loads. Your documents stay on your device.
```

---

## Social / Launch Copy

### Hacker News Show HN

```
Show HN: Local Redact – browser-based PII redaction, nothing leaves your device

Tax season: people are uploading W-2s, 1099s, and bank
statements to AI tools. The data leaves their device.

Built a tool that redacts PII entirely in the browser.
Regex-based detection with context-sensitive scoring (labels
like "SSN:" and "Account Number:" boost confidence, ambiguous
patterns get flagged for review). No backend. No uploads.

Drop a PDF, review the highlighted PII, download a redacted
version with black bars burned into the pixels — each page
is rasterized at 300 DPI before the bars are drawn, so the
output has no text layer. Keeps financial figures intact in
"identity only" mode for the tax doc sharing use case.

Stack: Preact, PDF.js, jsPDF, Vite. CSP with connect-src
'none'. Open DevTools Network tab while using it — zero
outbound requests.

https://localredact.app — MIT licensed, source on GitHub.

Happy to answer questions about the architecture.
```

---

### Twitter / X

```
Built a PII redactor that runs entirely in your browser.

Drop your W-2. It finds SSNs, addresses, account numbers.
Review the highlights. Download a redacted PDF.

Your file never leaves your device. Open DevTools — zero
network requests.

No server. No account. Free.

https://localredact.app
```

```
It's tax season and people are uploading their W-2s to AI
tools.

Those files leave your device. Your SSN goes with them.

Built something that redacts the sensitive parts right in
your browser — nothing transmitted.

https://localredact.app
```

---

### LinkedIn

```
Built a side project that feels timely: a browser-based PII
redaction tool for PDFs.

The use case that motivated it: it's tax season, and people
are uploading W-2s and 1099s to AI tools, financial apps,
and file-sharing platforms without realizing the data is
leaving their device.

Local Redact runs entirely in the browser. Drop a PDF, it
finds SSNs, addresses, account numbers, phone numbers, and
email addresses, and lets you review what it found before
committing. Then it downloads a new PDF with the sensitive
content burned out at the pixel level — each page is
rasterized at 300 DPI, so the output has no text layer.

"Identity only" mode keeps all the financial figures intact
while removing the identifying information. Useful for
sharing a tax document without sharing your identity.

The app ships with connect-src 'none' in its Content
Security Policy — zero outbound requests after the page
loads. Open DevTools and verify it yourself.

MIT licensed. Source on GitHub. Built with Preact, PDF.js,
and jsPDF.

https://localredact.app
```

---

## FAQ Copy

Short answers for a potential FAQ section.

**Does this work on scanned documents?**
Version 1.0 works on digital PDFs with a text layer (most PDFs created by software). Support for scanned documents via OCR is planned for v1.2.

**Can I use this on my phone?**
It works but is designed for desktop browsers. A mobile-optimized layout is planned for a future release.

**What if the detector misses something?**
The preview screen shows every detection before anything is removed. You can click any highlight to toggle between redact and keep. We recommend reviewing the full document before downloading.

**How does the redaction work?**
Each page is rendered to a high-resolution image (300 DPI). Black bars are drawn over the detected regions at the pixel level. The images are assembled into a new PDF. The output contains only images — no text layer, no searchable content, and no metadata from the original file.

**What types of PII does it detect?**
Social Security Numbers, ITINs, EINs, credit card numbers (Luhn-validated), US phone numbers, email addresses, street addresses, city/state/ZIP, bank account and routing numbers, dates of birth, passport numbers, and labeled person names. Dollar amounts are detected and kept visible in Identity mode.

**Is there a file size limit?**
50 MB per file. This covers the vast majority of real-world documents.

**What about password-protected PDFs?**
Supported. The app prompts for the password, uses it locally to unlock the document, and never stores or transmits it.

**Can I trust that nothing is transmitted?**
The app enforces `connect-src 'none'` via Content Security Policy, which instructs the browser to block all outbound connections. Open DevTools → Network tab and drop a file — you'll see zero outbound requests. There is no server endpoint to send data to.

**What does "Identity only" mode keep?**
All dollar amounts, tax year dates, form numbers, and box labels. Everything that identifies a person — names, SSN, addresses, phone numbers, accounts — is redacted.
