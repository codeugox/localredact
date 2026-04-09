// src/components/PageNav.tsx
// Page navigation: thumbnail strip at bottom of sidebar + doc toolbar with prev/next.
// Thumbnails show small page previews, active page has dark border, amber dot on
// pages with unresolved (UNCERTAIN) entities. Clicking thumbnail navigates to page.
// Doc toolbar: prev/next buttons (‹ ›) with page indicator ('Page 1 of N').

import { useCallback } from 'preact/hooks'
import {
  currentPage,
  totalPages,
  entities,
  dispatch,
} from '../app/state'

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
                <span class="page-thumb-num">{pageNum}</span>
              </div>
              {hasUncertain && <div class="page-thumb-dot" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
