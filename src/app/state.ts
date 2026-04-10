// src/app/state.ts
// Preact Signals-based app state management.
// All UI state lives here — components read signals directly.
// Includes full cleanup/memory management for safe session resets.

import { signal, computed } from '@preact/signals'
import type { DetectedEntity, RedactionMode } from '../core/detectors/entities'
import type { IndexedPage } from '../core/text-index'

// ─── App state machine ─────────────────────────────────────────────

/**
 * Application screen state.
 * IDLE         → drop screen (waiting for file)
 * LOADING      → processing screen (detection in progress)
 * NEEDS_REVIEW → preview/review screen
 * PROCESSING   → processing screen (redaction in progress)
 * DONE         → done screen (download complete)
 * ERROR        → error displayed (typically on drop screen)
 */
export type AppStateValue =
  | 'IDLE'
  | 'LOADING'
  | 'NEEDS_REVIEW'
  | 'PROCESSING'
  | 'DONE'
  | 'ERROR'

// ─── Core signals ──────────────────────────────────────────────────

/** Current application screen state */
export const appState = signal<AppStateValue>('IDLE')

/** All detected entities across all pages */
export const entities = signal<DetectedEntity[]>([])

/** Current page number (1-indexed) */
export const currentPage = signal<number>(1)

/** Total number of pages in the loaded PDF */
export const totalPages = signal<number>(0)

/** Active redaction mode */
export const currentMode = signal<RedactionMode>('IDENTITY_ONLY')

/** Currently loaded file (null when no file is loaded) */
export const currentFile = signal<File | null>(null)

/** Error message (null when no error) */
export const error = signal<string | null>(null)

/** Processing progress for detection or redaction */
export const processingProgress = signal<{ page: number; total: number }>({
  page: 0,
  total: 0,
})

/** Indexed page data from the text indexer */
export const indexedPages = signal<IndexedPage[]>([])

/** Currently focused entity type in the sidebar (null when no focus) */
export const focusedEntity = signal<string | null>(null)

/** Currently focused entity ID for keyboard nav and tooltip (null when no focus) */
export const focusedEntityId = signal<string | null>(null)

/** Stored password for encrypted PDFs (null when not encrypted or not yet entered) */
export const pdfPassword = signal<string | null>(null)

/** DPI fallback warning message — set when 300 DPI canvas creation fails and 240 DPI is used */
export const dpiFallbackWarning = signal<string | null>(null)

// ─── Resource tracking for cleanup ─────────────────────────────────

/**
 * Active PDF document proxy. Tracked so resetState can call pdf.destroy()
 * to terminate the web worker and release all PDF.js internal resources.
 * Set by components that load PDFs (e.g. DocumentViewer, PageNav).
 */
let activePdfProxy: { destroy(): Promise<void> } | null = null

/**
 * Register the active PDF document proxy for cleanup on reset.
 * Only one PDF is active at a time; calling again replaces the reference.
 */
export function setActivePdfProxy(pdf: { destroy(): Promise<void> } | null): void {
  activePdfProxy = pdf
}

/**
 * Get the active PDF document proxy (for testing/inspection).
 */
export function getActivePdfProxy(): { destroy(): Promise<void> } | null {
  return activePdfProxy
}

/**
 * Tracked blob URLs created via URL.createObjectURL that need revocation on reset.
 * Components call trackBlobUrl() when creating blob URLs and untrackBlobUrl()
 * when manually revoking them. resetState revokes all remaining tracked URLs.
 */
const trackedBlobUrls = new Set<string>()

/**
 * Register a blob URL for automatic revocation on reset.
 */
export function trackBlobUrl(url: string): void {
  trackedBlobUrls.add(url)
}

/**
 * Remove a blob URL from tracking (e.g., after manual revocation).
 */
export function untrackBlobUrl(url: string): void {
  trackedBlobUrls.delete(url)
}

/**
 * Get the set of currently tracked blob URLs (for testing).
 */
export function getTrackedBlobUrls(): ReadonlySet<string> {
  return trackedBlobUrls
}

// ─── Computed signals ──────────────────────────────────────────────

/** Count of entities with REDACT decision */
export const redactCount = computed(
  () => entities.value.filter((e) => e.decision === 'REDACT').length
)

/** Count of entities with KEEP decision */
export const keepCount = computed(
  () => entities.value.filter((e) => e.decision === 'KEEP').length
)

/** Count of entities with UNCERTAIN decision */
export const uncertainCount = computed(
  () => entities.value.filter((e) => e.decision === 'UNCERTAIN').length
)

/** Entities on the current page */
export const entitiesForCurrentPage = computed(() =>
  entities.value.filter((e) => e.page === currentPage.value)
)

// ─── Dispatch events ───────────────────────────────────────────────

export type AppEvent =
  | { type: 'SET_FILE'; file: File }
  | { type: 'DETECTION_START' }
  | { type: 'DETECTION_PROGRESS'; page: number; total: number }
  | {
      type: 'DETECTION_COMPLETE'
      entities: DetectedEntity[]
      pages: IndexedPage[]
      totalPages: number
    }
  | { type: 'TOGGLE_ENTITY'; entityId: string }
  | { type: 'SET_MODE'; mode: RedactionMode }
  | { type: 'FOCUS_ENTITY'; entityType: string }
  | { type: 'FOCUS_ENTITY_ID'; entityId: string }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_ENTITY_DECISION'; entityId: string; decision: DetectedEntity['decision'] }
  | { type: 'REDACTION_START' }
  | { type: 'REDACTION_PROGRESS'; page: number; total: number }
  | { type: 'REDACTION_COMPLETE' }
  | { type: 'RESET' }
  | { type: 'ERROR'; message: string }

/**
 * Dispatch an event to update application state.
 * All state transitions go through this function.
 */
export function dispatch(event: AppEvent): void {
  switch (event.type) {
    case 'SET_FILE': {
      currentFile.value = event.file
      error.value = null
      break
    }

    case 'DETECTION_START': {
      appState.value = 'LOADING'
      entities.value = []
      processingProgress.value = { page: 0, total: 0 }
      break
    }

    case 'DETECTION_PROGRESS': {
      processingProgress.value = { page: event.page, total: event.total }
      break
    }

    case 'DETECTION_COMPLETE': {
      entities.value = event.entities
      indexedPages.value = event.pages
      totalPages.value = event.totalPages
      currentPage.value = 1
      appState.value = 'NEEDS_REVIEW'
      break
    }

    case 'TOGGLE_ENTITY': {
      const idx = entities.value.findIndex((e) => e.id === event.entityId)
      if (idx === -1) break

      const entity = entities.value[idx]
      let newDecision: DetectedEntity['decision']

      switch (entity.decision) {
        case 'REDACT':
          newDecision = 'KEEP'
          break
        case 'KEEP':
          newDecision = 'REDACT'
          break
        case 'UNCERTAIN':
          newDecision = 'REDACT'
          break
      }

      // Create new array with updated entity to trigger signal update
      const updated = [...entities.value]
      updated[idx] = { ...entity, decision: newDecision }
      entities.value = updated
      break
    }

    case 'SET_MODE': {
      currentMode.value = event.mode
      break
    }

    case 'FOCUS_ENTITY': {
      focusedEntity.value = event.entityType
      break
    }

    case 'FOCUS_ENTITY_ID': {
      focusedEntityId.value = event.entityId
      // Also update focusedEntity type for sidebar highlighting
      const focusTarget = entities.value.find((e) => e.id === event.entityId)
      if (focusTarget) {
        focusedEntity.value = focusTarget.type
      }
      break
    }

    case 'SET_PAGE': {
      if (event.page >= 1 && event.page <= totalPages.value) {
        currentPage.value = event.page
      }
      break
    }

    case 'SET_ENTITY_DECISION': {
      const decIdx = entities.value.findIndex((e) => e.id === event.entityId)
      if (decIdx === -1) break

      const decEntity = entities.value[decIdx]
      const decUpdated = [...entities.value]
      decUpdated[decIdx] = { ...decEntity, decision: event.decision }
      entities.value = decUpdated
      break
    }

    case 'REDACTION_START': {
      appState.value = 'PROCESSING'
      processingProgress.value = { page: 0, total: 0 }
      break
    }

    case 'REDACTION_PROGRESS': {
      processingProgress.value = { page: event.page, total: event.total }
      break
    }

    case 'REDACTION_COMPLETE': {
      appState.value = 'DONE'
      pdfPassword.value = null
      break
    }

    case 'RESET': {
      resetState()
      break
    }

    case 'ERROR': {
      appState.value = 'ERROR'
      error.value = event.message
      break
    }
  }
}

// ─── Reset callbacks ───────────────────────────────────────────────

/** Cleanup callbacks registered by components for execution on reset */
const resetCallbacks: Array<() => void> = []

/**
 * Register a callback to be called when state is reset.
 * Used by components that maintain module-level caches (e.g., thumbnail cache).
 * Returns unregister function.
 */
export function onReset(callback: () => void): () => void {
  resetCallbacks.push(callback)
  return () => {
    const idx = resetCallbacks.indexOf(callback)
    if (idx >= 0) resetCallbacks.splice(idx, 1)
  }
}

// ─── Reset ─────────────────────────────────────────────────────────

/**
 * Perform thorough cleanup and reset all signals to initial defaults.
 * Called on "Start over" and when dispatch receives RESET event.
 *
 * Cleanup steps:
 * 1. Destroy active PDF proxy (terminates PDF.js worker, releases internal caches)
 * 2. Revoke all tracked blob URLs (prevents memory leaks from createObjectURL)
 * 3. Release all canvas elements by setting width=0 (frees GPU memory)
 * 4. Clear password string reference
 * 5. Null out file references and ArrayBuffers
 * 6. Clear normalized text arrays and entity arrays
 * 7. Run registered cleanup callbacks (e.g., thumbnail cache clearing)
 */
export function resetState(): void {
  // 1. Destroy active PDF proxy — terminates PDF.js worker
  if (activePdfProxy) {
    const pdf = activePdfProxy
    activePdfProxy = null
    // Fire-and-forget: destroy is async but we don't need to await it
    pdf.destroy().catch(() => { /* ignore cleanup errors */ })
  }

  // 2. Revoke all tracked blob URLs
  for (const url of trackedBlobUrls) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Ignore errors — URL may have been revoked already
    }
  }
  trackedBlobUrls.clear()

  // 3. Release all canvas elements in the document by setting width=0
  // This frees GPU-backed memory for any canvases we created
  try {
    const canvases = document.querySelectorAll('canvas')
    for (const canvas of canvases) {
      canvas.width = 0
      canvas.height = 0
    }
  } catch {
    // Ignore errors — may not have DOM access in tests
  }

  // 4–6. Clear all signal values to defaults
  appState.value = 'IDLE'
  entities.value = []
  currentPage.value = 1
  totalPages.value = 0
  currentMode.value = 'IDENTITY_ONLY'
  currentFile.value = null
  error.value = null
  processingProgress.value = { page: 0, total: 0 }
  indexedPages.value = []
  focusedEntity.value = null
  focusedEntityId.value = null
  pdfPassword.value = null
  dpiFallbackWarning.value = null

  // 7. Run registered cleanup callbacks (e.g., thumbnail cache clearing)
  for (const cb of resetCallbacks) {
    cb()
  }


}
