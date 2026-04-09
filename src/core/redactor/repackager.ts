// src/core/redactor/repackager.ts
// Creates an output PDF from per-page canvases via jsPDF.
// Supports both batch and incremental (page-at-a-time) assembly.
// Framework-agnostic — no Preact imports.

import { jsPDF } from 'jspdf'

/**
 * Minimal viewport interface for extracting page dimensions at scale=1 (in pt).
 */
export interface PageViewport {
  width: number
  height: number
}

/**
 * Assemble per-page canvases into a single output PDF.
 *
 * Uses jsPDF with unit='pt' so page dimensions match PDF coordinate space
 * exactly. Each canvas is embedded as a lossless PNG image filling the
 * entire page. Metadata is stripped to minimal values.
 *
 * @param pageCanvases - Array of rendered canvas elements (one per page)
 * @param pageViewports - Array of viewports at scale=1 (dimensions in pt)
 * @returns Output PDF as a Blob
 */
export function repackage(
  pageCanvases: HTMLCanvasElement[],
  pageViewports: PageViewport[]
): Blob {
  if (pageCanvases.length === 0) {
    throw new Error('No pages to repackage')
  }

  if (pageCanvases.length !== pageViewports.length) {
    throw new Error('Canvas count must match viewport count')
  }

  const firstVp = pageViewports[0]

  const doc = new jsPDF({
    unit: 'pt',
    format: [firstVp.width, firstVp.height],
    compress: true,
    putOnlyUsedFonts: true,
  })

  for (let i = 0; i < pageCanvases.length; i++) {
    const vp = pageViewports[i]

    if (i > 0) {
      doc.addPage([vp.width, vp.height])
    }

    doc.addImage(
      pageCanvases[i],
      'PNG',
      0,
      0,
      vp.width,
      vp.height,
      `page-${i}`,
      'NONE'
    )
  }

  // Strip metadata to minimal values
  // Note: jsPDF's DocumentProperties type does not include 'producer',
  // but the runtime API does accept it. We cast to strip the field
  // and rely on jsPDF's built-in minimal producer string.
  doc.setProperties({
    title: 'Redacted Document',
    creator: '',
    author: '',
    subject: '',
    keywords: '',
  })

  return doc.output('blob')
}

// ─── Incremental Assembly ───────────────────────────────────────────

/**
 * Create a new jsPDF document for incremental page assembly.
 * Pages are added one at a time via addPageToDoc, then finalized
 * via finalizeDoc. This avoids holding all page canvases in memory.
 *
 * @param firstPageViewport - Viewport of the first page (sets initial doc format)
 * @returns The jsPDF document instance
 */
export function createDoc(firstPageViewport: PageViewport): jsPDF {
  return new jsPDF({
    unit: 'pt',
    format: [firstPageViewport.width, firstPageViewport.height],
    compress: true,
    putOnlyUsedFonts: true,
  })
}

/**
 * Add a single page canvas to an existing jsPDF document.
 * Automatically calls addPage for pages after the first.
 *
 * @param doc - The jsPDF document
 * @param canvas - The rendered canvas for this page
 * @param viewport - Viewport at scale=1 (dimensions in pt)
 * @param pageIndex - Zero-based page index
 */
export function addPageToDoc(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  viewport: PageViewport,
  pageIndex: number
): void {
  if (pageIndex > 0) {
    doc.addPage([viewport.width, viewport.height])
  }

  doc.addImage(
    canvas,
    'PNG',
    0,
    0,
    viewport.width,
    viewport.height,
    `page-${pageIndex}`,
    'NONE'
  )
}

/**
 * Finalize an incrementally-assembled jsPDF document:
 * strip metadata and return the output Blob.
 *
 * @param doc - The jsPDF document
 * @returns Output PDF as a Blob
 */
export function finalizeDoc(doc: jsPDF): Blob {
  doc.setProperties({
    title: 'Redacted Document',
    creator: '',
    author: '',
    subject: '',
    keywords: '',
  })

  return doc.output('blob')
}
