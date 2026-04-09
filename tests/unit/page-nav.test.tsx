// tests/unit/page-nav.test.tsx
// Tests for PageNav component: thumbnails strip, doc toolbar with prev/next, page indicator.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'preact'

// Mock pdfjs-dist to avoid DOMMatrix dependency in jsdom.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

import {
  resetState,
  entities,
  currentPage,
  totalPages,
  dispatch,
} from '../../src/app/state'
import { PageNav } from '../../src/components/PageNav'
import type { DetectedEntity } from '../../src/core/detectors/entities'

// ─── Test helpers ───────────────────────────────────────────────────

function makeEntity(overrides: Partial<DetectedEntity> = {}): DetectedEntity {
  return {
    id: overrides.id ?? `entity-${Math.random().toString(36).slice(2, 8)}`,
    type: overrides.type ?? 'US_SSN',
    text: overrides.text ?? '123-45-6789',
    layer: overrides.layer ?? 'REGEX',
    confidence: overrides.confidence ?? 0.95,
    decision: overrides.decision ?? 'REDACT',
    page: overrides.page ?? 1,
    textOffset: overrides.textOffset ?? { start: 0, end: 11 },
    quads: overrides.quads ?? [[0, 0, 100, 0, 100, 12, 0, 12]],
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('PageNav', () => {
  let container: HTMLElement

  beforeEach(() => {
    resetState()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    render(null, container)
    container.remove()
  })

  // ─── Doc toolbar (prev/next + page indicator) ─────────────────

  describe('doc toolbar', () => {
    it('should render prev and next buttons', () => {
      totalPages.value = 3
      currentPage.value = 2
      render(<PageNav />, container)

      const prevBtn = container.querySelector('[data-testid="page-prev"]')
      const nextBtn = container.querySelector('[data-testid="page-next"]')
      expect(prevBtn).toBeTruthy()
      expect(nextBtn).toBeTruthy()
    })

    it('should show page indicator "Page X of Y"', () => {
      totalPages.value = 5
      currentPage.value = 3
      render(<PageNav />, container)

      const indicator = container.querySelector('.page-indicator')
      expect(indicator).toBeTruthy()
      expect(indicator!.textContent).toContain('Page 3 of 5')
    })

    it('should disable prev button on page 1', () => {
      totalPages.value = 3
      currentPage.value = 1
      render(<PageNav />, container)

      const prevBtn = container.querySelector('[data-testid="page-prev"]') as HTMLButtonElement
      expect(prevBtn.disabled).toBe(true)
    })

    it('should disable next button on last page', () => {
      totalPages.value = 3
      currentPage.value = 3
      render(<PageNav />, container)

      const nextBtn = container.querySelector('[data-testid="page-next"]') as HTMLButtonElement
      expect(nextBtn.disabled).toBe(true)
    })

    it('should enable both buttons on middle pages', () => {
      totalPages.value = 3
      currentPage.value = 2
      render(<PageNav />, container)

      const prevBtn = container.querySelector('[data-testid="page-prev"]') as HTMLButtonElement
      const nextBtn = container.querySelector('[data-testid="page-next"]') as HTMLButtonElement
      expect(prevBtn.disabled).toBe(false)
      expect(nextBtn.disabled).toBe(false)
    })

    it('should navigate to next page on next click', () => {
      totalPages.value = 3
      currentPage.value = 1
      render(<PageNav />, container)

      const nextBtn = container.querySelector('[data-testid="page-next"]') as HTMLButtonElement
      nextBtn.click()

      expect(currentPage.value).toBe(2)
    })

    it('should navigate to prev page on prev click', () => {
      totalPages.value = 3
      currentPage.value = 2
      render(<PageNav />, container)

      const prevBtn = container.querySelector('[data-testid="page-prev"]') as HTMLButtonElement
      prevBtn.click()

      expect(currentPage.value).toBe(1)
    })

    it('should not go below page 1 when prev is clicked on first page', () => {
      totalPages.value = 3
      currentPage.value = 1
      render(<PageNav />, container)

      const prevBtn = container.querySelector('[data-testid="page-prev"]') as HTMLButtonElement
      prevBtn.click()

      expect(currentPage.value).toBe(1)
    })

    it('should not go above total pages when next is clicked on last page', () => {
      totalPages.value = 3
      currentPage.value = 3
      render(<PageNav />, container)

      const nextBtn = container.querySelector('[data-testid="page-next"]') as HTMLButtonElement
      nextBtn.click()

      expect(currentPage.value).toBe(3)
    })
  })

  // ─── Thumbnail strip ─────────────────────────────────────────────

  describe('thumbnail strip', () => {
    it('should render one thumbnail per page', () => {
      totalPages.value = 3
      currentPage.value = 1
      render(<PageNav />, container)

      const thumbnails = container.querySelectorAll('.page-thumb')
      expect(thumbnails.length).toBe(3)
    })

    it('should mark active page thumbnail with .active class', () => {
      totalPages.value = 3
      currentPage.value = 2
      render(<PageNav />, container)

      const thumbnails = container.querySelectorAll('.page-thumb')
      expect(thumbnails[0].classList.contains('active')).toBe(false)
      expect(thumbnails[1].classList.contains('active')).toBe(true)
      expect(thumbnails[2].classList.contains('active')).toBe(false)
    })

    it('should navigate to page when thumbnail is clicked', () => {
      totalPages.value = 3
      currentPage.value = 1
      render(<PageNav />, container)

      const thumbnails = container.querySelectorAll('.page-thumb')
      ;(thumbnails[2] as HTMLElement).click()

      expect(currentPage.value).toBe(3)
    })

    it('should show amber dot on pages with uncertain entities', () => {
      totalPages.value = 3
      currentPage.value = 1
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
        makeEntity({ id: 'e2', decision: 'REDACT', page: 2 }),
        makeEntity({ id: 'e3', decision: 'UNCERTAIN', page: 3 }),
      ]
      render(<PageNav />, container)

      const dots = container.querySelectorAll('.page-thumb-dot')
      // Pages 1 and 3 have uncertain entities → dots
      expect(dots.length).toBe(2)
    })

    it('should not show amber dot on pages without uncertain entities', () => {
      totalPages.value = 2
      currentPage.value = 1
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', page: 1 }),
        makeEntity({ id: 'e2', decision: 'KEEP', page: 2 }),
      ]
      render(<PageNav />, container)

      const dots = container.querySelectorAll('.page-thumb-dot')
      expect(dots.length).toBe(0)
    })

    it('should remove amber dot when uncertain entities are resolved', () => {
      totalPages.value = 2
      currentPage.value = 1
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
        makeEntity({ id: 'e2', decision: 'REDACT', page: 2 }),
      ]
      render(<PageNav />, container)

      let dots = container.querySelectorAll('.page-thumb-dot')
      expect(dots.length).toBe(1)

      // Resolve the uncertain entity
      dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
      render(<PageNav />, container)

      dots = container.querySelectorAll('.page-thumb-dot')
      expect(dots.length).toBe(0)
    })
  })

  // ─── Single page document ────────────────────────────────────────

  describe('single page document', () => {
    it('should disable both prev and next on single-page document', () => {
      totalPages.value = 1
      currentPage.value = 1
      render(<PageNav />, container)

      const prevBtn = container.querySelector('[data-testid="page-prev"]') as HTMLButtonElement
      const nextBtn = container.querySelector('[data-testid="page-next"]') as HTMLButtonElement
      expect(prevBtn.disabled).toBe(true)
      expect(nextBtn.disabled).toBe(true)
    })

    it('should show "Page 1 of 1" for single-page', () => {
      totalPages.value = 1
      currentPage.value = 1
      render(<PageNav />, container)

      const indicator = container.querySelector('.page-indicator')
      expect(indicator!.textContent).toContain('Page 1 of 1')
    })
  })
})
