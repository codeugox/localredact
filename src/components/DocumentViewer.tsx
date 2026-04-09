// src/components/DocumentViewer.tsx
// Renders PDF page on canvas using page.render() at preview scale (1.5x),
// positions SVG overlay on top with matching dimensions.
// For each entity on the current page, renders a HighlightGroup.
// Handles page rendering when currentPage signal changes.

import { useEffect, useRef } from 'preact/hooks'
import { currentPage, entitiesForCurrentPage, currentFile } from '../app/state'
import { PREVIEW_SCALE } from '../core/redactor/rasterizer'
import { HighlightGroup } from './HighlightGroup'
import type { Viewport } from '../utils/coords'
import { signal } from '@preact/signals'

// ─── Internal signals for canvas dimensions ─────────────────────────

/** Canvas width in pixels (updated after page render) */
const canvasWidth = signal<number>(0)

/** Canvas height in pixels (updated after page render) */
const canvasHeight = signal<number>(0)

/** PDF.js viewport for coordinate transforms (updated after page render) */
const pageViewport = signal<Viewport | null>(null)

// ─── Component ──────────────────────────────────────────────────────

/**
 * Document viewer: renders current PDF page on canvas with SVG highlight overlay.
 *
 * - Loads the PDF from currentFile signal
 * - Renders the current page at PREVIEW_SCALE (1.5x)
 * - Positions an SVG overlay with identical dimensions on top of the canvas
 * - Renders HighlightGroup components for each entity on the current page
 */
export function DocumentViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<{ pdf: import('pdfjs-dist').PDFDocumentProxy } | null>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)

  const page = currentPage.value
  const file = currentFile.value
  const pageEntities = entitiesForCurrentPage.value
  const vp = pageViewport.value
  const cw = canvasWidth.value
  const ch = canvasHeight.value

  // Load PDF when file changes
  useEffect(() => {
    if (!file) return

    let cancelled = false

    async function loadPdf() {
      const { loadPDF } = await import('../core/pdf/loader')
      if (cancelled) return

      try {
        const result = await loadPDF(file!)
        if (cancelled) {
          await result.pdf.destroy()
          return
        }
        pdfRef.current = { pdf: result.pdf }
        // Trigger a re-render by setting viewport to null
        // The page render effect will pick it up
        pageViewport.value = null
        renderCurrentPage()
      } catch {
        // Error handled by the app-level error state
      }
    }

    loadPdf()

    return () => {
      cancelled = true
      if (pdfRef.current) {
        pdfRef.current.pdf.destroy()
        pdfRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // Render page when currentPage changes
  useEffect(() => {
    renderCurrentPage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function renderCurrentPage() {
    if (!pdfRef.current || !canvasRef.current) return

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel()
      renderTaskRef.current = null
    }

    try {
      const pdfPage = await pdfRef.current.pdf.getPage(currentPage.value)
      const viewport = pdfPage.getViewport({ scale: PREVIEW_SCALE })

      const canvas = canvasRef.current
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const renderTask = pdfPage.render({ canvas, viewport })
      renderTaskRef.current = renderTask

      await renderTask.promise

      // Update signals for SVG overlay dimensions
      canvasWidth.value = canvas.width
      canvasHeight.value = canvas.height

      // Store viewport for coordinate transforms
      pageViewport.value = {
        convertToViewportPoint(pdfX: number, pdfY: number): [number, number] {
          return viewport.convertToViewportPoint(pdfX, pdfY) as [number, number]
        },
      }

      renderTaskRef.current = null
    } catch (err: unknown) {
      // RenderingCancelledException is expected when navigating pages quickly
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException') {
        return
      }
      // Other errors are silently ignored — the page may not exist
    }
  }

  return (
    <div class="doc-viewport">
      <div class="doc-viewport-inner">
        <canvas ref={canvasRef} />
        {vp && cw > 0 && ch > 0 && (
          <svg
            class="highlight-overlay"
            width={cw}
            height={ch}
            viewBox={`0 0 ${cw} ${ch}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
            }}
          >
            {pageEntities.map((entity) => (
              <HighlightGroup
                key={entity.id}
                entityId={entity.id}
                entityType={entity.type}
                decision={entity.decision}
                quads={entity.quads}
                viewport={vp}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
