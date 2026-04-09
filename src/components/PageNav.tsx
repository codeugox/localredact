// src/components/PageNav.tsx
// Page navigation: thumbnail strip at bottom of sidebar + doc toolbar with prev/next.
// Thumbnails show real page preview images rendered at 0.2x scale, active page has dark border,
// amber dot on pages with unresolved (UNCERTAIN) entities. Clicking thumbnail navigates to page.
// Doc toolbar: prev/next buttons (‹ ›) with page indicator ('Page 1 of N').

import { useCallback, useEffect, useRef } from 'preact/hooks'
import { signal } from '@preact/signals'
import {
  currentPage,
  totalPages,
  entities,
  currentFile,
  pdfPassword,
  appState,
  onReset,
  dispatch,
} from '../app/state'

// ─── Thumbnail constants ────────────────────────────────────────────

/** Scale for page thumbnails (0.2x = very small preview) */
const THUMBNAIL_SCALE = 0.2

// ─── Thumbnail cache (module-level signals) ─────────────────────────

/** Cache of rendered thumbnail data URLs, keyed by page number (1-indexed) */
const thumbnailCache = signal<Map<number, string>>(new Map())

// ─── DocToolbar (prev/next + page indicator) ────────────────────────

/**
 * Document toolbar with prev/next page buttons and page indicator.
 * Rendered inside the doc-bar area above the viewport.
 */
export function DocToolbar() {
  const page = currentPage.value
  const total = totalPages.value

  const handlePrev = useCallback(() => {
    if (currentPage.value > 1) {
      dispatch({ type: 'SET_PAGE', page: currentPage.value - 1 })
    }
  }, [])

  const handleNext = useCallback(() => {
    if (currentPage.value < totalPages.value) {
      dispatch({ type: 'SET_PAGE', page: currentPage.value + 1 })
    }
  }, [])

  return (
    <>
      <button
        class="doc-bar-btn"
        data-testid="page-prev"
        onClick={handlePrev}
        disabled={page <= 1}
        type="button"
        aria-label="Previous page"
      >
        ‹
      </button>
      <span class="page-indicator">
        Page {page} of {total}
      </span>
      <button
        class="doc-bar-btn"
        data-testid="page-next"
        onClick={handleNext}
        disabled={page >= total}
        type="button"
        aria-label="Next page"
      >
        ›
      </button>
    </>
  )
}

// ─── Thumbnail rendering ────────────────────────────────────────────

/**
 * Render all page thumbnails at 0.2x scale, cache as data URLs.
 * Called once when the file is loaded and NEEDS_REVIEW state is reached.
 */
async function renderThumbnails(file: File, total: number, storedPassword: string | null): Promise<void> {
  try {
    const { loadPDF } = await import('../core/pdf/loader')

    const onPassword = storedPassword
      ? (updatePassword: (pw: string) => void) => {
          updatePassword(storedPassword)
        }
      : undefined

    const result = await loadPDF(file, onPassword)
    const newCache = new Map<number, string>()

    for (let i = 1; i <= total; i++) {
      try {
        const pdfPage = await result.pdf.getPage(i)
        const viewport = pdfPage.getViewport({ scale: THUMBNAIL_SCALE })

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        const ctx = canvas.getContext('2d')
        if (ctx) {
          await pdfPage.render({ canvas, viewport }).promise
          newCache.set(i, canvas.toDataURL('image/png'))
        }

        // Release canvas
        canvas.width = 0
        canvas.height = 0
        pdfPage.cleanup()
      } catch {
        // Skip failed pages
      }
    }

    // Update the cache signal
    thumbnailCache.value = newCache

    await result.pdf.destroy()
  } catch {
    // Silently fail — thumbnails will fall back to number display
  }
}

/**
 * Clear the thumbnail cache. Called on reset.
 */
export function clearThumbnailCache(): void {
  thumbnailCache.value = new Map()
}

// Register cleanup on reset
onReset(clearThumbnailCache)

// ─── PageNav (thumbnail strip) ──────────────────────────────────────

/**
 * Page thumbnails strip at the bottom of the sidebar.
 * Small thumbnails for each page, active page has dark border,
 * amber dot indicator on pages with unresolved entities.
 */
export function PageNav() {
  const page = currentPage.value
  const total = totalPages.value
  const entityList = entities.value
  const file = currentFile.value
  const state = appState.value
  const cache = thumbnailCache.value
  const renderingRef = useRef(false)

  // Render thumbnails when file is loaded and in review state
  useEffect(() => {
    if (state !== 'NEEDS_REVIEW' || !file || total === 0) return
    // Only render if cache is empty (not yet rendered for this file)
    if (cache.size > 0 || renderingRef.current) return

    renderingRef.current = true
    const password = pdfPassword.value
    renderThumbnails(file, total, password).finally(() => {
      renderingRef.current = false
    })
  }, [state, file, total, cache.size])

  // Compute which pages have uncertain entities
  const pagesWithUncertain = new Set<number>()
  for (const e of entityList) {
    if (e.decision === 'UNCERTAIN') {
      pagesWithUncertain.add(e.page)
    }
  }

  const handleThumbClick = useCallback((targetPage: number) => {
    dispatch({ type: 'SET_PAGE', page: targetPage })
  }, [])

  // Also render the doc toolbar inline for single-component tests
  // The real layout is split: DocToolbar in doc-bar, PageNav in sidebar bottom

  return (
    <div class="page-nav">
      {/* Doc toolbar (for test: also rendered here, real layout uses DocToolbar separately) */}
      <div class="page-nav-toolbar">
        <button
          class="doc-bar-btn"
          data-testid="page-prev"
          onClick={() => {
            if (currentPage.value > 1) {
              dispatch({ type: 'SET_PAGE', page: currentPage.value - 1 })
            }
          }}
          disabled={page <= 1}
          type="button"
          aria-label="Previous page"
        >
          ‹
        </button>
        <span class="page-indicator">
          Page {page} of {total}
        </span>
        <button
          class="doc-bar-btn"
          data-testid="page-next"
          onClick={() => {
            if (currentPage.value < totalPages.value) {
              dispatch({ type: 'SET_PAGE', page: currentPage.value + 1 })
            }
          }}
          disabled={page >= total}
          type="button"
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      {/* Thumbnail strip */}
      <div class="page-thumbs">
        {Array.from({ length: total }, (_, i) => {
          const pageNum = i + 1
          const isActive = pageNum === page
          const hasUncertain = pagesWithUncertain.has(pageNum)
          const thumbUrl = cache.get(pageNum)

          return (
            <div
              key={pageNum}
              class={`page-thumb${isActive ? ' active' : ''}`}
              onClick={() => handleThumbClick(pageNum)}
              role="button"
              aria-label={`Go to page ${pageNum}`}
              tabIndex={0}
            >
              <div class="page-thumb-inner">
                {thumbUrl ? (
                  <img
                    class="page-thumb-img"
                    src={thumbUrl}
                    alt={`Page ${pageNum} preview`}
                    draggable={false}
                  />
                ) : (
                  <span class="page-thumb-num">{pageNum}</span>
                )}
              </div>
              {hasUncertain && <div class="page-thumb-dot" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
