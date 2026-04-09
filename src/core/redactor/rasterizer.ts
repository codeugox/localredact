// src/core/redactor/rasterizer.ts
// Renders a PDF page to a canvas at a given scale using pdfjs-dist.
// Framework-agnostic — no Preact imports.

import type { PDFPageProxy } from 'pdfjs-dist'

/** Preview scale: ~108 DPI */
export const PREVIEW_SCALE = 1.5

/** Final redaction scale: 300 DPI (300 / 72 ≈ 4.17) */
export const FINAL_SCALE = 300 / 72

/** Fallback DPI when 300 DPI canvas creation fails (memory pressure) */
export const FALLBACK_SCALE = 240 / 72

/**
 * Render a PDF page to a canvas at the given scale.
 *
 * Creates a canvas element, sets its dimensions from the viewport at the
 * requested scale, and renders the PDF page onto it via page.render().
 *
 * @param page - PDF.js PDFPageProxy for the page to render
 * @param scale - Scale factor (1 = 72 DPI; 300/72 ≈ 4.17 for 300 DPI)
 * @returns The rendered canvas element
 */
export async function renderPage(
  page: PDFPageProxy,
  scale: number
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)

  const renderTask = page.render({
    canvas,
    viewport,
  })

  await renderTask.promise

  return canvas
}
