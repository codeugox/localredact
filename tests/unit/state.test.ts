// tests/unit/state.test.ts
// Tests for app state management — signals, dispatch, computed values, reset.

import { describe, it, expect, beforeEach } from 'vitest'
import type { DetectedEntity } from '../../src/core/detectors/entities'

// We'll import from state.ts after implementation
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
  redactCount,
  keepCount,
  uncertainCount,
  entitiesForCurrentPage,
  dispatch,
  resetState,
} from '../../src/app/state'

// ─── Helper: create a mock entity ──────────────────────────────────

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

// ─── Initial state ─────────────────────────────────────────────────

describe('Initial state', () => {
  beforeEach(() => {
    resetState()
  })

  it('appState should default to IDLE', () => {
    expect(appState.value).toBe('IDLE')
  })

  it('entities should default to empty array', () => {
    expect(entities.value).toEqual([])
  })

  it('currentPage should default to 1', () => {
    expect(currentPage.value).toBe(1)
  })

  it('totalPages should default to 0', () => {
    expect(totalPages.value).toBe(0)
  })

  it('currentMode should default to IDENTITY_ONLY', () => {
    expect(currentMode.value).toBe('IDENTITY_ONLY')
  })

  it('currentFile should default to null', () => {
    expect(currentFile.value).toBeNull()
  })

  it('error should default to null', () => {
    expect(error.value).toBeNull()
  })

  it('processingProgress should default to { page: 0, total: 0 }', () => {
    expect(processingProgress.value).toEqual({ page: 0, total: 0 })
  })

  it('indexedPages should default to empty array', () => {
    expect(indexedPages.value).toEqual([])
  })
})

// ─── Computed signals ──────────────────────────────────────────────

describe('Computed signals', () => {
  beforeEach(() => {
    resetState()
  })

  it('redactCount should count entities with REDACT decision', () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'REDACT' }),
      makeEntity({ id: 'e2', decision: 'KEEP' }),
      makeEntity({ id: 'e3', decision: 'REDACT' }),
    ]
    expect(redactCount.value).toBe(2)
  })

  it('keepCount should count entities with KEEP decision', () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'KEEP' }),
      makeEntity({ id: 'e2', decision: 'KEEP' }),
      makeEntity({ id: 'e3', decision: 'REDACT' }),
    ]
    expect(keepCount.value).toBe(2)
  })

  it('uncertainCount should count entities with UNCERTAIN decision', () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'UNCERTAIN' }),
      makeEntity({ id: 'e2', decision: 'REDACT' }),
      makeEntity({ id: 'e3', decision: 'UNCERTAIN' }),
      makeEntity({ id: 'e4', decision: 'KEEP' }),
    ]
    expect(uncertainCount.value).toBe(2)
  })

  it('all counts should be 0 with no entities', () => {
    expect(redactCount.value).toBe(0)
    expect(keepCount.value).toBe(0)
    expect(uncertainCount.value).toBe(0)
  })

  it('entitiesForCurrentPage should filter by currentPage', () => {
    entities.value = [
      makeEntity({ id: 'e1', page: 1 }),
      makeEntity({ id: 'e2', page: 2 }),
      makeEntity({ id: 'e3', page: 1 }),
      makeEntity({ id: 'e4', page: 3 }),
    ]
    currentPage.value = 1
    expect(entitiesForCurrentPage.value).toHaveLength(2)
    expect(entitiesForCurrentPage.value.map((e) => e.id)).toEqual(['e1', 'e3'])
  })

  it('entitiesForCurrentPage should update when currentPage changes', () => {
    entities.value = [
      makeEntity({ id: 'e1', page: 1 }),
      makeEntity({ id: 'e2', page: 2 }),
    ]
    currentPage.value = 2
    expect(entitiesForCurrentPage.value).toHaveLength(1)
    expect(entitiesForCurrentPage.value[0].id).toBe('e2')
  })

  it('entitiesForCurrentPage should return empty for page with no entities', () => {
    entities.value = [makeEntity({ id: 'e1', page: 1 })]
    currentPage.value = 5
    expect(entitiesForCurrentPage.value).toHaveLength(0)
  })

  it('counts should reflect entity changes immediately', () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'UNCERTAIN' }),
      makeEntity({ id: 'e2', decision: 'UNCERTAIN' }),
    ]
    expect(uncertainCount.value).toBe(2)
    expect(redactCount.value).toBe(0)

    // Simulate toggle via dispatch
    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
    expect(uncertainCount.value).toBe(1)
    expect(redactCount.value).toBe(1)
  })
})

// ─── dispatch: SET_FILE ────────────────────────────────────────────

describe('dispatch SET_FILE', () => {
  beforeEach(() => {
    resetState()
  })

  it('should set currentFile', () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
    dispatch({ type: 'SET_FILE', file })
    expect(currentFile.value).toBe(file)
  })

  it('should clear previous error', () => {
    error.value = 'previous error'
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
    dispatch({ type: 'SET_FILE', file })
    expect(error.value).toBeNull()
  })
})

// ─── dispatch: DETECTION_START ─────────────────────────────────────

describe('dispatch DETECTION_START', () => {
  beforeEach(() => {
    resetState()
  })

  it('should set appState to LOADING', () => {
    dispatch({ type: 'DETECTION_START' })
    expect(appState.value).toBe('LOADING')
  })

  it('should clear entities and progress', () => {
    entities.value = [makeEntity()]
    processingProgress.value = { page: 3, total: 5 }

    dispatch({ type: 'DETECTION_START' })
    expect(entities.value).toEqual([])
    expect(processingProgress.value).toEqual({ page: 0, total: 0 })
  })
})

// ─── dispatch: DETECTION_PROGRESS ──────────────────────────────────

describe('dispatch DETECTION_PROGRESS', () => {
  beforeEach(() => {
    resetState()
  })

  it('should update processingProgress', () => {
    dispatch({ type: 'DETECTION_PROGRESS', page: 2, total: 5 })
    expect(processingProgress.value).toEqual({ page: 2, total: 5 })
  })
})

// ─── dispatch: DETECTION_COMPLETE ──────────────────────────────────

describe('dispatch DETECTION_COMPLETE', () => {
  beforeEach(() => {
    resetState()
  })

  it('should set appState to NEEDS_REVIEW', () => {
    const ents = [makeEntity()]
    dispatch({ type: 'DETECTION_COMPLETE', entities: ents, pages: [], totalPages: 3 })
    expect(appState.value).toBe('NEEDS_REVIEW')
  })

  it('should set entities from payload', () => {
    const ents = [makeEntity({ id: 'e1' }), makeEntity({ id: 'e2' })]
    dispatch({ type: 'DETECTION_COMPLETE', entities: ents, pages: [], totalPages: 2 })
    expect(entities.value).toHaveLength(2)
  })

  it('should set totalPages and indexedPages', () => {
    const pages = [
      { pageNum: 1, text: 'hello', charMap: [], items: [], viewport: { width: 100, height: 100 } },
    ]
    dispatch({ type: 'DETECTION_COMPLETE', entities: [], pages, totalPages: 1 })
    expect(totalPages.value).toBe(1)
    expect(indexedPages.value).toEqual(pages)
  })

  it('should reset currentPage to 1', () => {
    currentPage.value = 5
    dispatch({ type: 'DETECTION_COMPLETE', entities: [], pages: [], totalPages: 3 })
    expect(currentPage.value).toBe(1)
  })
})

// ─── dispatch: TOGGLE_ENTITY ───────────────────────────────────────

describe('dispatch TOGGLE_ENTITY', () => {
  beforeEach(() => {
    resetState()
  })

  it('should flip REDACT to KEEP', () => {
    entities.value = [makeEntity({ id: 'e1', decision: 'REDACT' })]
    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
    expect(entities.value[0].decision).toBe('KEEP')
  })

  it('should flip KEEP to REDACT', () => {
    entities.value = [makeEntity({ id: 'e1', decision: 'KEEP' })]
    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
    expect(entities.value[0].decision).toBe('REDACT')
  })

  it('should set UNCERTAIN to REDACT on first toggle', () => {
    entities.value = [makeEntity({ id: 'e1', decision: 'UNCERTAIN' })]
    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
    expect(entities.value[0].decision).toBe('REDACT')
  })

  it('should toggle REDACT→KEEP→REDACT in sequence', () => {
    entities.value = [makeEntity({ id: 'e1', decision: 'REDACT' })]

    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
    expect(entities.value[0].decision).toBe('KEEP')

    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
    expect(entities.value[0].decision).toBe('REDACT')
  })

  it('should only toggle the specified entity', () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'REDACT' }),
      makeEntity({ id: 'e2', decision: 'KEEP' }),
    ]
    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
    expect(entities.value[0].decision).toBe('KEEP')
    expect(entities.value[1].decision).toBe('KEEP')
  })

  it('should handle non-existent entityId gracefully', () => {
    entities.value = [makeEntity({ id: 'e1', decision: 'REDACT' })]
    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'nonexistent' })
    expect(entities.value[0].decision).toBe('REDACT')
  })

  it('should update computed counts after toggle', () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'REDACT' }),
      makeEntity({ id: 'e2', decision: 'REDACT' }),
    ]
    expect(redactCount.value).toBe(2)
    expect(keepCount.value).toBe(0)

    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })
    expect(redactCount.value).toBe(1)
    expect(keepCount.value).toBe(1)
  })
})

// ─── dispatch: SET_MODE ────────────────────────────────────────────

describe('dispatch SET_MODE', () => {
  beforeEach(() => {
    resetState()
  })

  it('should update currentMode', () => {
    dispatch({ type: 'SET_MODE', mode: 'FULL_REDACTION' })
    expect(currentMode.value).toBe('FULL_REDACTION')
  })

  it('should switch back to IDENTITY_ONLY', () => {
    dispatch({ type: 'SET_MODE', mode: 'FULL_REDACTION' })
    dispatch({ type: 'SET_MODE', mode: 'IDENTITY_ONLY' })
    expect(currentMode.value).toBe('IDENTITY_ONLY')
  })
})

// ─── dispatch: REDACTION_START ─────────────────────────────────────

describe('dispatch REDACTION_START', () => {
  beforeEach(() => {
    resetState()
  })

  it('should set appState to PROCESSING', () => {
    dispatch({ type: 'REDACTION_START' })
    expect(appState.value).toBe('PROCESSING')
  })

  it('should reset processingProgress', () => {
    processingProgress.value = { page: 3, total: 5 }
    dispatch({ type: 'REDACTION_START' })
    expect(processingProgress.value).toEqual({ page: 0, total: 0 })
  })
})

// ─── dispatch: REDACTION_PROGRESS ──────────────────────────────────

describe('dispatch REDACTION_PROGRESS', () => {
  beforeEach(() => {
    resetState()
  })

  it('should update processingProgress', () => {
    dispatch({ type: 'REDACTION_PROGRESS', page: 4, total: 10 })
    expect(processingProgress.value).toEqual({ page: 4, total: 10 })
  })
})

// ─── dispatch: REDACTION_COMPLETE ──────────────────────────────────

describe('dispatch REDACTION_COMPLETE', () => {
  beforeEach(() => {
    resetState()
  })

  it('should set appState to DONE', () => {
    dispatch({ type: 'REDACTION_COMPLETE' })
    expect(appState.value).toBe('DONE')
  })
})

// ─── dispatch: RESET ───────────────────────────────────────────────

describe('dispatch RESET', () => {
  beforeEach(() => {
    resetState()
  })

  it('should clear all state to initial values', () => {
    // Set up non-initial state
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
    entities.value = [makeEntity({ id: 'e1' })]
    currentPage.value = 3
    totalPages.value = 5
    currentFile.value = file
    error.value = 'some error'
    processingProgress.value = { page: 2, total: 5 }
    appState.value = 'NEEDS_REVIEW'

    dispatch({ type: 'RESET' })

    expect(appState.value).toBe('IDLE')
    expect(entities.value).toEqual([])
    expect(currentPage.value).toBe(1)
    expect(totalPages.value).toBe(0)
    expect(currentFile.value).toBeNull()
    expect(error.value).toBeNull()
    expect(processingProgress.value).toEqual({ page: 0, total: 0 })
    expect(indexedPages.value).toEqual([])
  })

  it('should reset computed counts to 0', () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'REDACT' }),
      makeEntity({ id: 'e2', decision: 'UNCERTAIN' }),
    ]
    expect(redactCount.value).toBe(1)

    dispatch({ type: 'RESET' })

    expect(redactCount.value).toBe(0)
    expect(keepCount.value).toBe(0)
    expect(uncertainCount.value).toBe(0)
  })
})

// ─── dispatch: ERROR ───────────────────────────────────────────────

describe('dispatch ERROR', () => {
  beforeEach(() => {
    resetState()
  })

  it('should set appState to ERROR', () => {
    dispatch({ type: 'ERROR', message: 'Something went wrong' })
    expect(appState.value).toBe('ERROR')
  })

  it('should set error message', () => {
    dispatch({ type: 'ERROR', message: 'File too large' })
    expect(error.value).toBe('File too large')
  })
})

// ─── resetState function ───────────────────────────────────────────

describe('resetState', () => {
  it('should clear all signals to defaults', () => {
    appState.value = 'DONE'
    entities.value = [makeEntity()]
    currentPage.value = 7
    totalPages.value = 10
    currentMode.value = 'FULL_REDACTION'
    error.value = 'err'
    processingProgress.value = { page: 5, total: 10 }

    resetState()

    expect(appState.value).toBe('IDLE')
    expect(entities.value).toEqual([])
    expect(currentPage.value).toBe(1)
    expect(totalPages.value).toBe(0)
    expect(currentMode.value).toBe('IDENTITY_ONLY')
    expect(currentFile.value).toBeNull()
    expect(error.value).toBeNull()
    expect(processingProgress.value).toEqual({ page: 0, total: 0 })
    expect(indexedPages.value).toEqual([])
  })

  it('should be callable multiple times safely', () => {
    resetState()
    resetState()
    expect(appState.value).toBe('IDLE')
  })
})
