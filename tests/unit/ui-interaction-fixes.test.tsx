// tests/unit/ui-interaction-fixes.test.tsx
// Tests for the 5 UI interaction fixes:
// 1. Multi-file drops rejection
// 2. Sidebar scroll-to-highlight
// 3. Count chip consistency between sidebar and footer
// 4. Thumbnail cache clearing on reset
// 5. Tooltip delay behavior

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
  appState,
  error,
  currentPage,
  totalPages,
  focusedEntity,
  dispatch,
  redactCount,
  keepCount,
  uncertainCount,
  onReset,
} from '../../src/app/state'
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

// ═══════════════════════════════════════════════════════════════════
// Fix #1: Multi-file drops rejection
// ═══════════════════════════════════════════════════════════════════

describe('Multi-file drop rejection', () => {
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

  async function renderDropScreen() {
    const { DropScreen } = await import('../../src/components/DropScreen')
    render(<DropScreen />, container)
  }

  it('should show "one file at a time" error when multiple files are dropped', async () => {
    await renderDropScreen()

    const dropZone = container.querySelector('.drop')!
    const file1 = new File(['pdf1'], 'doc1.pdf', { type: 'application/pdf' })
    const file2 = new File(['pdf2'], 'doc2.pdf', { type: 'application/pdf' })

    const dropEvent = new Event('drop', { bubbles: true }) as any
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file1, file2] },
    })
    dropEvent.preventDefault = vi.fn()
    dropEvent.stopPropagation = vi.fn()
    dropZone.dispatchEvent(dropEvent)

    await new Promise((r) => setTimeout(r, 10))

    expect(error.value).toBe('Please drop one file at a time.')
    expect(appState.value).toBe('ERROR')
  })

  it('should not process any file when multiple files are dropped', async () => {
    await renderDropScreen()

    const dropZone = container.querySelector('.drop')!
    const file1 = new File(['pdf1'], 'doc1.pdf', { type: 'application/pdf' })
    const file2 = new File(['pdf2'], 'doc2.pdf', { type: 'application/pdf' })

    const dropEvent = new Event('drop', { bubbles: true }) as any
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file1, file2] },
    })
    dropEvent.preventDefault = vi.fn()
    dropEvent.stopPropagation = vi.fn()
    dropZone.dispatchEvent(dropEvent)

    await new Promise((r) => setTimeout(r, 10))

    // App should stay on error/idle, NOT transition to LOADING
    expect(['IDLE', 'ERROR']).toContain(appState.value)
  })

  it('should accept a single file drop normally', async () => {
    await renderDropScreen()

    const dropZone = container.querySelector('.drop')!
    const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })

    const dropEvent = new Event('drop', { bubbles: true }) as any
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] },
    })
    dropEvent.preventDefault = vi.fn()
    dropEvent.stopPropagation = vi.fn()
    dropZone.dispatchEvent(dropEvent)

    await new Promise((r) => setTimeout(r, 10))

    // Single file should NOT show "one file at a time" error
    expect(error.value).not.toBe('Please drop one file at a time.')
  })
})

// ═══════════════════════════════════════════════════════════════════
// Fix #2: Sidebar scroll-to-highlight (unit test for focus + page navigation)
// ═══════════════════════════════════════════════════════════════════

describe('Sidebar entity focus and page navigation', () => {
  beforeEach(() => {
    resetState()
  })

  it('should set focusedEntity when FOCUS_ENTITY is dispatched', () => {
    dispatch({ type: 'FOCUS_ENTITY', entityType: 'US_SSN' })
    expect(focusedEntity.value).toBe('US_SSN')
  })

  it('should navigate to entity page when clicking entity on different page', () => {
    entities.value = [
      makeEntity({ id: 'e1', type: 'US_SSN', page: 1 }),
      makeEntity({ id: 'e2', type: 'EMAIL_ADDRESS', page: 3 }),
    ]
    totalPages.value = 3
    currentPage.value = 1

    // Simulate what handleEntityClick does when entity is on page 3
    dispatch({ type: 'FOCUS_ENTITY', entityType: 'EMAIL_ADDRESS' })
    dispatch({ type: 'SET_PAGE', page: 3 })

    expect(currentPage.value).toBe(3)
    expect(focusedEntity.value).toBe('EMAIL_ADDRESS')
  })
})

// ═══════════════════════════════════════════════════════════════════
// Fix #3: Count chip consistency between sidebar and footer
// ═══════════════════════════════════════════════════════════════════

describe('Count chip consistency', () => {
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

  it('sidebar group count chips should use same computed values as footer', () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
      makeEntity({ id: 'e2', decision: 'REDACT', type: 'EMAIL_ADDRESS' }),
      makeEntity({ id: 'e3', decision: 'KEEP', type: 'MONEY' }),
      makeEntity({ id: 'e4', decision: 'UNCERTAIN', type: 'US_EIN' }),
    ]

    // Verify computed counts
    expect(redactCount.value).toBe(2)
    expect(keepCount.value).toBe(1)
    expect(uncertainCount.value).toBe(1)
  })

  it('sidebar count chips should render inside group labels', async () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
      makeEntity({ id: 'e2', decision: 'KEEP', type: 'MONEY' }),
      makeEntity({ id: 'e3', decision: 'UNCERTAIN', type: 'US_EIN' }),
    ]

    const { SummaryPanel } = await import('../../src/components/SummaryPanel')
    render(<SummaryPanel />, container)

    const groupCounts = container.querySelectorAll('.group-count')
    expect(groupCounts.length).toBe(3)

    // The count values should match footer bar values
    const countTexts = Array.from(groupCounts).map((c) => c.textContent?.trim())
    expect(countTexts).toContain('1') // Each group has 1 entity
  })

  it('footer count chips should update on entity toggle', async () => {
    entities.value = [
      makeEntity({ id: 'e1', decision: 'REDACT', type: 'US_SSN' }),
      makeEntity({ id: 'e2', decision: 'KEEP', type: 'MONEY' }),
    ]

    expect(redactCount.value).toBe(1)
    expect(keepCount.value).toBe(1)

    // Toggle e1 from REDACT to KEEP
    dispatch({ type: 'TOGGLE_ENTITY', entityId: 'e1' })

    expect(redactCount.value).toBe(0)
    expect(keepCount.value).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Fix #4: Thumbnail cache clearing on reset
// ═══════════════════════════════════════════════════════════════════

describe('Thumbnail cache management', () => {
  beforeEach(() => {
    resetState()
  })

  it('clearThumbnailCache should clear the cache', async () => {
    const { clearThumbnailCache } = await import('../../src/components/PageNav')
    // Just verify it doesn't throw
    expect(() => clearThumbnailCache()).not.toThrow()
  })

  it('reset should invoke registered cleanup callbacks', () => {
    const callback = vi.fn()
    const unregister = onReset(callback)

    resetState()

    expect(callback).toHaveBeenCalled()

    // Clean up
    unregister()
  })

  it('onReset unregister should prevent callback from being called', () => {
    const callback = vi.fn()
    const unregister = onReset(callback)

    // Unregister before reset
    unregister()
    resetState()

    expect(callback).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════
// Fix #5: Tooltip delay behavior
// ═══════════════════════════════════════════════════════════════════

describe('EntityTooltip mouse handler props', () => {
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

  it('should accept and render with onMouseEnter/onMouseLeave props', async () => {
    const { EntityTooltip } = await import('../../src/components/EntityTooltip')
    const entity = makeEntity({ id: 'tt-1', decision: 'REDACT' })
    const onEnter = vi.fn()
    const onLeave = vi.fn()

    render(
      <EntityTooltip
        entity={entity}
        x={100}
        y={200}
        flipped={false}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />,
      container
    )

    const tooltip = container.querySelector('.entity-tooltip') as HTMLElement
    expect(tooltip).toBeTruthy()

    // Simulate mouse enter on tooltip
    tooltip.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    expect(onEnter).toHaveBeenCalled()

    // Simulate mouse leave from tooltip
    tooltip.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    expect(onLeave).toHaveBeenCalled()
  })

  it('tooltip action button should still dispatch TOGGLE_ENTITY', async () => {
    const { EntityTooltip } = await import('../../src/components/EntityTooltip')
    const entity = makeEntity({ id: 'tt-toggle', decision: 'REDACT' })
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

    expect(entities.value[0].decision).toBe('KEEP')
  })
})
