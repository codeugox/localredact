// src/utils/coords.ts
// Coordinate transform utilities for converting between PDF space and canvas space.
// Framework-agnostic — no Preact imports.

import type { Quad } from '../core/detectors/entities'

// ─── Types ──────────────────────────────────────────────────────────

/**
 * Minimal viewport interface compatible with PDF.js PDFPageViewport.
 * Only the method we need for coordinate transforms.
 */
export interface Viewport {
  convertToViewportPoint(pdfX: number, pdfY: number): [number, number]
}

/**
 * Axis-aligned bounding rectangle suitable for SVG overlay rendering.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// ─── Constants ──────────────────────────────────────────────────────

/** Padding in pixels added to bounding rects to prevent glyph edge leaks */
const RECT_PADDING = 1

// ─── quadToCanvas ───────────────────────────────────────────────────

/**
 * Convert a PDF-space quad to canvas-pixel-space quad using viewport.
 *
 * Uses viewport.convertToViewportPoint for each corner, which handles
 * rotation, scale, and origin flip correctly. Never do manual coordinate math.
 *
 * @param quad - 8-number tuple representing 4 corners in PDF coordinate space
 * @param viewport - PDF.js viewport with convertToViewportPoint method
 * @returns Quad in canvas pixel space
 */
export function quadToCanvas(quad: Quad, viewport: Viewport): Quad {
  const [x1, y1] = viewport.convertToViewportPoint(quad[0], quad[1])
  const [x2, y2] = viewport.convertToViewportPoint(quad[2], quad[3])
  const [x3, y3] = viewport.convertToViewportPoint(quad[4], quad[5])
  const [x4, y4] = viewport.convertToViewportPoint(quad[6], quad[7])

  return [x1, y1, x2, y2, x3, y3, x4, y4]
}

// ─── quadToRect ─────────────────────────────────────────────────────

/**
 * Convert a quad to an axis-aligned bounding rectangle with 1-2px padding.
 *
 * Takes the bounding box of all 4 corners and adds padding to prevent
 * glyph edge leaks in the SVG overlay.
 *
 * @param quad - 8-number tuple representing 4 corners
 * @returns Axis-aligned bounding rectangle with padding
 */
export function quadToRect(quad: Quad): Rect {
  const xs = [quad[0], quad[2], quad[4], quad[6]]
  const ys = [quad[1], quad[3], quad[5], quad[7]]

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX - RECT_PADDING,
    y: minY - RECT_PADDING,
    width: maxX - minX + 2 * RECT_PADDING,
    height: maxY - minY + 2 * RECT_PADDING,
  }
}
