// tests/unit/footer-bar.test.tsx
// Tests for the FooterBar component: action bar with start over, count chips,
// local badge, and download button.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from 'preact'
import { FooterBar } from '../../src/components/FooterBar'
import {
  entities,
  currentFile,
  appState,
  resetState,
} from '../../src/app/state'
import type { DetectedEntity } from '../../src/core/detectors/entities'

// ─── Helpers ─────────────────────────────────────────────────────

function makeEntity(
  id: string,
  decision: 'REDACT' | 'KEEP' | 'UNCERTAIN',
  page = 1
): DetectedEntity {
  return {
    id,
    type: 'US_SSN',
    text: '123-45-6789',
    layer: 'REGEX',
    confidence: 0.95,
    decision,
    page,
    textOffset: { start: 0, end: 11 },
    quads: [[0, 0, 100, 0, 100, 20, 0, 20]],
  }
}

function renderFooterBar() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  render(<FooterBar />, container)
  return container
}

// ─── Setup ───────────────────────────────────────────────────────

beforeEach(() => {
  resetState()
  document.body.innerHTML = ''
})

// ─── Tests ───────────────────────────────────────────────────────

describe('FooterBar', () => {
  describe('rendering', () => {
    it('should render the action bar container', () => {
      const container = renderFooterBar()
      expect(container.querySelector('.action-bar')).toBeTruthy()
    })

    it('should render the "Start over" ghost button', () => {
      const container = renderFooterBar()
      const btn = container.querySelector('.btn-ghost') as HTMLButtonElement
      expect(btn).toBeTruthy()
      expect(btn.textContent).toContain('Start over')
    })

    it('should render the "Local only" badge with green dot', () => {
      const container = renderFooterBar()
      const badge = container.querySelector('.badge-local') as HTMLElement
      expect(badge).toBeTruthy()
      expect(badge.textContent).toContain('Local only')
      expect(badge.querySelector('.badge-dot')).toBeTruthy()
    })

    it('should render the download button', () => {
      const container = renderFooterBar()
      const btn = container.querySelector('.btn-download') as HTMLButtonElement
      expect(btn).toBeTruthy()
      expect(btn.textContent).toContain('Download')
    })
  })

  describe('count chips', () => {
    it('should show three live count chips reflecting entity counts', () => {
      entities.value = [
        makeEntity('e1', 'REDACT'),
        makeEntity('e2', 'REDACT'),
        makeEntity('e3', 'KEEP'),
        makeEntity('e4', 'UNCERTAIN'),
        makeEntity('e5', 'UNCERTAIN'),
      ]

      const container = renderFooterBar()
      const chips = container.querySelectorAll('.count-chip')
      expect(chips.length).toBe(3)

      // Find specific chips by data attribute or content
      const redactChip = container.querySelector('.count-chip--redact')
      const keepChip = container.querySelector('.count-chip--keep')
      const uncertainChip = container.querySelector('.count-chip--uncertain')

      expect(redactChip?.textContent).toContain('2')
      expect(keepChip?.textContent).toContain('1')
      expect(uncertainChip?.textContent).toContain('2')
    })

    it('should show zero counts when no entities', () => {
      entities.value = []
      const container = renderFooterBar()

      const redactChip = container.querySelector('.count-chip--redact')
      const keepChip = container.querySelector('.count-chip--keep')
      const uncertainChip = container.querySelector('.count-chip--uncertain')

      expect(redactChip?.textContent).toContain('0')
      expect(keepChip?.textContent).toContain('0')
      expect(uncertainChip?.textContent).toContain('0')
    })
  })

  describe('download button state', () => {
    it('should be disabled when uncertain count > 0', () => {
      entities.value = [
        makeEntity('e1', 'REDACT'),
        makeEntity('e2', 'UNCERTAIN'),
      ]

      const container = renderFooterBar()
      const btn = container.querySelector('.btn-download') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
      expect(btn.style.opacity).toBe('0.28')
      expect(btn.style.cursor).toBe('not-allowed')
    })

    it('should be enabled when uncertain count is 0', () => {
      entities.value = [
        makeEntity('e1', 'REDACT'),
        makeEntity('e2', 'KEEP'),
      ]

      const container = renderFooterBar()
      const btn = container.querySelector('.btn-download') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })

    it('should be enabled immediately for no-PII documents (zero entities)', () => {
      entities.value = []
      const container = renderFooterBar()
      const btn = container.querySelector('.btn-download') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })
  })

  describe('start over button', () => {
    it('should dispatch RESET when clicked', () => {
      appState.value = 'NEEDS_REVIEW'
      entities.value = [makeEntity('e1', 'REDACT')]

      const container = renderFooterBar()
      const btn = container.querySelector('.btn-ghost') as HTMLButtonElement
      btn.click()

      expect(appState.value).toBe('IDLE')
      expect(entities.value).toEqual([])
    })
  })
})
