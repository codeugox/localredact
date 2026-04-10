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
 * Check if the DPI fallback test mode is enabled via URL parameter.
 * When `?dpi-fallback-test=true` is in the URL, the rasterizer will
 * simulate a failure at the primary DPI on the first page attempt,
 * triggering the fallback path for validator testing.
 */
export function isDpiFallbackTestEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('dpi-fallback-test') === 'true'
  } catch {
    return false
  }
}

/**
 * Track whether the DPI fallback test has already triggered its simulated
 * failure. This ensures it only fails once (on the first attempt at
 * FINAL_SCALE), allowing the fallback retry to succeed.
 */
let dpiFallbackTestTriggered = false

/**
 * Reset the DPI fallback test trigger state.
 * Exported for testing purposes only.
 */
export function resetDpiFallbackTestState(): void {
  dpiFallbackTestTriggered = false
}

/**
 * Render a PDF page to a canvas at the given scale.
 *
 * Creates a canvas element, sets its dimensions from the viewport at the
 * requested scale, and renders the PDF page onto it via page.render().
 *
 * When `?dpi-fallback-test=true` URL parameter is present and the scale
 * matches FINAL_SCALE, the first render attempt will throw a simulated
 * error to trigger the DPI fallback path in the redaction pipeline.
 *
 * @param page - PDF.js PDFPageProxy for the page to render
 * @param scale - Scale factor (1 = 72 DPI; 300/72 ≈ 4.17 for 300 DPI)
 * @returns The rendered canvas element
 */
export async function renderPage(
  page: PDFPageProxy,
  scale: number
): Promise<HTMLCanvasElement> {
  // DPI fallback test mode: simulate canvas creation failure at FINAL_SCALE
  if (
    !dpiFallbackTestTriggered &&
    scale === FINAL_SCALE &&
    isDpiFallbackTestEnabled()
  ) {
    dpiFallbackTestTriggered = true
    throw new Error('Simulated canvas creation failure for DPI fallback testing')
  }

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
