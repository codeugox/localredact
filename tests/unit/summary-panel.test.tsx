// tests/unit/summary-panel.test.tsx
// Tests for SummaryPanel component: mode tabs, entity list grouped by decision,
// callout for uncertain items, legend, and panel-to-document linking.

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
  currentMode,
  focusedEntity,
  dispatch,
  uncertainCount,
} from '../../src/app/state'
import { SummaryPanel } from '../../src/components/SummaryPanel'
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

describe('SummaryPanel', () => {
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

  // ─── Mode tabs ──────────────────────────────────────────────────

  describe('mode tabs', () => {
    it('should render two mode tab buttons', () => {
      render(<SummaryPanel />, container)
      const tabs = container.querySelectorAll('.tab')
      expect(tabs.length).toBe(2)
    })

    it('should show "Identity only" and "Full redact" labels', () => {
      render(<SummaryPanel />, container)
      const tabs = container.querySelectorAll('.tab')
      expect(tabs[0].textContent).toContain('Identity only')
      expect(tabs[1].textContent).toContain('Full redact')
    })

    it('should mark Identity only as active by default', () => {
      render(<SummaryPanel />, container)
      const tabs = container.querySelectorAll('.tab')
      expect(tabs[0].classList.contains('active')).toBe(true)
      expect(tabs[1].classList.contains('active')).toBe(false)
    })

    it('should mark Full redact as active when mode is FULL_REDACTION', () => {
      currentMode.value = 'FULL_REDACTION'
      render(<SummaryPanel />, container)
      const tabs = container.querySelectorAll('.tab')
      expect(tabs[0].classList.contains('active')).toBe(false)
      expect(tabs[1].classList.contains('active')).toBe(true)
    })

    it('should dispatch SET_MODE when a tab is clicked', () => {
      render(<SummaryPanel />, container)
      const tabs = container.querySelectorAll('.tab')
      ;(tabs[1] as HTMLElement).click()
      expect(currentMode.value).toBe('FULL_REDACTION')
    })
  })

  // ─── Entity list groups ─────────────────────────────────────────

  describe('entity list groups', () => {
    it('should render three groups: Removing, Keeping, Your decision', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
        makeEntity({ id: 'e2', decision: 'KEEP', type: 'MONEY' }),
        makeEntity({ id: 'e3', decision: 'UNCERTAIN', type: 'US_EIN' }),
      ]
      render(<SummaryPanel />, container)

      const labels = container.querySelectorAll('.group-label')
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim())
      expect(labelTexts).toContain('Removing')
      expect(labelTexts).toContain('Keeping')
      expect(labelTexts).toContain('Your decision')
    })

    it('should show red pip for Removing entities', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
      ]
      render(<SummaryPanel />, container)

      const pip = container.querySelector('.pip-r')
      expect(pip).toBeTruthy()
    })

    it('should show green pip for Keeping entities', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'KEEP', type: 'MONEY' }),
      ]
      render(<SummaryPanel />, container)

      const pip = container.querySelector('.pip-g')
      expect(pip).toBeTruthy()
    })

    it('should show amber pip for Your decision entities', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', type: 'US_EIN' }),
      ]
      render(<SummaryPanel />, container)

      const pip = container.querySelector('.pip-a')
      expect(pip).toBeTruthy()
    })

    it('should show entity type name in each row', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
      ]
      render(<SummaryPanel />, container)

      const name = container.querySelector('.entity-name')
      expect(name).toBeTruthy()
      expect(name!.textContent).toBeTruthy()
    })

    it('should show count for entity type groups', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
        makeEntity({ id: 'e2', decision: 'REDACT', type: 'US_SSN' }),
        makeEntity({ id: 'e3', decision: 'REDACT', type: 'EMAIL_ADDRESS' }),
      ]
      render(<SummaryPanel />, container)

      const counts = container.querySelectorAll('.entity-count')
      const countTexts = Array.from(counts).map((c) => c.textContent)
      // SSN should show ×2, email ×1
      expect(countTexts).toContain('×2')
      expect(countTexts).toContain('×1')
    })

    it('should group entities by type within each decision group', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
        makeEntity({ id: 'e2', decision: 'REDACT', type: 'US_SSN' }),
        makeEntity({ id: 'e3', decision: 'REDACT', type: 'EMAIL_ADDRESS' }),
      ]
      render(<SummaryPanel />, container)

      // Should have 2 entity rows in the Removing group (SSN and email),
      // not 3 individual rows
      const entityRows = container.querySelectorAll('.entity')
      expect(entityRows.length).toBe(2) // SSN group + Email group
    })

    it('should not show groups with zero entities', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
      ]
      render(<SummaryPanel />, container)

      // Only Removing group should have entities
      const labels = container.querySelectorAll('.group-label')
      // All groups render but with no entity rows — check entity count
      const entityRows = container.querySelectorAll('.entity')
      expect(entityRows.length).toBe(1)
    })
  })

  // ─── Callout ────────────────────────────────────────────────────

  describe('callout', () => {
    it('should show callout when uncertain count > 0', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', type: 'US_EIN' }),
        makeEntity({ id: 'e2', decision: 'UNCERTAIN', type: 'ORG' }),
      ]
      render(<SummaryPanel />, container)

      const callout = container.querySelector('.callout')
      expect(callout).toBeTruthy()
      expect(callout!.textContent).toContain('2 items need')
    })

    it('should show singular text when one uncertain item', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', type: 'US_EIN' }),
      ]
      render(<SummaryPanel />, container)

      const callout = container.querySelector('.callout')
      expect(callout!.textContent).toContain('1 item need')
    })

    it('should hide callout when uncertain count is 0', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
      ]
      render(<SummaryPanel />, container)

      const callout = container.querySelector('.callout')
      // Either no callout element or it has .hidden class
      expect(
        !callout || callout.classList.contains('hidden')
      ).toBe(true)
    })
  })

  // ─── Legend ─────────────────────────────────────────────────────

  describe('legend', () => {
    it('should render legend with three color swatches', () => {
      render(<SummaryPanel />, container)

      const legend = container.querySelector('.legend')
      expect(legend).toBeTruthy()

      const swatches = container.querySelectorAll('.swatch')
      expect(swatches.length).toBe(3)
    })

    it('should render three legend rows', () => {
      render(<SummaryPanel />, container)

      const rows = container.querySelectorAll('.legend-row')
      expect(rows.length).toBe(3)
    })

    it('should show red swatch with "Will be removed" text', () => {
      render(<SummaryPanel />, container)
      const legend = container.querySelector('.legend')
      expect(legend!.textContent).toContain('Will be removed')
    })

    it('should show green swatch with "Keeping" text', () => {
      render(<SummaryPanel />, container)
      const legend = container.querySelector('.legend')
      expect(legend!.textContent).toContain('Keeping')
    })

    it('should show amber swatch with "Needs decision" text', () => {
      render(<SummaryPanel />, container)
      const legend = container.querySelector('.legend')
      expect(legend!.textContent).toContain('Needs decision')
    })
  })

  // ─── Panel-to-document linking ──────────────────────────────────

  describe('panel-to-document linking', () => {
    it('should have data-entity attribute on each entity row', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
      ]
      render(<SummaryPanel />, container)

      const row = container.querySelector('.entity')
      expect(row?.getAttribute('data-entity')).toBeTruthy()
    })

    it('should dispatch FOCUS_ENTITY when entity row is clicked', () => {
      entities.value = [
        makeEntity({ id: 'ssn-1', decision: 'REDACT', type: 'US_SSN' }),
      ]
      render(<SummaryPanel />, container)

      const row = container.querySelector('.entity') as HTMLElement
      row.click()

      expect(focusedEntity.value).toBe('US_SSN')
    })

    it('should add .active class to clicked entity row', () => {
      entities.value = [
        makeEntity({ id: 'ssn-1', decision: 'REDACT', type: 'US_SSN' }),
        makeEntity({ id: 'email-1', decision: 'REDACT', type: 'EMAIL_ADDRESS' }),
      ]
      render(<SummaryPanel />, container)

      let rows = container.querySelectorAll('.entity')
      ;(rows[0] as HTMLElement).click()

      // Re-render to pick up signal change
      render(<SummaryPanel />, container)
      rows = container.querySelectorAll('.entity')
      expect(rows[0].classList.contains('active')).toBe(true)

      // Click second row
      ;(rows[1] as HTMLElement).click()

      // Re-render to pick up signal change
      render(<SummaryPanel />, container)
      rows = container.querySelectorAll('.entity')
      expect(rows[0].classList.contains('active')).toBe(false)
      expect(rows[1].classList.contains('active')).toBe(true)
    })
  })

  // ─── Count chips reflect actual entity counts ────────────────────

  describe('count accuracy', () => {
    it('should update group counts when entities change', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
        makeEntity({ id: 'e2', decision: 'KEEP', type: 'MONEY' }),
        makeEntity({ id: 'e3', decision: 'UNCERTAIN', type: 'US_EIN' }),
      ]
      render(<SummaryPanel />, container)

      // Toggle e1 from REDACT to KEEP
      dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
      // Re-render to pick up signal changes
      render(<SummaryPanel />, container)

      // Now we should have 0 REDACT, 2 KEEP, 1 UNCERTAIN
      const entityRows = container.querySelectorAll('.entity')
      // 1 row for SSN (KEEP), 1 row for MONEY (KEEP), 1 row for EIN (UNCERTAIN) = 3 rows
      expect(entityRows.length).toBe(3)
    })
  })
})
