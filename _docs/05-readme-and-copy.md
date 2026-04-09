# README and Copy

This file contains all written content for the project:
the GitHub README, the zero-data trust copy in three lengths,
and the repo description line.

Write these before writing code. If you cannot describe
what the tool does clearly, the design is not clear enough yet.

---

## GitHub README

*Copy this verbatim into README.md in the repo root.*
*Replace [AppName] and [yourdomain.app] with real values.*

---

```markdown
# [AppName]

Redact PII from PDF documents entirely in your browser.
No uploads. No server. Nothing leaves your device.

## Try it

**[yourdomain.app](https://yourdomain.app)**

---

## What it does

Drop a PDF. The app finds and highlights personal information —
SSNs, names, addresses, phone numbers, credit cards, account
numbers — and lets you review before anything is removed.

Choose your mode. **Identity only** keeps all financial figures
(wages, withholding, deductions) while removing everything that
identifies you. **Full redaction** removes everything detected.

Review the highlights. Toggle anything the detector got wrong.
Click Redact and Download.

The output is a new PDF with black bars burned into the page at
the pixel level. No text layer. No recoverable content. The
original data is gone — not hidden.

---

## Who it's for

Anyone who needs to share a document without sharing everything
in it.

- Sharing a W-2 or 1099 with your accountant but not your SSN
- Uploading a financial statement somewhere without exposing
  your account numbers
- Sending a document for review without attaching your identity
  to it

---

## Privacy

Everything runs in your browser tab using WebAssembly and
local processing. There is no backend. No data is transmitted.

You can verify this yourself: open your browser's DevTools,
go to the Network tab, and drop a file. Zero outbound requests.

Your documents stay on your device.

---

## Redaction modes

### Identity only (recommended for tax documents)

Removes everything that identifies a person:

- Full name
- Social Security Number / ITIN
- Street address, city, state, ZIP
- Phone numbers and email addresses
- Bank account and routing numbers
- Dates of birth

Keeps all financial data:

- All dollar amounts (wages, taxes, deductions)
- Tax year and pay period dates
- Form numbers and box labels

### Full redaction

Removes everything detected, including financial figures.

---

## How the redaction works

Most redaction tools draw a black box on top of text. The text
is still in the file — copy it, open it in a text editor, and
it's readable. This is how many famous document leak incidents
happened.

This tool does something different. Each page is converted to
a high-resolution image first. Black rectangles are drawn over
the detected regions at the pixel level. The images are
repackaged into a new PDF. The output has no text layer and
no recoverable content. The original data is not hidden — it
is destroyed.

---

## Detection

Detection runs in two layers.

**Pattern matching** handles structured PII: SSNs and ITINs,
EINs, credit card numbers (validated with Luhn checksum), phone
numbers, email addresses, street addresses, bank account and
routing numbers, dates of birth. This runs instantly with no
model required.

**Named entity recognition** handles contextual PII: names and
addresses in narrative text. Runs on demand after downloading
a small quantized model (~45MB, cached permanently after the
first use). Based on a fine-tuned BERT model running via
Transformers.js and ONNX Runtime — entirely in your browser.

---

## Stack

| Library | Purpose |
|---|---|
| PDF.js (Mozilla) | PDF rendering and text extraction |
| Tesseract.js | OCR for scanned documents |
| Transformers.js (HuggingFace) | NER model inference in browser |
| pdf-lib | Output PDF assembly |
| Workbox | Service Worker and caching |
| Vite + TypeScript | Build tooling |
| GitHub Pages | Hosting |

No backend. No database. No accounts.

---

## Run locally

```bash
git clone https://github.com/yourname/appname
cd appname
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Roadmap

- [x] Regex + checksum detection (SSN, EIN, credit cards, phones, emails, addresses, accounts)
- [x] Rasterized redaction — pixel-level, no text layer in output
- [x] Identity-only and full-redaction modes
- [x] Preview screen with per-entity toggle
- [ ] NER model for names in narrative text (v1.1)
- [ ] Image file support — JPG, PNG (v1.2)
- [ ] Batch processing — multiple files, ZIP download (v1.3)
- [ ] Fine-tuned model on US tax documents (v2.0)
- [ ] Desktop app — Mac + Windows (v3.0)

---

## Contributing

Issues and pull requests welcome. See [CONTRIBUTING.md] for
guidelines.

If you find a document type where detection is weak, open an
issue with a description of what was missed (not the document
itself — never share real documents in issues).

---

## License

MIT — free to use, modify, and distribute.

---

## Background

Built because it's tax season and people are uploading W-2s
and 1099s to AI tools without realizing the data is leaving
their device. This tool solves that by making the browser do
all the work.

The zero-data architecture is not a marketing claim — it is
a technical constraint. The app has no server to send data
to even if it wanted to.
```

---

## Repo Description (One Line)

*Used as the GitHub repo's About description.*

```
Browser-based PII redaction. No uploads. No server. Nothing leaves your device.
```

---

## Zero-Data Trust Copy

Three versions at different lengths. Use the right one for each context.

---

### One Line
*For the preview screen left panel and done screen confirmation.*

```
🔒 Your document never left this browser tab.
```

---

### Two Sentences
*For below the drop zone on the landing screen.*

```
Everything runs locally in your browser.
Your document is never uploaded, transmitted, or stored.
```

---

### Short Paragraph
*For an About or FAQ section, or a dedicated explainer block.*

```
Most online tools process your documents on a server
somewhere. This one does not. Detection and redaction run
entirely inside your browser tab using WebAssembly — the same
technology that powers local video editors and design tools.
There is no backend. There is no server. Open your browser's
Network tab while using the app and you will see zero
outbound requests after the page loads. Your documents stay
on your device.
```

---

## Social / Launch Copy

### Hacker News Show HN

```
Show HN: [AppName] – browser-based PII redaction, nothing leaves your tab

Tax season: people are uploading W-2s, 1099s, and bank
statements to AI tools. The data leaves their device.

Built a tool that redacts PII entirely in the browser using
PDF.js + Tesseract.js + a quantized NER model. No backend.
No uploads. Open DevTools Network tab while using it — zero
outbound requests.

Drop a PDF, review the highlighted PII, download a redacted
version with black bars burned into the pixels (not just
overlaid — no text layer in the output). Keeps financial
figures intact in "identity only" mode for the tax doc
sharing use case.

[URL] — MIT licensed, source on GitHub.

Happy to answer questions about the architecture.
```

---

### Twitter / X

```
Built a PII redactor that runs entirely in your browser.

Drop your W-2. It finds SSNs, addresses, account numbers.
Review the highlights. Download a redacted PDF.

Your file never leaves your tab. Open DevTools — zero
network requests.

No server. No account. Free.

[URL]
```

```
It's tax season and people are uploading their W-2s to AI
tools.

Those files leave your device. Your SSN goes with them.

Built something that redacts the sensitive parts in your
browser with nothing transmitted.

[URL]
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

[AppName] runs entirely in the browser. Drop a PDF, it finds
SSNs, addresses, account numbers, phone numbers, and email
addresses, lets you review what it found before committing,
then downloads a new PDF with the sensitive content burned
out at the pixel level. No text layer in the output — not
just covered up, actually gone.

"Identity only" mode keeps all the financial figures intact
while removing the identifying information. Useful for
sharing a tax document without sharing your identity.

Zero network requests after the page loads. Open DevTools
and verify it yourself.

MIT licensed. Source on GitHub. Built on PDF.js, pdf-lib,
and Transformers.js.

[URL]
```

---

## FAQ Copy

Short answers for a potential FAQ section.

**Does this work on scanned documents?**
Version 1.0 works best on digital PDFs with a text layer (most PDFs created by software). Support for scanned documents and images is coming in v1.2.

**Can I use this on my phone?**
It will work but is optimized for desktop browsers. A proper mobile layout is coming in v1.1.

**What if the detector misses something?**
The preview screen shows everything detected before anything is removed. You can manually click any area of the document to add additional redactions before downloading. We recommend reviewing the full document before confirming.

**Is the redaction actually irreversible?**
Yes. Each page is converted to a flat image before the black bars are drawn. The output PDF contains only images — there is no text layer, no searchable content, and no metadata from the original file. This is different from most redaction tools that simply draw a black box over text that remains in the file.

**What types of PII does it find?**
Social Security Numbers, ITINs, EINs, credit card numbers (validated with Luhn checksum), US phone numbers, email addresses, street addresses, bank account numbers, routing numbers, and dates of birth. Name and address detection in narrative text requires enabling the optional NER model (v1.1).

**Is there a file size limit?**
50MB per file in v1.0. This covers the vast majority of real-world tax documents.

**Can I trust that nothing is transmitted?**
Open your browser's DevTools, go to the Network tab, and drop a file. You will see zero outbound requests. The architecture has no server endpoint to send data to — it is technically impossible for the tool to transmit your document.
