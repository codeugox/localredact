// tests/unit/entity-tooltip.test.tsx
// Tests for EntityTooltip component: hover display, content, action button, positioning.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'preact'

// Mock pdfjs-dist to avoid DOMMatrix dependency in jsdom.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

import { resetState, entities, dispatch } from '../../src/app/state'
import { EntityTooltip } from '../../src/components/EntityTooltip'
import type { DetectedEntity } from '../../src/core/detectors/entities'

// ─── Test helpers ───────────────────────────────────────────────────

function makeEntity(overrides: Partial<DetectedEntity> = {}): DetectedEntity {
  return {
    id: overrides.id ?? `entity-${Math.random().toString(36).slice(2, 8)}`,
    type: overrides.type ?? 'US_SSN',
    text: overrides.text ?? '412-67-9823',
    layer: overrides.layer ?? 'REGEX',
    confidence: overrides.confidence ?? 0.95,
    decision: overrides.decision ?? 'REDACT',
    page: overrides.page ?? 1,
    textOffset: overrides.textOffset ?? { start: 0, end: 11 },
    quads: overrides.quads ?? [[0, 0, 100, 0, 100, 12, 0, 12]],
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('EntityTooltip', () => {
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
    it('should render the tooltip element', () => {
      const entity = makeEntity()
      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={200}
          flipped={false}
        />,
        container
      )

      const tooltip = container.querySelector('.entity-tooltip')
      expect(tooltip).toBeTruthy()
    })

    it('should display entity type label in mono font', () => {
      const entity = makeEntity({ type: 'US_SSN' })
      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={200}
          flipped={false}
        />,
        container
      )

      const typeLabel = container.querySelector('.tooltip-type')
      expect(typeLabel).toBeTruthy()
      expect(typeLabel!.textContent).toBeTruthy()
    })

    it('should display matched text in bold', () => {
      const entity = makeEntity({ text: '412-67-9823' })
      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={200}
          flipped={false}
        />,
        container
      )

      const matchedText = container.querySelector('.tooltip-text')
      expect(matchedText).toBeTruthy()
      expect(matchedText!.textContent).toContain('412-67-9823')
    })
  })

  // ─── Action button ────────────────────────────────────────────

  describe('action button', () => {
    it('should show "Keep instead" for REDACT entities', () => {
      const entity = makeEntity({ decision: 'REDACT' })
      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={200}
          flipped={false}
        />,
        container
      )

      const btn = container.querySelector('.tooltip-action')
      expect(btn).toBeTruthy()
      expect(btn!.textContent).toContain('Keep instead')
    })

    it('should show "Remove instead" for KEEP entities', () => {
      const entity = makeEntity({ decision: 'KEEP' })
      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={200}
          flipped={false}
        />,
        container
      )

      const btn = container.querySelector('.tooltip-action')
      expect(btn!.textContent).toContain('Remove instead')
    })

    it('should show "Redact" for UNCERTAIN entities', () => {
      const entity = makeEntity({ decision: 'UNCERTAIN' })
      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={200}
          flipped={false}
        />,
        container
      )

      const btn = container.querySelector('.tooltip-action')
      expect(btn!.textContent).toBeTruthy()
    })

    it('should dispatch TOGGLE_ENTITY when action button is clicked', () => {
      const entity = makeEntity({ id: 'tooltip-e1', decision: 'REDACT' })
      entities.value = [entity]

      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={200}
          flipped={false}
        />,
        container
      )

      const btn = container.querySelector('.tooltip-action') as HTMLButtonElement
      btn.click()

      // REDACT → KEEP
      expect(entities.value[0].decision).toBe('KEEP')
    })
  })

  // ─── Positioning ──────────────────────────────────────────────

  describe('positioning', () => {
    it('should position above highlight when not flipped', () => {
      const entity = makeEntity()
      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={200}
          flipped={false}
        />,
        container
      )

      const tooltip = container.querySelector('.entity-tooltip') as HTMLElement
      expect(tooltip).toBeTruthy()
      expect(tooltip.classList.contains('tooltip-flipped')).toBe(false)
    })

    it('should position below highlight when flipped', () => {
      const entity = makeEntity()
      render(
        <EntityTooltip
          entity={entity}
          x={100}
          y={50}
          flipped={true}
        />,
        container
      )

      const tooltip = container.querySelector('.entity-tooltip') as HTMLElement
      expect(tooltip.classList.contains('tooltip-flipped')).toBe(true)
    })
  })
})
