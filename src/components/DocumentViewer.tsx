// src/components/DocumentViewer.tsx
// Renders PDF page on canvas using page.render() at preview scale (1.5x),
// positions SVG overlay on top with matching dimensions.
// For each entity on the current page, renders a HighlightGroup.
// Handles page rendering when currentPage signal changes.

import { useEffect, useRef, useCallback } from 'preact/hooks'
import { currentPage, entitiesForCurrentPage, currentFile, entities, pdfPassword } from '../app/state'
import { PREVIEW_SCALE } from '../core/redactor/rasterizer'
import { HighlightGroup } from './HighlightGroup'
import { EntityTooltip } from './EntityTooltip'
import type { Viewport } from '../utils/coords'
import { signal } from '@preact/signals'
import type { DetectedEntity } from '../core/detectors/entities'

// ─── Internal signals for canvas dimensions ─────────────────────────

/** Canvas width in pixels (updated after page render) */
const canvasWidth = signal<number>(0)

/** Canvas height in pixels (updated after page render) */
const canvasHeight = signal<number>(0)

/** PDF.js viewport for coordinate transforms (updated after page render) */
const pageViewport = signal<Viewport | null>(null)

/** Tooltip state: entity being hovered, position, flip */
const tooltipEntity = signal<DetectedEntity | null>(null)
const tooltipX = signal<number>(0)
const tooltipY = signal<number>(0)
const tooltipFlipped = signal<boolean>(false)

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
  const viewportRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<{ pdf: import('pdfjs-dist').PDFDocumentProxy } | null>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)

  const page = currentPage.value
  const file = currentFile.value
  const pageEntities = entitiesForCurrentPage.value
  const vp = pageViewport.value
  const cw = canvasWidth.value
  const ch = canvasHeight.value
  const hoveredEntity = tooltipEntity.value
  const ttX = tooltipX.value
  const ttY = tooltipY.value
  const ttFlipped = tooltipFlipped.value

  // ─── Tooltip handlers ───────────────────────────────────────────

  const handleHighlightEnter = useCallback((entityId: string, rect: DOMRect) => {
    const entity = entities.value.find((e) => e.id === entityId)
    if (!entity) return

    const viewportEl = viewportRef.current
    if (!viewportEl) return

    const viewportRect = viewportEl.getBoundingClientRect()
    const x = rect.left + rect.width / 2 - viewportRect.left + viewportEl.scrollLeft
    const y = rect.top - viewportRect.top + viewportEl.scrollTop
    const flipped = rect.top - viewportRect.top < 80

    tooltipEntity.value = entity
    tooltipX.value = x
    tooltipY.value = flipped ? y + rect.height : y
    tooltipFlipped.value = flipped
  }, [])

  const handleHighlightLeave = useCallback(() => {
    tooltipEntity.value = null
  }, [])

  // Load PDF when file changes — pass stored password for encrypted PDFs
  useEffect(() => {
    if (!file) return

    let cancelled = false
    const storedPassword = pdfPassword.value

    async function loadPdf() {
      const { loadPDF } = await import('../core/pdf/loader')
      if (cancelled) return

      try {
        // If we have a stored password from the detection phase,
        // pass it as an onPassword callback that auto-responds
        const onPassword = storedPassword
          ? (updatePassword: (pw: string) => void) => {
              updatePassword(storedPassword)
            }
          : undefined

        const result = await loadPDF(file!, onPassword)
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
    <div class="doc-viewport" ref={viewportRef}>
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
                onMouseEnter={handleHighlightEnter}
                onMouseLeave={handleHighlightLeave}
              />
            ))}
          </svg>
        )}
        {/* Tooltip — shown on hover over a highlight */}
        {hoveredEntity && (
          <EntityTooltip
            entity={hoveredEntity}
            x={ttX}
            y={ttY}
            flipped={ttFlipped}
          />
        )}
      </div>
    </div>
  )
}
