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
import { repackage } from '../redactor/repackager'
import type { PageViewport } from '../redactor/repackager'

/** Progress callback: (currentPage, totalPages) */
export type RedactionProgressCallback = (page: number, total: number) => void

/**
 * Orchestrate the full redaction pipeline:
 * 1. Load the PDF
 * 2. For each page sequentially:
 *    a. Render at 300 DPI (with fallback to 240 DPI)
 *    b. Get REDACT-only entities for this page
 *    c. Burn black quads onto the canvas
 *    d. Collect canvas + viewport for repackaging
 *    e. After repackaging, release canvas memory
 *    f. Call page.cleanup()
 * 3. Repackage all pages into a single output PDF via jsPDF
 * 4. Return the output Blob
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
  onPassword?: OnPasswordCallback
): Promise<Blob> {
  // Dynamic import to avoid pulling pdfjs-dist into unit test bundles
  const { loadPDF, destroyPDF } = await import('../pdf/loader')

  const { pdf, numPages } = await loadPDF(file, onPassword)

  try {
    const pageCanvases: HTMLCanvasElement[] = []
    const pageViewports: PageViewport[] = []

    // Build a map of page → REDACT quads for fast lookup
    const redactQuadsByPage = buildRedactQuadsMap(entities)

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)

      // Get the viewport at scale=1 for page dimensions in pt
      const baseViewport = page.getViewport({ scale: 1 })
      pageViewports.push({
        width: baseViewport.width,
        height: baseViewport.height,
      })

      // Render the page at 300 DPI (with fallback to 240 DPI)
      let canvas: HTMLCanvasElement
      let renderScale = FINAL_SCALE
      try {
        canvas = await renderPage(page, FINAL_SCALE)
      } catch {
        // Memory pressure fallback: retry at 240 DPI
        renderScale = FALLBACK_SCALE
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

      pageCanvases.push(canvas)

      // Report progress
      onProgress?.(pageNum, numPages)

      // Release page resources
      page.cleanup()
    }

    // Repackage all page canvases into a single output PDF
    const blob = repackage(pageCanvases, pageViewports)

    // Release canvas memory
    for (const canvas of pageCanvases) {
      canvas.width = 0
      canvas.height = 0
    }

    return blob
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
