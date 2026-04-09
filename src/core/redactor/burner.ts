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

  for (const quad of quads) {
    // Transform each corner from PDF space to canvas space
    const [cx1, cy1] = viewport.convertToViewportPoint(quad[0], quad[1])
    const [cx2, cy2] = viewport.convertToViewportPoint(quad[2], quad[3])
    const [cx3, cy3] = viewport.convertToViewportPoint(quad[4], quad[5])
    const [cx4, cy4] = viewport.convertToViewportPoint(quad[6], quad[7])

    ctx.beginPath()
    ctx.moveTo(cx1, cy1)
    ctx.lineTo(cx2, cy2)
    ctx.lineTo(cx3, cy3)
    ctx.lineTo(cx4, cy4)
    ctx.closePath()
    ctx.fill()
  }
}
