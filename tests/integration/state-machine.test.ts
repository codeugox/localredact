// tests/integration/state-machine.test.ts
// Integration tests for full state machine transitions.
// Verifies the complete app flow: IDLE → LOADING → NEEDS_REVIEW → PROCESSING → DONE
// and RESET from various states.

import { describe, it, expect, beforeEach } from 'vitest'
import type { DetectedEntity } from '../../src/core/detectors/entities'
import type { IndexedPage } from '../../src/core/text-index'
import {
  appState,
  entities,
  currentPage,
  totalPages,
  currentMode,
  currentFile,
  error,
  processingProgress,
  indexedPages,
  focusedEntity,
  focusedEntityId,
  redactCount,
  keepCount,
  uncertainCount,
  dispatch,
  resetState,
} from '../../src/app/state'

// ─── Helpers ────────────────────────────────────────────────────────

function makeEntity(
  overrides: Partial<DetectedEntity> = {}
): DetectedEntity {
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

function makePage(pageNum: number): IndexedPage {
  return {
    pageNum,
    text: `Page ${pageNum} content`,
    charMap: [],
    items: [],
    viewport: { width: 612, height: 792 },
  }
}

function makeFile(name: string): File {
  return new File(['test'], name, { type: 'application/pdf' })
}

// ─── Full state machine transitions ─────────────────────────────────

describe('Full state machine transitions', () => {
  beforeEach(() => {
    resetState()
  })

  describe('IDLE → LOADING → NEEDS_REVIEW → PROCESSING → DONE', () => {
    it('should transition through the complete happy path', () => {
      // IDLE state
      expect(appState.value).toBe('IDLE')

      // User drops a file → SET_FILE + DETECTION_START → LOADING
      const file = makeFile('invoice.pdf')
      dispatch({ type: 'SET_FILE', file })
      expect(currentFile.value).toBe(file)
      expect(appState.value).toBe('IDLE') // SET_FILE doesn't change state

      dispatch({ type: 'DETECTION_START' })
      expect(appState.value).toBe('LOADING')
      expect(entities.value).toEqual([])
      expect(processingProgress.value).toEqual({ page: 0, total: 0 })

      // Detection progress
      dispatch({ type: 'DETECTION_PROGRESS', page: 1, total: 3 })
      expect(processingProgress.value).toEqual({ page: 1, total: 3 })

      dispatch({ type: 'DETECTION_PROGRESS', page: 2, total: 3 })
      expect(processingProgress.value).toEqual({ page: 2, total: 3 })

      dispatch({ type: 'DETECTION_PROGRESS', page: 3, total: 3 })
      expect(processingProgress.value).toEqual({ page: 3, total: 3 })

      // Detection complete → NEEDS_REVIEW
      const detectedEntities = [
        makeEntity({ id: 'e1', type: 'US_SSN', decision: 'REDACT', page: 1 }),
        makeEntity({ id: 'e2', type: 'MONEY', decision: 'KEEP', page: 1 }),
        makeEntity({ id: 'e3', type: 'US_EIN', decision: 'UNCERTAIN', page: 2 }),
      ]
      const pages = [makePage(1), makePage(2), makePage(3)]

      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: detectedEntities,
        pages,
        totalPages: 3,
      })

      expect(appState.value).toBe('NEEDS_REVIEW')
      expect(entities.value).toHaveLength(3)
      expect(totalPages.value).toBe(3)
      expect(currentPage.value).toBe(1)
      expect(indexedPages.value).toEqual(pages)

      // Computed counts should reflect entities
      expect(redactCount.value).toBe(1)
      expect(keepCount.value).toBe(1)
      expect(uncertainCount.value).toBe(1)

      // User resolves uncertain entity
      dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e3' })
      expect(entities.value.find((e) => e.id === 'e3')?.decision).toBe('REDACT')
      expect(uncertainCount.value).toBe(0)
      expect(redactCount.value).toBe(2)

      // User triggers download → REDACTION_START → PROCESSING
      dispatch({ type: 'REDACTION_START' })
      expect(appState.value).toBe('PROCESSING')
      expect(processingProgress.value).toEqual({ page: 0, total: 0 })

      // Redaction progress
      dispatch({ type: 'REDACTION_PROGRESS', page: 1, total: 3 })
      expect(processingProgress.value).toEqual({ page: 1, total: 3 })

      dispatch({ type: 'REDACTION_PROGRESS', page: 3, total: 3 })
      expect(processingProgress.value).toEqual({ page: 3, total: 3 })

      // Redaction complete → DONE
      dispatch({ type: 'REDACTION_COMPLETE' })
      expect(appState.value).toBe('DONE')

      // File should still be available for the done screen filename
      expect(currentFile.value).toBe(file)
    })
  })

  describe('RESET from preview (NEEDS_REVIEW)', () => {
    it('should clear ALL state and return to IDLE', () => {
      // Set up NEEDS_REVIEW state
      const file = makeFile('report.pdf')
      dispatch({ type: 'SET_FILE', file })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'e1', decision: 'REDACT', page: 1 }),
          makeEntity({ id: 'e2', decision: 'UNCERTAIN', page: 2 }),
        ],
        pages: [makePage(1), makePage(2)],
        totalPages: 2,
      })

      expect(appState.value).toBe('NEEDS_REVIEW')
      expect(entities.value).toHaveLength(2)

      // User toggles some entity decisions
      dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e2' })
      expect(entities.value.find((e) => e.id === 'e2')?.decision).toBe('REDACT')

      // Navigate to page 2
      dispatch({ type: 'SET_PAGE', page: 2 })
      expect(currentPage.value).toBe(2)

      // Focus an entity
      dispatch({ type: 'FOCUS_ENTITY_ID', entityId: 'e1' })
      expect(focusedEntityId.value).toBe('e1')

      // Change mode
      dispatch({ type: 'SET_MODE', mode: 'FULL_REDACTION' })
      expect(currentMode.value).toBe('FULL_REDACTION')

      // RESET from preview
      dispatch({ type: 'RESET' })

      // ALL state must be cleared
      expect(appState.value).toBe('IDLE')
      expect(entities.value).toEqual([])
      expect(currentPage.value).toBe(1)
      expect(totalPages.value).toBe(0)
      expect(currentMode.value).toBe('IDENTITY_ONLY')
      expect(currentFile.value).toBeNull()
      expect(error.value).toBeNull()
      expect(processingProgress.value).toEqual({ page: 0, total: 0 })
      expect(indexedPages.value).toEqual([])
      expect(focusedEntity.value).toBeNull()
      expect(focusedEntityId.value).toBeNull()
      expect(redactCount.value).toBe(0)
      expect(keepCount.value).toBe(0)
      expect(uncertainCount.value).toBe(0)
    })
  })

  describe('RESET from done screen', () => {
    it('should clear ALL state and return to IDLE', () => {
      // Run full happy path to DONE
      const file = makeFile('contract.pdf')
      dispatch({ type: 'SET_FILE', file })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [makeEntity({ id: 'e1', decision: 'REDACT' })],
        pages: [makePage(1)],
        totalPages: 1,
      })
      dispatch({ type: 'REDACTION_START' })
      dispatch({ type: 'REDACTION_PROGRESS', page: 1, total: 1 })
      dispatch({ type: 'REDACTION_COMPLETE' })

      expect(appState.value).toBe('DONE')
      expect(currentFile.value).toBe(file)
      expect(entities.value).toHaveLength(1)

      // RESET from done screen
      dispatch({ type: 'RESET' })

      expect(appState.value).toBe('IDLE')
      expect(entities.value).toEqual([])
      expect(currentFile.value).toBeNull()
      expect(currentPage.value).toBe(1)
      expect(totalPages.value).toBe(0)
      expect(processingProgress.value).toEqual({ page: 0, total: 0 })
      expect(indexedPages.value).toEqual([])
    })
  })

  describe('No data contamination between sessions', () => {
    it('after RESET, a new file should have only new file entities', () => {
      // Session 1: file A
      const fileA = makeFile('fileA.pdf')
      dispatch({ type: 'SET_FILE', file: fileA })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'a1', text: '111-22-3333', page: 1, decision: 'REDACT' }),
          makeEntity({ id: 'a2', text: '444-55-6666', page: 1, decision: 'UNCERTAIN' }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })

      expect(entities.value).toHaveLength(2)
      expect(entities.value.some((e) => e.text === '111-22-3333')).toBe(true)

      // Toggle entity from session 1
      dispatch({ type: 'TOGGLE_ENTITY', entityId: 'a2' })

      // RESET → drop new file (session 2)
      dispatch({ type: 'RESET' })

      // Verify clean slate
      expect(entities.value).toEqual([])
      expect(currentFile.value).toBeNull()

      // Session 2: file B
      const fileB = makeFile('fileB.pdf')
      dispatch({ type: 'SET_FILE', file: fileB })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'b1', text: '777-88-9999', page: 1, decision: 'REDACT' }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })

      // Only file B entities should exist
      expect(entities.value).toHaveLength(1)
      expect(entities.value[0].text).toBe('777-88-9999')
      expect(entities.value.some((e) => e.text === '111-22-3333')).toBe(false)
      expect(entities.value.some((e) => e.text === '444-55-6666')).toBe(false)
      expect(currentFile.value).toBe(fileB)
    })

    it('after RESET from DONE, new session is fully independent', () => {
      // Session 1: full flow to DONE
      const fileA = makeFile('sessionA.pdf')
      dispatch({ type: 'SET_FILE', file: fileA })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'sa1', type: 'EMAIL_ADDRESS', text: 'a@b.com', page: 1 }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })
      dispatch({ type: 'REDACTION_START' })
      dispatch({ type: 'REDACTION_COMPLETE' })
      expect(appState.value).toBe('DONE')

      // RESET → new session
      dispatch({ type: 'RESET' })
      expect(appState.value).toBe('IDLE')

      // Session 2
      const fileB = makeFile('sessionB.pdf')
      dispatch({ type: 'SET_FILE', file: fileB })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'sb1', type: 'PHONE_NUMBER', text: '555-0100', page: 1 }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })

      expect(appState.value).toBe('NEEDS_REVIEW')
      expect(entities.value).toHaveLength(1)
      expect(entities.value[0].id).toBe('sb1')
      expect(entities.value[0].text).toBe('555-0100')
      // No contamination from session A
      expect(entities.value.some((e) => e.text === 'a@b.com')).toBe(false)
    })
  })

  describe('Error recovery', () => {
    it('should recover from ERROR state when valid file is dropped', () => {
      // Error from invalid file
      dispatch({ type: 'ERROR', message: 'Only PDF files are supported in v1.' })
      expect(appState.value).toBe('ERROR')
      expect(error.value).toBe('Only PDF files are supported in v1.')

      // Another error (oversized)
      dispatch({ type: 'ERROR', message: 'File exceeds the 50 MB size limit.' })
      expect(appState.value).toBe('ERROR')
      expect(error.value).toBe('File exceeds the 50 MB size limit.')

      // Valid file clears the error and proceeds
      const file = makeFile('valid.pdf')
      dispatch({ type: 'SET_FILE', file })
      expect(error.value).toBeNull()

      dispatch({ type: 'DETECTION_START' })
      expect(appState.value).toBe('LOADING')

      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [makeEntity({ id: 'v1', decision: 'REDACT' })],
        pages: [makePage(1)],
        totalPages: 1,
      })
      expect(appState.value).toBe('NEEDS_REVIEW')
      expect(entities.value).toHaveLength(1)
    })

    it('error during detection should not corrupt state for next attempt', () => {
      // Start detection
      const file = makeFile('test.pdf')
      dispatch({ type: 'SET_FILE', file })
      dispatch({ type: 'DETECTION_START' })
      expect(appState.value).toBe('LOADING')

      // Detection fails
      dispatch({ type: 'ERROR', message: 'This PDF could not be rendered.' })
      expect(appState.value).toBe('ERROR')
      expect(error.value).toBe('This PDF could not be rendered.')

      // Retry with new file
      const file2 = makeFile('test2.pdf')
      dispatch({ type: 'SET_FILE', file: file2 })
      expect(error.value).toBeNull()
      dispatch({ type: 'DETECTION_START' })
      expect(appState.value).toBe('LOADING')
      expect(entities.value).toEqual([]) // No stale entities

      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [makeEntity({ id: 'r1', page: 1 })],
        pages: [makePage(1)],
        totalPages: 1,
      })
      expect(appState.value).toBe('NEEDS_REVIEW')
    })
  })

  describe('Mode switching during review', () => {
    it('should allow SET_MODE during NEEDS_REVIEW without corrupting state', () => {
      // Set up review state in Identity mode
      dispatch({ type: 'SET_FILE', file: makeFile('doc.pdf') })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'e1', type: 'US_SSN', decision: 'REDACT', page: 1 }),
          makeEntity({ id: 'e2', type: 'MONEY', decision: 'KEEP', page: 1 }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })
      expect(appState.value).toBe('NEEDS_REVIEW')
      expect(currentMode.value).toBe('IDENTITY_ONLY')
      expect(keepCount.value).toBe(1) // MONEY is KEEP in identity mode

      // Switch to Full mode → re-run detection (simulated via new DETECTION_COMPLETE)
      dispatch({ type: 'SET_MODE', mode: 'FULL_REDACTION' })
      expect(currentMode.value).toBe('FULL_REDACTION')

      // Simulating re-run: DETECTION_START clears entities
      dispatch({ type: 'DETECTION_START' })
      expect(entities.value).toEqual([])
      expect(appState.value).toBe('LOADING')

      // Re-run completes with MONEY now REDACT
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'e1b', type: 'US_SSN', decision: 'REDACT', page: 1 }),
          makeEntity({ id: 'e2b', type: 'MONEY', decision: 'REDACT', page: 1 }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })
      expect(appState.value).toBe('NEEDS_REVIEW')
      expect(redactCount.value).toBe(2)
      expect(keepCount.value).toBe(0) // MONEY is now REDACT

      // Switch back to Identity mode → re-run
      dispatch({ type: 'SET_MODE', mode: 'IDENTITY_ONLY' })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'e1c', type: 'US_SSN', decision: 'REDACT', page: 1 }),
          makeEntity({ id: 'e2c', type: 'MONEY', decision: 'KEEP', page: 1 }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })
      expect(keepCount.value).toBe(1) // MONEY back to KEEP
    })
  })

  describe('Multi-page navigation during review', () => {
    it('should navigate between pages and show correct entities per page', () => {
      dispatch({ type: 'SET_FILE', file: makeFile('multi.pdf') })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'p1e1', type: 'US_SSN', page: 1 }),
          makeEntity({ id: 'p2e1', type: 'EMAIL_ADDRESS', page: 2 }),
          makeEntity({ id: 'p3e1', type: 'PHONE_NUMBER', page: 3 }),
        ],
        pages: [makePage(1), makePage(2), makePage(3)],
        totalPages: 3,
      })

      // Page 1
      expect(currentPage.value).toBe(1)
      const page1Entities = entities.value.filter((e) => e.page === currentPage.value)
      expect(page1Entities).toHaveLength(1)
      expect(page1Entities[0].type).toBe('US_SSN')

      // Navigate to page 2
      dispatch({ type: 'SET_PAGE', page: 2 })
      expect(currentPage.value).toBe(2)
      const page2Entities = entities.value.filter((e) => e.page === currentPage.value)
      expect(page2Entities).toHaveLength(1)
      expect(page2Entities[0].type).toBe('EMAIL_ADDRESS')

      // Navigate to page 3
      dispatch({ type: 'SET_PAGE', page: 3 })
      expect(currentPage.value).toBe(3)

      // Navigate back to page 1
      dispatch({ type: 'SET_PAGE', page: 1 })
      expect(currentPage.value).toBe(1)

      // Boundary: can't go below 1
      dispatch({ type: 'SET_PAGE', page: 0 })
      expect(currentPage.value).toBe(1)

      // Boundary: can't go above totalPages
      dispatch({ type: 'SET_PAGE', page: 4 })
      expect(currentPage.value).toBe(1)
    })

    it('should navigate to entity page when focusing cross-page entity', () => {
      dispatch({ type: 'SET_FILE', file: makeFile('multi.pdf') })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'p1e1', type: 'US_SSN', page: 1 }),
          makeEntity({ id: 'p3e1', type: 'PHONE_NUMBER', page: 3 }),
        ],
        pages: [makePage(1), makePage(2), makePage(3)],
        totalPages: 3,
      })

      expect(currentPage.value).toBe(1)

      // Focus entity on page 3 — the keyboard nav module handles page navigation,
      // but the state dispatches are individual
      dispatch({ type: 'FOCUS_ENTITY_ID', entityId: 'p3e1' })
      expect(focusedEntityId.value).toBe('p3e1')

      // Navigate to the entity's page
      dispatch({ type: 'SET_PAGE', page: 3 })
      expect(currentPage.value).toBe(3)
    })
  })

  describe('Password flow state transitions', () => {
    it('should handle detection start → error → retry pattern', () => {
      // Password PDF flow: detection starts, then if wrong password,
      // the detection pipeline throws and dispatches ERROR.
      const file = makeFile('encrypted.pdf')
      dispatch({ type: 'SET_FILE', file })
      dispatch({ type: 'DETECTION_START' })
      expect(appState.value).toBe('LOADING')

      // Wrong password causes error in the detection pipeline
      // (the UI catches this and dispatches ERROR)
      dispatch({ type: 'ERROR', message: 'Incorrect password. Please try again.' })
      expect(appState.value).toBe('ERROR')

      // User re-tries: drop again with correct password
      dispatch({ type: 'SET_FILE', file })
      dispatch({ type: 'DETECTION_START' })
      expect(appState.value).toBe('LOADING')

      // This time detection succeeds
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [makeEntity({ id: 'pw1', page: 1 })],
        pages: [makePage(1)],
        totalPages: 1,
      })
      expect(appState.value).toBe('NEEDS_REVIEW')
    })
  })

  describe('Entity decision management across full flow', () => {
    it('should preserve decisions through NEEDS_REVIEW until RESET', () => {
      dispatch({ type: 'SET_FILE', file: makeFile('doc.pdf') })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'e1', decision: 'REDACT' }),
          makeEntity({ id: 'e2', decision: 'KEEP' }),
          makeEntity({ id: 'e3', decision: 'UNCERTAIN' }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })

      // Toggle decisions
      dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' }) // REDACT → KEEP
      dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e3' }) // UNCERTAIN → REDACT

      // Decisions persist
      expect(entities.value.find((e) => e.id === 'e1')?.decision).toBe('KEEP')
      expect(entities.value.find((e) => e.id === 'e2')?.decision).toBe('KEEP')
      expect(entities.value.find((e) => e.id === 'e3')?.decision).toBe('REDACT')

      // Proceed to redaction — entities preserved
      dispatch({ type: 'REDACTION_START' })
      expect(entities.value).toHaveLength(3) // Still preserved
      expect(entities.value.find((e) => e.id === 'e1')?.decision).toBe('KEEP')

      dispatch({ type: 'REDACTION_COMPLETE' })
      expect(appState.value).toBe('DONE')
      expect(entities.value).toHaveLength(3) // Still preserved at DONE

      // RESET clears everything
      dispatch({ type: 'RESET' })
      expect(entities.value).toEqual([])
    })
  })

  describe('SET_ENTITY_DECISION event', () => {
    it('should set a specific decision on an entity', () => {
      dispatch({ type: 'SET_FILE', file: makeFile('doc.pdf') })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'e1', decision: 'UNCERTAIN' }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })

      dispatch({ type: 'SET_ENTITY_DECISION', entityId: 'e1', decision: 'REDACT' })
      expect(entities.value[0].decision).toBe('REDACT')

      dispatch({ type: 'SET_ENTITY_DECISION', entityId: 'e1', decision: 'KEEP' })
      expect(entities.value[0].decision).toBe('KEEP')
    })

    it('should ignore non-existent entity ID', () => {
      dispatch({ type: 'SET_FILE', file: makeFile('doc.pdf') })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [makeEntity({ id: 'e1', decision: 'REDACT' })],
        pages: [makePage(1)],
        totalPages: 1,
      })

      dispatch({ type: 'SET_ENTITY_DECISION', entityId: 'nonexistent', decision: 'KEEP' })
      expect(entities.value[0].decision).toBe('REDACT') // Unchanged
    })
  })

  describe('FOCUS_ENTITY and FOCUS_ENTITY_ID events', () => {
    it('should update focused entity signals', () => {
      dispatch({ type: 'SET_FILE', file: makeFile('doc.pdf') })
      dispatch({ type: 'DETECTION_START' })
      dispatch({
        type: 'DETECTION_COMPLETE',
        entities: [
          makeEntity({ id: 'e1', type: 'US_SSN' }),
          makeEntity({ id: 'e2', type: 'EMAIL_ADDRESS' }),
        ],
        pages: [makePage(1)],
        totalPages: 1,
      })

      dispatch({ type: 'FOCUS_ENTITY', entityType: 'US_SSN' })
      expect(focusedEntity.value).toBe('US_SSN')

      dispatch({ type: 'FOCUS_ENTITY_ID', entityId: 'e2' })
      expect(focusedEntityId.value).toBe('e2')
      expect(focusedEntity.value).toBe('EMAIL_ADDRESS')
    })

    it('should be cleared on RESET', () => {
      dispatch({ type: 'FOCUS_ENTITY', entityType: 'US_SSN' })
      dispatch({ type: 'FOCUS_ENTITY_ID', entityId: 'e1' })
      expect(focusedEntity.value).toBe('US_SSN')
      expect(focusedEntityId.value).toBe('e1')

      dispatch({ type: 'RESET' })
      expect(focusedEntity.value).toBeNull()
      expect(focusedEntityId.value).toBeNull()
    })
  })
})
