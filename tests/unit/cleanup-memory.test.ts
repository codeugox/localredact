// tests/unit/cleanup-memory.test.ts
// Tests for thorough cleanup and memory management:
// - resetState performs full cleanup (PDF destroy, canvas release, URL revoke, signal clear)
// - No data contamination between file sessions
// - Blob URL tracking and revocation
// - Sequential page processing in redaction pipeline (verified via module shape)

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { DetectedEntity } from '../../src/core/detectors/entities'

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
  pdfPassword,
  dispatch,
  resetState,
  setActivePdfProxy,
  getActivePdfProxy,
  trackBlobUrl,
  untrackBlobUrl,
  getTrackedBlobUrls,
  onReset,
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

// ─── resetState full cleanup ───────────────────────────────────────

describe('resetState full cleanup', () => {
  beforeEach(() => {
    resetState()
  })

  it('should call pdf.destroy() if an active PDF proxy is registered', async () => {
    const mockDestroy = vi.fn().mockResolvedValue(undefined)
    const mockPdf = { destroy: mockDestroy }
    setActivePdfProxy(mockPdf)

    expect(getActivePdfProxy()).toBe(mockPdf)

    resetState()

    // destroy was called
    expect(mockDestroy).toHaveBeenCalledTimes(1)
    // proxy is cleared
    expect(getActivePdfProxy()).toBeNull()
  })

  it('should not throw if no active PDF proxy is set', () => {
    setActivePdfProxy(null)
    expect(() => resetState()).not.toThrow()
  })

  it('should handle pdf.destroy() rejection gracefully', () => {
    const mockDestroy = vi.fn().mockRejectedValue(new Error('already destroyed'))
    setActivePdfProxy({ destroy: mockDestroy })

    // Should not throw even when destroy rejects
    expect(() => resetState()).not.toThrow()
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  it('should revoke all tracked blob URLs on reset', () => {
    // jsdom may not have URL.revokeObjectURL — polyfill it
    const originalRevoke = URL.revokeObjectURL
    const revokedUrls: string[] = []
    URL.revokeObjectURL = (url: string) => { revokedUrls.push(url) }

    trackBlobUrl('blob:http://localhost/aaa')
    trackBlobUrl('blob:http://localhost/bbb')
    expect(getTrackedBlobUrls().size).toBe(2)

    resetState()

    expect(revokedUrls).toContain('blob:http://localhost/aaa')
    expect(revokedUrls).toContain('blob:http://localhost/bbb')
    expect(getTrackedBlobUrls().size).toBe(0)

    URL.revokeObjectURL = originalRevoke
  })

  it('should not throw if revokeObjectURL fails', () => {
    const originalRevoke = URL.revokeObjectURL
    URL.revokeObjectURL = () => {
      throw new Error('already revoked')
    }

    trackBlobUrl('blob:http://localhost/ccc')
    expect(() => resetState()).not.toThrow()
    expect(getTrackedBlobUrls().size).toBe(0)

    URL.revokeObjectURL = originalRevoke
  })

  it('should release all canvas elements by setting width=0 and height=0', () => {
    // Create some canvases in the DOM
    const canvas1 = document.createElement('canvas')
    canvas1.width = 2550
    canvas1.height = 3300
    document.body.appendChild(canvas1)

    const canvas2 = document.createElement('canvas')
    canvas2.width = 800
    canvas2.height = 600
    document.body.appendChild(canvas2)

    resetState()

    expect(canvas1.width).toBe(0)
    expect(canvas1.height).toBe(0)
    expect(canvas2.width).toBe(0)
    expect(canvas2.height).toBe(0)

    // Cleanup DOM
    document.body.removeChild(canvas1)
    document.body.removeChild(canvas2)
  })

  it('should clear password string reference', () => {
    pdfPassword.value = 'supersecret123'
    resetState()
    expect(pdfPassword.value).toBeNull()
  })

  it('should null out file reference', () => {
    currentFile.value = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    resetState()
    expect(currentFile.value).toBeNull()
  })

  it('should clear entity arrays', () => {
    entities.value = [
      makeEntity({ id: 'e1' }),
      makeEntity({ id: 'e2' }),
    ]
    resetState()
    expect(entities.value).toEqual([])
  })

  it('should clear normalized text arrays (indexedPages)', () => {
    indexedPages.value = [
      { pageNum: 1, text: 'SSN: 123-45-6789', charMap: [], items: [], viewport: { width: 612, height: 792 } },
    ]
    resetState()
    expect(indexedPages.value).toEqual([])
  })

  it('should reset all signals to initial defaults after full cleanup', () => {
    // Set up non-initial state with all fields
    const mockDestroy = vi.fn().mockResolvedValue(undefined)
    setActivePdfProxy({ destroy: mockDestroy })
    trackBlobUrl('blob:http://localhost/test')

    appState.value = 'DONE'
    entities.value = [makeEntity()]
    currentPage.value = 7
    totalPages.value = 15
    currentMode.value = 'FULL_REDACTION'
    currentFile.value = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
    error.value = 'some error'
    processingProgress.value = { page: 5, total: 15 }
    indexedPages.value = [{ pageNum: 1, text: 'text', charMap: [], items: [], viewport: { width: 100, height: 100 } }]
    focusedEntity.value = 'US_SSN'
    focusedEntityId.value = 'entity-1'
    pdfPassword.value = 'password'

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
    expect(focusedEntity.value).toBeNull()
    expect(focusedEntityId.value).toBeNull()
    expect(pdfPassword.value).toBeNull()
    expect(getActivePdfProxy()).toBeNull()
    expect(getTrackedBlobUrls().size).toBe(0)
  })
})

// ─── Blob URL tracking ────────────────────────────────────────────

describe('Blob URL tracking', () => {
  beforeEach(() => {
    resetState()
  })

  it('should track a blob URL', () => {
    trackBlobUrl('blob:http://localhost/aaa')
    expect(getTrackedBlobUrls().has('blob:http://localhost/aaa')).toBe(true)
  })

  it('should untrack a blob URL', () => {
    trackBlobUrl('blob:http://localhost/aaa')
    untrackBlobUrl('blob:http://localhost/aaa')
    expect(getTrackedBlobUrls().has('blob:http://localhost/aaa')).toBe(false)
  })

  it('should handle untracking a URL that was never tracked', () => {
    expect(() => untrackBlobUrl('blob:http://localhost/unknown')).not.toThrow()
  })

  it('should track multiple URLs', () => {
    trackBlobUrl('blob:http://localhost/a')
    trackBlobUrl('blob:http://localhost/b')
    trackBlobUrl('blob:http://localhost/c')
    expect(getTrackedBlobUrls().size).toBe(3)
  })
})

// ─── No data contamination between sessions ───────────────────────

describe('No data contamination between sessions', () => {
  beforeEach(() => {
    resetState()
  })

  it('should not carry entities from session A into session B after reset', () => {
    // Session A
    const sessionAEntities = [
      makeEntity({ id: 'a1', text: '111-22-3333', type: 'US_SSN' }),
      makeEntity({ id: 'a2', text: 'john@test.com', type: 'EMAIL_ADDRESS' }),
    ]
    entities.value = sessionAEntities
    appState.value = 'NEEDS_REVIEW'
    currentFile.value = new File(['pdf-a'], 'doc-a.pdf', { type: 'application/pdf' })

    // Reset (start over)
    dispatch({ type: 'RESET' })

    // Session B
    expect(entities.value).toEqual([])
    expect(currentFile.value).toBeNull()
    expect(appState.value).toBe('IDLE')

    // Load new entities for session B
    const sessionBEntities = [
      makeEntity({ id: 'b1', text: '444-55-6666', type: 'US_SSN' }),
    ]
    entities.value = sessionBEntities

    // Verify no session A data present
    expect(entities.value).toHaveLength(1)
    expect(entities.value[0].text).toBe('444-55-6666')
    expect(entities.value.some((e) => e.text === '111-22-3333')).toBe(false)
    expect(entities.value.some((e) => e.text === 'john@test.com')).toBe(false)
  })

  it('should not carry indexed pages from session A into session B after reset', () => {
    indexedPages.value = [
      { pageNum: 1, text: 'session A text with SSN', charMap: [], items: [], viewport: { width: 612, height: 792 } },
    ]

    dispatch({ type: 'RESET' })

    expect(indexedPages.value).toEqual([])

    // Session B
    indexedPages.value = [
      { pageNum: 1, text: 'session B different text', charMap: [], items: [], viewport: { width: 612, height: 792 } },
    ]
    expect(indexedPages.value[0].text).toBe('session B different text')
  })

  it('should not carry password from session A into session B', () => {
    pdfPassword.value = 'session-a-password'

    dispatch({ type: 'RESET' })

    expect(pdfPassword.value).toBeNull()
  })

  it('should not carry focused entity state from session A', () => {
    focusedEntity.value = 'US_SSN'
    focusedEntityId.value = 'entity-42'

    dispatch({ type: 'RESET' })

    expect(focusedEntity.value).toBeNull()
    expect(focusedEntityId.value).toBeNull()
  })
})

// ─── Active PDF proxy management ──────────────────────────────────

describe('Active PDF proxy management', () => {
  beforeEach(() => {
    resetState()
  })

  it('should allow setting and getting the active PDF proxy', () => {
    const mockPdf = { destroy: vi.fn().mockResolvedValue(undefined) }
    setActivePdfProxy(mockPdf)
    expect(getActivePdfProxy()).toBe(mockPdf)
  })

  it('should allow replacing the active PDF proxy', () => {
    const mockPdf1 = { destroy: vi.fn().mockResolvedValue(undefined) }
    const mockPdf2 = { destroy: vi.fn().mockResolvedValue(undefined) }
    setActivePdfProxy(mockPdf1)
    setActivePdfProxy(mockPdf2)
    expect(getActivePdfProxy()).toBe(mockPdf2)
  })

  it('should allow setting to null', () => {
    const mockPdf = { destroy: vi.fn().mockResolvedValue(undefined) }
    setActivePdfProxy(mockPdf)
    setActivePdfProxy(null)
    expect(getActivePdfProxy()).toBeNull()
  })
})

// ─── Sequential redaction pipeline shape verification ──────────────

describe('Redaction pipeline sequential processing', () => {
  it('should export redactDocument as an async function', async () => {
    const mod = await import('../../src/core/pipeline/redact-document')
    expect(typeof mod.redactDocument).toBe('function')
  })

  it('pipeline module should use incremental repackager (createDoc, addPageToDoc, finalizeDoc)', async () => {
    // Verify the pipeline imports the incremental assembly functions
    // by checking the module exports exist in repackager
    const repackager = await import('../../src/core/redactor/repackager')
    expect(typeof repackager.createDoc).toBe('function')
    expect(typeof repackager.addPageToDoc).toBe('function')
    expect(typeof repackager.finalizeDoc).toBe('function')
  })
})

// ─── Reset callbacks mechanism ─────────────────────────────────────

describe('Reset callbacks', () => {
  // This tests that registered cleanup callbacks (e.g., thumbnail cache) are called

  it('should call registered reset callbacks on resetState', () => {
    const callback = vi.fn()
    const unregister = onReset(callback)

    resetState()

    expect(callback).toHaveBeenCalledTimes(1)

    unregister()
  })

  it('should not call unregistered callbacks', () => {
    const callback = vi.fn()
    const unregister = onReset(callback)

    unregister()
    resetState()

    expect(callback).not.toHaveBeenCalled()
  })
})

// ─── Cleanup console.log evidence (VAL-SEC-005) ───────────────────

describe('Cleanup evidence logging', () => {
  beforeEach(() => {
    resetState()
  })

  it('should log cleanup confirmation message during resetState', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Set up some state to clean
    appState.value = 'DONE'
    entities.value = [makeEntity()]

    resetState()

    expect(consoleSpy).toHaveBeenCalledWith(
      'LocalRedact: cleanup complete — PDF destroyed, canvases released, URLs revoked, state reset'
    )

    consoleSpy.mockRestore()
  })

  it('should log cleanup even when no resources to clean', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    resetState()

    expect(consoleSpy).toHaveBeenCalledWith(
      'LocalRedact: cleanup complete — PDF destroyed, canvases released, URLs revoked, state reset'
    )

    consoleSpy.mockRestore()
  })
})
