// src/core/redactor/burner.ts
// Draws black filled polygons for each quad on a canvas context.
// Transforms quads from PDF space to canvas space using the viewport.
// Framework-agnostic — no Preact imports.

import type { Quad } from '../detectors/entities'
import type { Viewport } from '../../utils/coords'

/**
 * Burn redaction marks onto a canvas by drawing black filled polygons
 * for each quad. Quads are in PDF coordinate space and are transformed
 * to canvas space using the viewport's convertToViewportPoint method.
 *
 * @param canvas - The canvas to draw on (already rendered with page content)
 * @param quads - Array of quads in PDF coordinate space
 * @param viewport - PDF.js viewport with convertToViewportPoint for coordinate transform
 */
export function burnRedactions(
  canvas: HTMLCanvasElement,
  quads: Quad[],
  viewport: Viewport
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get 2D rendering context from canvas')
  }

  ctx.fillStyle = '#000000'

  // Safety margin in pixels to prevent glyph edge leaks in the final output.
  // Slight over-redaction is always preferable for a redaction tool.
  const BURN_PADDING = 2

  const canvasW = canvas.width
  const canvasH = canvas.height

  for (const quad of quads) {
    // Transform each corner from PDF space to canvas space
    const [cx1, cy1] = viewport.convertToViewportPoint(quad[0], quad[1])
    const [cx2, cy2] = viewport.convertToViewportPoint(quad[2], quad[3])
    const [cx3, cy3] = viewport.convertToViewportPoint(quad[4], quad[5])
    const [cx4, cy4] = viewport.convertToViewportPoint(quad[6], quad[7])

    // Compute axis-aligned bounding box with padding, clamped to canvas
    const xs = [cx1, cx2, cx3, cx4]
    const ys = [cy1, cy2, cy3, cy4]
    const x = Math.max(0, Math.min(...xs) - BURN_PADDING)
    const y = Math.max(0, Math.min(...ys) - BURN_PADDING)
    const x2 = Math.min(canvasW, Math.max(...xs) + BURN_PADDING)
    const y2 = Math.min(canvasH, Math.max(...ys) + BURN_PADDING)

    ctx.fillRect(x, y, x2 - x, y2 - y)
  }
}
