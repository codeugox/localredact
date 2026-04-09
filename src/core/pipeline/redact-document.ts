// src/core/pipeline/redact-document.ts
// Redaction pipeline orchestrator: load PDF → for each page sequentially:
// render at 300 DPI → filter REDACT entities → burn quads → embed into jsPDF →
// release canvas → page.cleanup() → next page. Return output Blob.
// Framework-agnostic — no Preact imports.

import type { DetectedEntity, Quad } from '../detectors/entities'
import type { OnPasswordCallback } from '../pdf/loader'
import type { Viewport } from '../../utils/coords'
import { renderPage, FINAL_SCALE, FALLBACK_SCALE } from '../redactor/rasterizer'
import { burnRedactions } from '../redactor/burner'
import { createDoc, addPageToDoc, finalizeDoc } from '../redactor/repackager'
import type { PageViewport } from '../redactor/repackager'

/** DPI fallback warning message shown when 300 DPI canvas creation fails */
export const DPI_FALLBACK_WARNING =
  '⚠ Reduced output quality due to memory constraints. The redaction is still complete and irreversible.'

/** Progress callback: (currentPage, totalPages) */
export type RedactionProgressCallback = (page: number, total: number) => void

/**
 * Orchestrate the full redaction pipeline:
 * 1. Load the PDF
 * 2. For each page sequentially:
 *    a. Render at 300 DPI (with fallback to 240 DPI)
 *    b. Get REDACT-only entities for this page
 *    c. Burn black quads onto the canvas
 *    d. Embed page into jsPDF immediately after burn
 *    e. Release canvas memory (width=0) before processing next page
 *    f. Call page.cleanup() before processing next page
 * 3. Finalize jsPDF document (strip metadata) and return output Blob
 *
 * Memory optimization: each page canvas is embedded into jsPDF and released
 * immediately, so at most one 300 DPI canvas is held in memory at a time.
 *
 * Only entities with decision === 'REDACT' are burned. KEEP and UNCERTAIN
 * entities are left visible in the output.
 *
 * @param file - The original PDF file
 * @param entities - All detected entities (from detection pipeline)
 * @param onProgress - Optional progress callback (page, total)
 * @param onPassword - Optional callback for password-protected PDFs
 * @returns The redacted PDF as a Blob
 */
export async function redactDocument(
  file: File,
  entities: DetectedEntity[],
  onProgress?: RedactionProgressCallback,
  onPassword?: OnPasswordCallback,
  onDpiFallback?: () => void
): Promise<Blob> {
  // Dynamic import to avoid pulling pdfjs-dist into unit test bundles
  const { loadPDF, destroyPDF } = await import('../pdf/loader')

  const { pdf, numPages } = await loadPDF(file, onPassword)

  try {
    // Build a map of page → REDACT quads for fast lookup
    const redactQuadsByPage = buildRedactQuadsMap(entities)

    // Track whether DPI fallback was triggered for any page
    let usedFallback = false

    // jsPDF document is created incrementally — each page is embedded
    // immediately after burning, then the canvas is released before
    // processing the next page. This avoids holding all 300 DPI
    // canvases in memory simultaneously.
    let doc: ReturnType<typeof createDoc> | null = null

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)

      // Get the viewport at scale=1 for page dimensions in pt
      const baseViewport = page.getViewport({ scale: 1 })
      const pageViewport: PageViewport = {
        width: baseViewport.width,
        height: baseViewport.height,
      }

      // Create the jsPDF document on first page
      if (doc === null) {
        doc = createDoc(pageViewport)
      }

      // Render the page at 300 DPI (with fallback to 240 DPI)
      let canvas: HTMLCanvasElement
      let renderScale = FINAL_SCALE
      try {
        canvas = await renderPage(page, FINAL_SCALE)
      } catch {
        // Memory pressure fallback: retry at 240 DPI
        renderScale = FALLBACK_SCALE
        usedFallback = true
        canvas = await renderPage(page, FALLBACK_SCALE)
      }

      // Burn redaction quads onto the canvas
      const quads = redactQuadsByPage.get(pageNum) ?? []
      if (quads.length > 0) {
        const renderViewport = page.getViewport({ scale: renderScale })
        // pdfjs-dist types return `any[]` from convertToViewportPoint,
        // but the runtime always returns a 2-element array. Cast to our Viewport.
        burnRedactions(canvas, quads, renderViewport as unknown as Viewport)
      }

      // Embed page into jsPDF immediately after burn
      addPageToDoc(doc, canvas, pageViewport, pageNum - 1)

      // Release canvas memory immediately — no longer needed
      canvas.width = 0
      canvas.height = 0

      // Report progress
      onProgress?.(pageNum, numPages)

      // Release page resources before processing next page
      page.cleanup()
    }

    if (!doc) {
      throw new Error('No pages to process')
    }

    // Notify caller if DPI fallback was used on any page
    if (usedFallback && onDpiFallback) {
      onDpiFallback()
    }

    // Finalize the document: strip metadata and return blob
    return finalizeDoc(doc)
  } finally {
    await destroyPDF(pdf)
  }
}

/**
 * Build a map of page number → REDACT quads from the entity list.
 * Only includes entities with decision === 'REDACT'.
 *
 * @param entities - All detected entities
 * @returns Map from page number to array of quads to burn
 */
function buildRedactQuadsMap(entities: DetectedEntity[]): Map<number, Quad[]> {
  const map = new Map<number, Quad[]>()

  for (const entity of entities) {
    if (entity.decision !== 'REDACT') continue

    const existing = map.get(entity.page)
    if (existing) {
      existing.push(...entity.quads)
    } else {
      map.set(entity.page, [...entity.quads])
    }
  }

  return map
}
