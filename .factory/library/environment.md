# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Dependencies

- **pdfjs-dist 5.5.207** — PDF rendering and text extraction. ESM-only (`.mjs`). Ships own TypeScript types. Worker file: `pdf.worker.min.mjs`.
- **jsPDF 2.5.2** — Output PDF assembly. Use `unit: 'pt'` for PDF coordinate space.
- **preact 10.25.4** — UI framework (~3KB gzipped).
- **@preact/signals 2.0.2** — Fine-grained reactivity for state management.

## Dev Dependencies

- **vite 6.3.2** — Build tool. Must exclude `pdfjs-dist` from `optimizeDeps`.
- **@preact/preset-vite 2.9.4** — Preact JSX transform for Vite.
- **typescript 5.8.3** — Strict mode enabled.
- **vitest 3.1.1** — Test runner. Uses `jsdom` environment.
- **jsdom 26.0.0** — DOM simulation for tests.

## Known Quirks

- **pdfjs-dist worker**: Must set `GlobalWorkerOptions.workerSrc` before any `getDocument()` call. Use `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` for Vite compatibility.
- **Vite + pdfjs-dist**: `optimizeDeps.exclude: ['pdfjs-dist']` is required to prevent Vite from breaking the worker.
- **jsPDF producer field**: `setProperties({ producer: '' })` may not fully remove the `/Producer` entry from the PDF trailer. This is acceptable.
- **Canvas memory**: Setting `canvas.width = 0` releases GPU memory more reliably than waiting for GC.
- **pdfjs-dist render()**: v5 prefers `canvas` parameter over `canvasContext`. Both work.

## External Services

None. Fully client-side application. No API keys, no databases, no external dependencies at runtime.
