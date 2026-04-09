// tests/integration/redaction.test.ts
// Integration tests for the redaction pipeline: burner, repackager, and filename.
// jsdom doesn't support HTMLCanvasElement.getContext('2d') natively,
// so burner tests use a mock canvas context and repackager tests mock jsPDF.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Quad } from '@/core/detectors/entities'
import type { Viewport } from '@/utils/coords'
import { burnRedactions } from '@/core/redactor/burner'
import { getOutputFilename } from '@/utils/filename'
import {
  PREVIEW_SCALE,
  FINAL_SCALE,
  FALLBACK_SCALE,
} from '@/core/redactor/rasterizer'

// ─── Mock jsPDF at module level ─────────────────────────────────────

const mockAddImage = vi.fn()
const mockAddPage = vi.fn()
const mockSetProperties = vi.fn()
const mockOutput = vi.fn().mockReturnValue(
  new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' })
)
const mockJsPDFInstance = {
  addImage: mockAddImage,
  addPage: mockAddPage,
  setProperties: mockSetProperties,
  output: mockOutput,
}

vi.mock('jspdf', () => {
  // Return a class that can be instantiated with `new`
  const MockJsPDF = function (this: unknown, ...args: unknown[]) {
    mockJsPDFConstructor(...args)
    return mockJsPDFInstance
  } as unknown as typeof import('jspdf').jsPDF
  return { jsPDF: MockJsPDF }
})

const mockJsPDFConstructor = vi.fn()

// Import repackage after mock is set up
import { repackage } from '@/core/redactor/repackager'

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Create a mock viewport that applies a simple scale transform.
 * PDF space: origin bottom-left, Y up.
 * Canvas space: origin top-left, Y down.
 */
function createMockViewport(
  scale: number,
  pageWidth: number,
  pageHeight: number
): Viewport & { width: number; height: number } {
  return {
    width: pageWidth * scale,
    height: pageHeight * scale,
    convertToViewportPoint(pdfX: number, pdfY: number): [number, number] {
      return [pdfX * scale, (pageHeight - pdfY) * scale]
    },
  }
}

/**
 * Create a mock canvas with a mock 2d context for testing.
 */
function createMockCanvas(width: number, height: number) {
  const calls: { method: string; args: unknown[] }[] = []

  const mockCtx = {
    fillStyle: '',
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    moveTo: vi.fn((x: number, y: number) =>
      calls.push({ method: 'moveTo', args: [x, y] })
    ),
    lineTo: vi.fn((x: number, y: number) =>
      calls.push({ method: 'lineTo', args: [x, y] })
    ),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray([0, 0, 0, 255]),
    })),
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  // Override getContext to return our mock
  vi.spyOn(canvas, 'getContext').mockReturnValue(
    mockCtx as unknown as CanvasRenderingContext2D
  )

  return { canvas, mockCtx, calls }
}

// ─── Burner Tests ───────────────────────────────────────────────────

describe('burnRedactions', () => {
  it('should call beginPath, moveTo, lineTo, closePath, fill for each quad', () => {
    const { canvas, mockCtx } = createMockCanvas(200, 200)
    const viewport = createMockViewport(1, 200, 200)

    const quad: Quad = [50, 50, 150, 50, 150, 150, 50, 150]

    burnRedactions(canvas, [quad], viewport)

    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1)
    expect(mockCtx.moveTo).toHaveBeenCalledTimes(1)
    expect(mockCtx.lineTo).toHaveBeenCalledTimes(3)
    expect(mockCtx.closePath).toHaveBeenCalledTimes(1)
    expect(mockCtx.fill).toHaveBeenCalledTimes(1)
  })

  it('should transform quad coordinates from PDF space to canvas space', () => {
    const { canvas, mockCtx } = createMockCanvas(200, 200)
    const viewport = createMockViewport(1, 200, 200)

    // Quad: BL(50,50), BR(150,50), TR(150,150), TL(50,150)
    // PDF→Canvas with pageHeight=200, scale=1:
    // (50,50) → (50, 150), (150,50) → (150, 150),
    // (150,150) → (150, 50), (50,150) → (50, 50)
    const quad: Quad = [50, 50, 150, 50, 150, 150, 50, 150]

    burnRedactions(canvas, [quad], viewport)

    expect(mockCtx.moveTo).toHaveBeenCalledWith(50, 150)
    expect(mockCtx.lineTo).toHaveBeenNthCalledWith(1, 150, 150)
    expect(mockCtx.lineTo).toHaveBeenNthCalledWith(2, 150, 50)
    expect(mockCtx.lineTo).toHaveBeenNthCalledWith(3, 50, 50)
  })

  it('should apply scale when transforming coordinates', () => {
    const { canvas, mockCtx } = createMockCanvas(400, 400)
    const viewport = createMockViewport(2, 200, 200)

    const quad: Quad = [50, 50, 150, 50, 150, 150, 50, 150]

    burnRedactions(canvas, [quad], viewport)

    // With scale=2, pageHeight=200:
    // (50,50) → (100, 300)
    expect(mockCtx.moveTo).toHaveBeenCalledWith(100, 300)
    // (150,50) → (300, 300)
    expect(mockCtx.lineTo).toHaveBeenNthCalledWith(1, 300, 300)
    // (150,150) → (300, 100)
    expect(mockCtx.lineTo).toHaveBeenNthCalledWith(2, 300, 100)
    // (50,150) → (100, 100)
    expect(mockCtx.lineTo).toHaveBeenNthCalledWith(3, 100, 100)
  })

  it('should set fill style to #000000 (black)', () => {
    const { canvas, mockCtx } = createMockCanvas(200, 200)
    const viewport = createMockViewport(1, 200, 200)

    const quad: Quad = [10, 10, 50, 10, 50, 30, 10, 30]

    burnRedactions(canvas, [quad], viewport)

    expect(mockCtx.fillStyle).toBe('#000000')
  })

  it('should handle multiple quads', () => {
    const { canvas, mockCtx } = createMockCanvas(300, 300)
    const viewport = createMockViewport(1, 300, 300)

    const quad1: Quad = [10, 250, 50, 250, 50, 290, 10, 290]
    const quad2: Quad = [200, 250, 250, 250, 250, 290, 200, 290]

    burnRedactions(canvas, [quad1, quad2], viewport)

    expect(mockCtx.beginPath).toHaveBeenCalledTimes(2)
    expect(mockCtx.moveTo).toHaveBeenCalledTimes(2)
    expect(mockCtx.lineTo).toHaveBeenCalledTimes(6)
    expect(mockCtx.closePath).toHaveBeenCalledTimes(2)
    expect(mockCtx.fill).toHaveBeenCalledTimes(2)
  })

  it('should handle empty quads array without error', () => {
    const { canvas, mockCtx } = createMockCanvas(100, 100)
    const viewport = createMockViewport(1, 100, 100)

    expect(() => burnRedactions(canvas, [], viewport)).not.toThrow()
    expect(mockCtx.beginPath).not.toHaveBeenCalled()
    expect(mockCtx.fill).not.toHaveBeenCalled()
  })

  it('should draw polygon (moveTo+lineTo) not fillRect', () => {
    const { canvas, mockCtx } = createMockCanvas(200, 200)
    const viewport = createMockViewport(1, 200, 200)

    const quad: Quad = [10, 10, 90, 10, 90, 90, 10, 90]

    burnRedactions(canvas, [quad], viewport)

    // Should use polygon path, not fillRect
    expect(mockCtx.fillRect).not.toHaveBeenCalled()
    expect(mockCtx.moveTo).toHaveBeenCalledTimes(1)
    expect(mockCtx.lineTo).toHaveBeenCalledTimes(3)
  })

  it('should throw if canvas context is null', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)

    const viewport = createMockViewport(1, 100, 100)
    const quad: Quad = [10, 10, 90, 10, 90, 90, 10, 90]

    expect(() => burnRedactions(canvas, [quad], viewport)).toThrow(
      'Failed to get 2D rendering context from canvas'
    )
  })

  it('should draw correct sequence: beginPath → moveTo → 3×lineTo → closePath → fill', () => {
    const { canvas, calls } = createMockCanvas(200, 200)
    const viewport = createMockViewport(1, 200, 200)

    const quad: Quad = [10, 10, 50, 10, 50, 30, 10, 30]

    burnRedactions(canvas, [quad], viewport)

    expect(calls.map((c) => c.method)).toEqual([
      'beginPath',
      'moveTo',
      'lineTo',
      'lineTo',
      'lineTo',
      'closePath',
      'fill',
    ])
  })
})

// ─── Repackager Tests ───────────────────────────────────────────────

describe('repackage', () => {
  beforeEach(() => {
    mockJsPDFConstructor.mockClear()
    mockAddImage.mockClear()
    mockAddPage.mockClear()
    mockSetProperties.mockClear()
    mockOutput.mockClear()
    mockOutput.mockReturnValue(
      new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' })
    )
  })

  it('should call jsPDF constructor with correct parameters', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 612
    canvas.height = 792

    repackage([canvas], [{ width: 612, height: 792 }])

    expect(mockJsPDFConstructor).toHaveBeenCalledWith({
      unit: 'pt',
      format: [612, 792],
      compress: true,
      putOnlyUsedFonts: true,
    })
  })

  it('should add one image per page and addPage for subsequent pages', () => {
    const canvases = [
      document.createElement('canvas'),
      document.createElement('canvas'),
      document.createElement('canvas'),
    ]
    const viewports = [
      { width: 612, height: 792 },
      { width: 612, height: 792 },
      { width: 792, height: 612 },
    ]

    repackage(canvases, viewports)

    expect(mockAddImage).toHaveBeenCalledTimes(3)
    expect(mockAddPage).toHaveBeenCalledTimes(2)
    expect(mockAddPage).toHaveBeenNthCalledWith(1, [612, 792])
    expect(mockAddPage).toHaveBeenNthCalledWith(2, [792, 612])
  })

  it('should strip metadata via setProperties', () => {
    const canvas = document.createElement('canvas')
    repackage([canvas], [{ width: 612, height: 792 }])

    expect(mockSetProperties).toHaveBeenCalledWith({
      title: 'Redacted Document',
      creator: '',
      author: '',
      subject: '',
      keywords: '',
    })
  })

  it('should call output with blob format', () => {
    const canvas = document.createElement('canvas')
    repackage([canvas], [{ width: 612, height: 792 }])

    expect(mockOutput).toHaveBeenCalledWith('blob')
  })

  it('should pass canvas, PNG format, and correct dimensions to addImage', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 2550
    canvas.height = 3300

    repackage([canvas], [{ width: 612, height: 792 }])

    expect(mockAddImage).toHaveBeenCalledWith(
      canvas,
      'PNG',
      0,
      0,
      612,
      792,
      'page-0',
      'NONE'
    )
  })

  it('should return the blob from jsPDF output', () => {
    const canvas = document.createElement('canvas')
    const result = repackage([canvas], [{ width: 612, height: 792 }])

    expect(result).toBeInstanceOf(Blob)
  })

  it('should throw when given empty arrays', () => {
    expect(() => repackage([], [])).toThrow('No pages to repackage')
  })

  it('should throw when canvas and viewport counts mismatch', () => {
    const canvas = document.createElement('canvas')
    expect(() =>
      repackage(
        [canvas],
        [
          { width: 100, height: 100 },
          { width: 200, height: 200 },
        ]
      )
    ).toThrow('Canvas count must match viewport count')
  })

  it('should not call addPage for single-page documents', () => {
    const canvas = document.createElement('canvas')
    repackage([canvas], [{ width: 612, height: 792 }])

    expect(mockAddPage).not.toHaveBeenCalled()
  })

  it('should handle different page dimensions per page', () => {
    const canvases = [
      document.createElement('canvas'),
      document.createElement('canvas'),
    ]
    const viewports = [
      { width: 612, height: 792 },  // Letter portrait
      { width: 842, height: 595 },  // A4 landscape
    ]

    repackage(canvases, viewports)

    // First page: constructor sets dimensions
    expect(mockJsPDFConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ format: [612, 792] })
    )
    // Second page: addPage with different dimensions
    expect(mockAddPage).toHaveBeenCalledWith([842, 595])
    // Second image should use the second viewport dimensions
    expect(mockAddImage).toHaveBeenNthCalledWith(
      2,
      canvases[1],
      'PNG',
      0,
      0,
      842,
      595,
      'page-1',
      'NONE'
    )
  })
})

// ─── Rasterizer Constants Tests ─────────────────────────────────────

describe('rasterizer constants', () => {
  it('should export PREVIEW_SCALE as 1.5', () => {
    expect(PREVIEW_SCALE).toBe(1.5)
  })

  it('should export FINAL_SCALE as 300/72', () => {
    expect(FINAL_SCALE).toBeCloseTo(300 / 72, 5)
  })

  it('should export FALLBACK_SCALE as 240/72', () => {
    expect(FALLBACK_SCALE).toBeCloseTo(240 / 72, 5)
  })

  it('FINAL_SCALE should be approximately 4.17', () => {
    expect(FINAL_SCALE).toBeCloseTo(4.1667, 3)
  })
})

// ─── Filename Generation Tests ──────────────────────────────────────

describe('getOutputFilename (integration)', () => {
  it('should return [name]-redacted.pdf for standard filename', () => {
    expect(getOutputFilename('invoice.pdf')).toBe('invoice-redacted.pdf')
  })

  it('should handle uppercase .PDF extension', () => {
    expect(getOutputFilename('SCAN.PDF')).toBe('SCAN-redacted.pdf')
  })

  it('should handle no extension', () => {
    expect(getOutputFilename('document')).toBe('document-redacted.pdf')
  })
})

// ─── redactDocument pipeline shape tests ────────────────────────────

describe('redactDocument module shape', () => {
  it('should export redactDocument as a function', async () => {
    const mod = await import('@/core/pipeline/redact-document')
    expect(typeof mod.redactDocument).toBe('function')
  })

  it('should accept file, entities, onProgress, and onPassword params', async () => {
    const mod = await import('@/core/pipeline/redact-document')
    expect(mod.redactDocument.length).toBeGreaterThanOrEqual(2)
  })
})
