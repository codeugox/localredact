// tests/unit/coords.test.ts
// Tests for coordinate transform utilities

import { describe, it, expect } from 'vitest'
import { quadToCanvas, quadToRect } from '@/utils/coords'
import type { Quad } from '@/core/detectors/entities'

// ─── Mock viewport ──────────────────────────────────────────────────

/**
 * Create a mock viewport that simulates PDF.js viewport.convertToViewportPoint.
 * For a standard non-rotated page at scale 1.5:
 *   canvasX = pdfX * scale
 *   canvasY = pageHeight * scale - pdfY * scale
 */
function createMockViewport(
  scale: number = 1.5,
  pageHeight: number = 792
) {
  return {
    width: 612 * scale,
    height: pageHeight * scale,
    scale,
    convertToViewportPoint(pdfX: number, pdfY: number): [number, number] {
      // Standard transform for non-rotated page:
      // X scales directly, Y flips and scales
      return [pdfX * scale, pageHeight * scale - pdfY * scale]
    },
  }
}

// ─── quadToCanvas ───────────────────────────────────────────────────

describe('quadToCanvas', () => {
  it('should transform a PDF-space quad to canvas-space using viewport', () => {
    const viewport = createMockViewport(1.5, 792)
    // PDF-space quad: bottom-left (100, 500), bottom-right (200, 500),
    // top-right (200, 512), top-left (100, 512)
    const pdfQuad: Quad = [100, 500, 200, 500, 200, 512, 100, 512]

    const canvasQuad = quadToCanvas(pdfQuad, viewport)

    // canvasX = pdfX * 1.5
    // canvasY = 792 * 1.5 - pdfY * 1.5
    expect(canvasQuad[0]).toBeCloseTo(150, 1)  // x1: 100 * 1.5
    expect(canvasQuad[1]).toBeCloseTo(792 * 1.5 - 500 * 1.5, 1)  // y1
    expect(canvasQuad[2]).toBeCloseTo(300, 1)  // x2: 200 * 1.5
    expect(canvasQuad[3]).toBeCloseTo(792 * 1.5 - 500 * 1.5, 1)  // y2
    expect(canvasQuad[4]).toBeCloseTo(300, 1)  // x3: 200 * 1.5
    expect(canvasQuad[5]).toBeCloseTo(792 * 1.5 - 512 * 1.5, 1)  // y3
    expect(canvasQuad[6]).toBeCloseTo(150, 1)  // x4: 100 * 1.5
    expect(canvasQuad[7]).toBeCloseTo(792 * 1.5 - 512 * 1.5, 1)  // y4
  })

  it('should handle a quad at origin (0,0)', () => {
    const viewport = createMockViewport(2.0, 792)
    const pdfQuad: Quad = [0, 0, 50, 0, 50, 12, 0, 12]

    const canvasQuad = quadToCanvas(pdfQuad, viewport)

    expect(canvasQuad[0]).toBeCloseTo(0, 1)
    expect(canvasQuad[1]).toBeCloseTo(792 * 2.0, 1) // y flipped
    expect(canvasQuad[2]).toBeCloseTo(100, 1) // 50 * 2.0
    expect(canvasQuad[3]).toBeCloseTo(792 * 2.0, 1)
  })

  it('should handle different scale factors', () => {
    const viewport = createMockViewport(4.17, 792) // 300 DPI scale
    const pdfQuad: Quad = [100, 700, 200, 700, 200, 712, 100, 712]

    const canvasQuad = quadToCanvas(pdfQuad, viewport)

    expect(canvasQuad[0]).toBeCloseTo(100 * 4.17, 1)
    expect(canvasQuad[1]).toBeCloseTo(792 * 4.17 - 700 * 4.17, 1)
  })

  it('should preserve quad corner ordering', () => {
    const viewport = createMockViewport(1.0, 100)
    const pdfQuad: Quad = [10, 50, 20, 50, 20, 60, 10, 60]

    const canvasQuad = quadToCanvas(pdfQuad, viewport)

    // 4 corners, each with x,y = 8 numbers
    expect(canvasQuad.length).toBe(8)
  })
})

// ─── quadToRect ─────────────────────────────────────────────────────

describe('quadToRect', () => {
  it('should convert axis-aligned quad to bounding rect with padding', () => {
    // A simple axis-aligned quad in canvas space
    const quad: Quad = [100, 200, 300, 200, 300, 180, 100, 180]

    const rect = quadToRect(quad)

    // Min x = 100, Max x = 300, Min y = 180, Max y = 200
    // With 1-2px padding
    expect(rect.x).toBeLessThanOrEqual(100)
    expect(rect.y).toBeLessThanOrEqual(180)
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(300)
    expect(rect.y + rect.height).toBeGreaterThanOrEqual(200)
  })

  it('should produce non-negative dimensions', () => {
    const quad: Quad = [50, 100, 200, 100, 200, 80, 50, 80]

    const rect = quadToRect(quad)

    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it('should add 1-2px padding to prevent glyph edge leaks', () => {
    const quad: Quad = [100, 200, 200, 200, 200, 188, 100, 188]

    const rect = quadToRect(quad)

    // Without padding: x=100, y=188, w=100, h=12
    // With padding: x should be <= 99, y <= 187
    expect(rect.x).toBeLessThan(100)
    expect(rect.y).toBeLessThan(188)
    expect(rect.x + rect.width).toBeGreaterThan(200)
    expect(rect.y + rect.height).toBeGreaterThan(200)
  })

  it('should handle zero-width quad', () => {
    const quad: Quad = [100, 200, 100, 200, 100, 188, 100, 188]

    const rect = quadToRect(quad)

    // Even with zero width, padding should give some width
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it('should handle a quad at the corner of the page', () => {
    const quad: Quad = [0, 10, 50, 10, 50, 0, 0, 0]

    const rect = quadToRect(quad)

    // Padding may push x/y slightly negative, that's acceptable
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it('should return correct bounds for known input/output pair', () => {
    // An exact test: quad spanning from (150, 420) to (300, 432)
    const quad: Quad = [150, 432, 300, 432, 300, 420, 150, 420]

    const rect = quadToRect(quad)

    // Padding of ~1px
    const padding = 1
    expect(rect.x).toBeCloseTo(150 - padding, 0)
    expect(rect.y).toBeCloseTo(420 - padding, 0)
    expect(rect.width).toBeCloseTo(150 + 2 * padding, 0)
    expect(rect.height).toBeCloseTo(12 + 2 * padding, 0)
  })
})
