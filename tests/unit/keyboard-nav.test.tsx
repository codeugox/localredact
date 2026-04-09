// tests/unit/keyboard-nav.test.tsx
// Tests for keyboard shortcuts and jump button:
// Tab = focus next uncertain entity (wrap), R = REDACT, K = KEEP.
// Jump button = go to next unresolved.

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
  focusedEntityId,
  uncertainCount,
  dispatch,
} from '../../src/app/state'
import {
  handleKeyboardShortcut,
  focusNextUncertain,
} from '../../src/components/KeyboardNav'
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

describe('KeyboardNav', () => {
  beforeEach(() => {
    resetState()
    totalPages.value = 3
  })

  // ─── Tab — focus next uncertain entity ────────────────────────

  describe('Tab — focus next uncertain entity', () => {
    it('should focus first uncertain entity when none is focused', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', page: 1 }),
        makeEntity({ id: 'e2', decision: 'UNCERTAIN', page: 1 }),
        makeEntity({ id: 'e3', decision: 'UNCERTAIN', page: 2 }),
      ]

      focusNextUncertain()

      expect(focusedEntityId.value).toBe('e2')
    })

    it('should focus next uncertain entity after current', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
        makeEntity({ id: 'e2', decision: 'REDACT', page: 1 }),
        makeEntity({ id: 'e3', decision: 'UNCERTAIN', page: 2 }),
      ]
      focusedEntityId.value = 'e1'

      focusNextUncertain()

      expect(focusedEntityId.value).toBe('e3')
    })

    it('should wrap around to first uncertain entity', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
        makeEntity({ id: 'e2', decision: 'REDACT', page: 2 }),
        makeEntity({ id: 'e3', decision: 'UNCERTAIN', page: 3 }),
      ]
      focusedEntityId.value = 'e3'

      focusNextUncertain()

      expect(focusedEntityId.value).toBe('e1')
    })

    it('should navigate to page of focused entity', () => {
      currentPage.value = 1
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', page: 1 }),
        makeEntity({ id: 'e2', decision: 'UNCERTAIN', page: 3 }),
      ]

      focusNextUncertain()

      expect(focusedEntityId.value).toBe('e2')
      expect(currentPage.value).toBe(3)
    })

    it('should do nothing when no uncertain entities exist', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', page: 1 }),
        makeEntity({ id: 'e2', decision: 'KEEP', page: 2 }),
      ]

      focusNextUncertain()

      expect(focusedEntityId.value).toBeNull()
    })
  })

  // ─── R — set focused entity to REDACT ─────────────────────────

  describe('R — set focused entity to REDACT', () => {
    it('should set focused entity decision to REDACT', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
      ]
      focusedEntityId.value = 'e1'

      handleKeyboardShortcut('r')

      expect(entities.value[0].decision).toBe('REDACT')
    })

    it('should do nothing when no entity is focused', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
      ]
      focusedEntityId.value = null

      handleKeyboardShortcut('r')

      expect(entities.value[0].decision).toBe('UNCERTAIN')
    })

    it('should change KEEP to REDACT', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'KEEP', page: 1 }),
      ]
      focusedEntityId.value = 'e1'

      handleKeyboardShortcut('r')

      expect(entities.value[0].decision).toBe('REDACT')
    })
  })

  // ─── K — set focused entity to KEEP ───────────────────────────

  describe('K — set focused entity to KEEP', () => {
    it('should set focused entity decision to KEEP', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
      ]
      focusedEntityId.value = 'e1'

      handleKeyboardShortcut('k')

      expect(entities.value[0].decision).toBe('KEEP')
    })

    it('should do nothing when no entity is focused', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', page: 1 }),
      ]
      focusedEntityId.value = null

      handleKeyboardShortcut('k')

      expect(entities.value[0].decision).toBe('REDACT')
    })

    it('should change REDACT to KEEP', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'REDACT', page: 1 }),
      ]
      focusedEntityId.value = 'e1'

      handleKeyboardShortcut('k')

      expect(entities.value[0].decision).toBe('KEEP')
    })
  })

  // ─── handleKeyboardShortcut with Tab ──────────────────────────

  describe('handleKeyboardShortcut Tab', () => {
    it('should handle Tab to focus next uncertain', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
      ]

      handleKeyboardShortcut('Tab')

      expect(focusedEntityId.value).toBe('e1')
    })
  })

  // ─── State update tests ─────────────────────────────────────────

  describe('state updates', () => {
    it('should update SET_PAGE via dispatch', () => {
      totalPages.value = 5
      currentPage.value = 1

      dispatch({ type: 'SET_PAGE', page: 3 })

      expect(currentPage.value).toBe(3)
    })

    it('should not set page below 1', () => {
      totalPages.value = 5
      currentPage.value = 2

      dispatch({ type: 'SET_PAGE', page: 0 })

      expect(currentPage.value).toBe(2)
    })

    it('should not set page above totalPages', () => {
      totalPages.value = 5
      currentPage.value = 3

      dispatch({ type: 'SET_PAGE', page: 6 })

      expect(currentPage.value).toBe(3)
    })

    it('should update SET_ENTITY_DECISION via dispatch', () => {
      entities.value = [
        makeEntity({ id: 'e1', decision: 'UNCERTAIN', page: 1 }),
      ]

      dispatch({ type: 'SET_ENTITY_DECISION', entityId: 'e1', decision: 'REDACT' })

      expect(entities.value[0].decision).toBe('REDACT')
    })

    it('should update FOCUS_ENTITY_ID via dispatch', () => {
      entities.value = [
        makeEntity({ id: 'e1', type: 'US_SSN', page: 1 }),
      ]

      dispatch({ type: 'FOCUS_ENTITY_ID', entityId: 'e1' })

      expect(focusedEntityId.value).toBe('e1')
    })
  })
})
