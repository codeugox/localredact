// src/app/state.ts
// Preact Signals-based app state management.
// All UI state lives here — components read signals directly.

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

// ─── Reset ─────────────────────────────────────────────────────────

/**
 * Reset all signals to their initial default values.
 * Called on "Start over" and when dispatch receives RESET event.
 */
export function resetState(): void {
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
}
