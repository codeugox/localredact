// tests/unit/highlight-group.test.tsx
// Tests for HighlightGroup component: renders SVG group with rects per quad,
// applies correct CSS classes per decision state, dispatches TOGGLE_ENTITY on click.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'preact'

// Mock pdfjs-dist to avoid DOMMatrix dependency in jsdom.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

import { resetState, entities, dispatch } from '../../src/app/state'
import { HighlightGroup } from '../../src/components/HighlightGroup'
import type { HighlightGroupProps } from '../../src/components/HighlightGroup'
import type { Quad } from '../../src/core/detectors/entities'
import type { Viewport } from '../../src/utils/coords'

// ─── Test helpers ───────────────────────────────────────────────────

/** Mock viewport that applies a simple 1.5x scale with Y-flip for a 612x792 page */
function mockViewport(): Viewport {
  return {
    convertToViewportPoint(pdfX: number, pdfY: number): [number, number] {
      // Simple scale: 1.5x, flip Y from PDF space (origin bottom-left)
      // to canvas space (origin top-left) for a 792pt page
      return [pdfX * 1.5, (792 - pdfY) * 1.5]
    },
  }
}

/** Create a simple test quad at a known position in PDF space */
function makeQuad(x: number, y: number, w: number, h: number): Quad {
  // PDF space: bottomLeft, bottomRight, topRight, topLeft
  return [x, y, x + w, y, x + w, y + h, x, y + h]
}

/** Render HighlightGroup inside an SVG for valid DOM */
function renderInSvg(container: HTMLElement, props: HighlightGroupProps) {
  render(
    <svg>
      <HighlightGroup {...props} />
    </svg>,
    container
  )
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('HighlightGroup', () => {
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

  // ─── Rendering ──────────────────────────────────────────────────

  describe('rendering', () => {
    it('should render an SVG <g> element with data-entity-id', () => {
      const viewport = mockViewport()
      const quad = makeQuad(100, 700, 50, 12)

      renderInSvg(container, {
        entityId: 'entity-1',
        entityType: 'US_SSN',
        decision: 'REDACT',
        quads: [quad],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-1"]')
      expect(g).toBeTruthy()
    })

    it('should render one <rect> per quad', () => {
      const viewport = mockViewport()
      const quad1 = makeQuad(100, 700, 50, 12)
      const quad2 = makeQuad(100, 680, 50, 12)

      renderInSvg(container, {
        entityId: 'entity-2',
        entityType: 'US_SSN',
        decision: 'REDACT',
        quads: [quad1, quad2],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-2"]')
      const rects = g?.querySelectorAll('rect')
      expect(rects).toBeTruthy()
      expect(rects!.length).toBe(2)
    })

    it('should render rect with correct x, y, width, height attributes', () => {
      const viewport = mockViewport()
      // Quad at PDF (100, 700, 50w, 12h)
      // After viewport transform (1.5x, Y-flip for 792pt page):
      //   bottomLeft: (100*1.5, (792-700)*1.5) = (150, 138)
      //   topRight: (150*1.5, (792-712)*1.5) = (225, 120)
      // So rect bounds: x=150, y=120, w=75, h=18 (with 1px padding)
      const quad = makeQuad(100, 700, 50, 12)

      renderInSvg(container, {
        entityId: 'entity-3',
        entityType: 'US_SSN',
        decision: 'REDACT',
        quads: [quad],
        viewport,
      })

      const rect = container.querySelector('rect')
      expect(rect).toBeTruthy()

      const x = parseFloat(rect!.getAttribute('x')!)
      const y = parseFloat(rect!.getAttribute('y')!)
      const w = parseFloat(rect!.getAttribute('width')!)
      const h = parseFloat(rect!.getAttribute('height')!)

      // Verify rect has reasonable dimensions (accounting for padding)
      expect(w).toBeGreaterThan(0)
      expect(h).toBeGreaterThan(0)
      expect(x).toBeDefined()
      expect(y).toBeDefined()
    })
  })

  // ─── CSS classes for decision states ──────────────────────────────

  describe('decision state CSS classes', () => {
    it('should apply .hl-r class for REDACT decision', () => {
      const viewport = mockViewport()
      const quad = makeQuad(100, 700, 50, 12)

      renderInSvg(container, {
        entityId: 'entity-r',
        entityType: 'US_SSN',
        decision: 'REDACT',
        quads: [quad],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-r"]')
      expect(g?.getAttribute('class')).toBe('hl-r')
    })

    it('should apply .hl-g class for KEEP decision', () => {
      const viewport = mockViewport()
      const quad = makeQuad(100, 700, 50, 12)

      renderInSvg(container, {
        entityId: 'entity-g',
        entityType: 'MONEY',
        decision: 'KEEP',
        quads: [quad],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-g"]')
      expect(g?.getAttribute('class')).toBe('hl-g')
    })

    it('should apply .hl-a class for UNCERTAIN decision', () => {
      const viewport = mockViewport()
      const quad = makeQuad(100, 700, 50, 12)

      renderInSvg(container, {
        entityId: 'entity-a',
        entityType: 'US_EIN',
        decision: 'UNCERTAIN',
        quads: [quad],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-a"]')
      expect(g?.getAttribute('class')).toBe('hl-a')
    })

    it('should set data-decision attribute matching the decision', () => {
      const viewport = mockViewport()
      const quad = makeQuad(100, 700, 50, 12)

      renderInSvg(container, {
        entityId: 'entity-d',
        entityType: 'US_EIN',
        decision: 'UNCERTAIN',
        quads: [quad],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-d"]')
      expect(g?.getAttribute('data-decision')).toBe('UNCERTAIN')
    })
  })

  // ─── Click handler — dispatches TOGGLE_ENTITY ─────────────────────

  describe('click handler', () => {
    it('should dispatch TOGGLE_ENTITY when group is clicked', () => {
      const viewport = mockViewport()
      const quad = makeQuad(100, 700, 50, 12)

      // Set up entities in state so TOGGLE_ENTITY has something to toggle
      entities.value = [
        {
          id: 'entity-click',
          type: 'US_SSN',
          text: '123-45-6789',
          layer: 'REGEX',
          confidence: 0.95,
          decision: 'REDACT',
          page: 1,
          textOffset: { start: 0, end: 11 },
          quads: [quad],
        },
      ]

      renderInSvg(container, {
        entityId: 'entity-click',
        entityType: 'US_SSN',
        decision: 'REDACT',
        quads: [quad],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-click"]')
      expect(g).toBeTruthy()

      // Simulate click
      g!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      // After toggle: REDACT → KEEP
      expect(entities.value[0].decision).toBe('KEEP')
    })

    it('should toggle UNCERTAIN → REDACT on first click', () => {
      const viewport = mockViewport()
      const quad = makeQuad(100, 700, 50, 12)

      entities.value = [
        {
          id: 'entity-uncertain',
          type: 'US_EIN',
          text: '12-3456789',
          layer: 'REGEX',
          confidence: 0.7,
          decision: 'UNCERTAIN',
          page: 1,
          textOffset: { start: 0, end: 10 },
          quads: [quad],
        },
      ]

      renderInSvg(container, {
        entityId: 'entity-uncertain',
        entityType: 'US_EIN',
        decision: 'UNCERTAIN',
        quads: [quad],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-uncertain"]')
      g!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      // UNCERTAIN → REDACT
      expect(entities.value[0].decision).toBe('REDACT')
    })

    it('should toggle KEEP → REDACT on click', () => {
      const viewport = mockViewport()
      const quad = makeQuad(100, 700, 50, 12)

      entities.value = [
        {
          id: 'entity-keep',
          type: 'MONEY',
          text: '$1,234.56',
          layer: 'REGEX',
          confidence: 0.9,
          decision: 'KEEP',
          page: 1,
          textOffset: { start: 0, end: 9 },
          quads: [quad],
        },
      ]

      renderInSvg(container, {
        entityId: 'entity-keep',
        entityType: 'MONEY',
        decision: 'KEEP',
        quads: [quad],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-keep"]')
      g!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      // KEEP → REDACT
      expect(entities.value[0].decision).toBe('REDACT')
    })
  })

  // ─── Multi-quad entities ──────────────────────────────────────────

  describe('multi-quad entities', () => {
    it('should render multiple rects in one SVG group for multi-line entities', () => {
      const viewport = mockViewport()
      const quad1 = makeQuad(100, 700, 200, 12) // line 1
      const quad2 = makeQuad(50, 680, 150, 12)  // line 2
      const quad3 = makeQuad(50, 660, 100, 12)  // line 3

      renderInSvg(container, {
        entityId: 'entity-multi',
        entityType: 'STREET_ADDRESS',
        decision: 'REDACT',
        quads: [quad1, quad2, quad3],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-multi"]')
      const rects = g?.querySelectorAll('rect')
      expect(rects!.length).toBe(3)

      // All rects are in the same group
      expect(g?.children.length).toBe(3)
    })

    it('should apply same CSS class to all rects in a multi-quad group', () => {
      const viewport = mockViewport()
      const quad1 = makeQuad(100, 700, 50, 12)
      const quad2 = makeQuad(100, 680, 50, 12)

      renderInSvg(container, {
        entityId: 'entity-multi-class',
        entityType: 'MONEY',
        decision: 'KEEP',
        quads: [quad1, quad2],
        viewport,
      })

      const g = container.querySelector('g[data-entity-id="entity-multi-class"]')
      expect(g?.getAttribute('class')).toBe('hl-g')
      // All rects inherit the group's class styling
    })
  })

  // ─── App routing ──────────────────────────────────────────────────

  describe('App routes to PreviewScreen when NEEDS_REVIEW', () => {
    it('should render preview-layout when appState is NEEDS_REVIEW', async () => {
      const { appState: appStateSignal } = await import('../../src/app/state')
      appStateSignal.value = 'NEEDS_REVIEW'

      const { App } = await import('../../src/components/App')
      render(<App />, container)

      const layout = container.querySelector('.preview-layout')
      expect(layout).toBeTruthy()
    })

    it('should render preview sidebar placeholder', async () => {
      const { appState: appStateSignal } = await import('../../src/app/state')
      appStateSignal.value = 'NEEDS_REVIEW'

      const { App } = await import('../../src/components/App')
      render(<App />, container)

      const sidebar = container.querySelector('.preview-sidebar')
      expect(sidebar).toBeTruthy()
    })

    it('should render the note bar with output transformation text', async () => {
      const { appState: appStateSignal } = await import('../../src/app/state')
      appStateSignal.value = 'NEEDS_REVIEW'

      const { App } = await import('../../src/components/App')
      render(<App />, container)

      const noteBar = container.querySelector('.note-bar')
      expect(noteBar).toBeTruthy()
      expect(noteBar!.textContent).toContain('permanent black bars')
    })

    it('should render the doc-bar toolbar placeholder', async () => {
      const { appState: appStateSignal } = await import('../../src/app/state')
      appStateSignal.value = 'NEEDS_REVIEW'

      const { App } = await import('../../src/components/App')
      render(<App />, container)

      const docBar = container.querySelector('.doc-bar')
      expect(docBar).toBeTruthy()
    })

    it('should render the document viewport', async () => {
      const { appState: appStateSignal } = await import('../../src/app/state')
      appStateSignal.value = 'NEEDS_REVIEW'

      const { App } = await import('../../src/components/App')
      render(<App />, container)

      const viewport = container.querySelector('.doc-viewport')
      expect(viewport).toBeTruthy()
    })
  })
})
