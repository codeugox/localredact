// src/components/DropScreen.tsx
// File drop zone with drag-and-drop, file validation, mode selector,
// trust statement, and error display. Password modal is mounted at
// App.tsx level for global accessibility.
//
// Edge case handling:
// - Scanned/image-only PDF detection (no text items → user-friendly error)
// - Corrupted PDF handling (all PDF.js errors caught, sanitized messages)
// - Rapid repeated drops (processing gate cancels previous processing)

import { useRef, useCallback } from 'preact/hooks'
import {
  dispatch,
  currentMode,
  error,
  appState,
} from '../app/state'
import { validateFile } from '../core/pdf/loader'
import { ErrorMessage } from './ErrorMessage'
import { createOnPasswordCallback, hidePasswordModal } from '../app/password-prompt'
import type { RedactionMode } from '../core/detectors/entities'

/** Maximum number of files accepted in a single drop. */
const MAX_FILES = 1

// ─── Processing Gate ────────────────────────────────────────────────

/**
 * A processing gate prevents concurrent file processing and supports
 * cancellation of in-flight processing when a new file is dropped.
 */
export interface ProcessingGate {
  /** Whether processing is currently active */
  isProcessing(): boolean
  /** Start new processing — cancels any in-flight processing. Returns AbortController. */
  start(): AbortController
  /** Cancel current processing */
  cancel(): void
}

/**
 * Create a new processing gate instance.
 * Used by tests to create isolated gate instances.
 */
export function createProcessingGate(): ProcessingGate {
  let activeController: AbortController | null = null

  return {
    isProcessing() {
      return activeController !== null && !activeController.signal.aborted
    },

    start() {
      // Cancel any in-flight processing first
      if (activeController) {
        activeController.abort()
      }
      activeController = new AbortController()
      return activeController
    },

    cancel() {
      if (activeController) {
        activeController.abort()
        activeController = null
      }
    },
  }
}

/** Module-level processing gate singleton for production use */
const processingGate = createProcessingGate()

/**
 * Get the module-level processing gate (for testing).
 */
export function getProcessingGate(): ProcessingGate {
  return processingGate
}

// ─── Error sanitization ─────────────────────────────────────────────

/**
 * Sanitize an error into a user-friendly message.
 * Never exposes stack traces or internal error details.
 */
function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()

    // Password-related errors should not reach here (handled by password modal)
    // but guard just in case
    if (msg.includes('password')) {
      return 'This PDF requires a password to open.'
    }

    // If the error message already looks user-friendly (no stack traces), use it
    // But only if it's from our own validation (e.g., validateFile)
    if (
      err.message.includes('PDF') ||
      err.message.includes('file') ||
      err.message.includes('size')
    ) {
      // Strip any stack trace that might have leaked into the message
      const firstLine = err.message.split('\n')[0]
      if (!firstLine.includes('at ') && firstLine.length < 200) {
        return firstLine
      }
    }
  }

  return 'This file could not be opened as a PDF. It may be corrupted or not a valid PDF file.'
}

// ─── File processing ────────────────────────────────────────────────

/**
 * Process a valid file: dispatch SET_FILE and trigger detection pipeline.
 * Wires the onPassword callback to show the global PasswordModal.
 *
 * Uses the processing gate to handle rapid repeated drops:
 * - Cancels any in-flight processing when a new file is dropped
 * - Checks abort signal after async operations to prevent stale results
 */
async function handleValidFile(file: File): Promise<void> {
  // Start new processing — cancels any previous in-flight processing
  const controller = processingGate.start()
  const signal = controller.signal

  dispatch({ type: 'SET_FILE', file })
  dispatch({ type: 'DETECTION_START' })

  try {
    const { detectDocument, isNoTextDocument } = await import(
      '../core/pipeline/detect-document'
    )

    // Check if cancelled before starting expensive detection
    if (signal.aborted) return

    const result = await detectDocument(
      file,
      currentMode.value,
      (page, total) => {
        // Only dispatch progress if this processing is still active
        if (!signal.aborted) {
          dispatch({ type: 'DETECTION_PROGRESS', page, total })
        }
      },
      createOnPasswordCallback()
    )

    // Check if cancelled after detection completed
    if (signal.aborted) return

    // Detection succeeded — hide password modal if it was shown
    hidePasswordModal()

    // Check for scanned/image-only PDF (no text items across all pages)
    if (isNoTextDocument(result.pages)) {
      processingGate.cancel()
      dispatch({
        type: 'ERROR',
        message:
          'This document appears to contain only scanned images. Text-based redaction is not possible. Image support is coming in a future version.',
      })
      return
    }

    dispatch({
      type: 'DETECTION_COMPLETE',
      entities: result.entities,
      pages: result.pages,
      totalPages: result.pages.length,
    })
  } catch (err) {
    // Only dispatch error if this processing is still active
    if (signal.aborted) return

    processingGate.cancel()
    const message = sanitizeError(err)
    dispatch({ type: 'ERROR', message })
  }
}

/**
 * Validate and process a dropped/selected file.
 */
function processFile(file: File): void {
  const validation = validateFile(file)
  if (!validation.valid) {
    error.value = validation.error
    appState.value = 'ERROR'
    return
  }

  // Clear any previous error and process
  error.value = null
  handleValidFile(file)
}

export function DropScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // ─── Drag-and-drop handlers ───────────────────────────────────

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropRef.current?.classList.add('over')
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropRef.current?.classList.add('over')
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only remove hover if leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as Node | null
    if (relatedTarget && dropRef.current?.contains(relatedTarget)) return
    dropRef.current?.classList.remove('over')
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropRef.current?.classList.remove('over')

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    // Reject multiple files: show message and don't process any
    if (files.length > MAX_FILES) {
      error.value = 'Please drop one file at a time.'
      appState.value = 'ERROR'
      return
    }

    processFile(files[0])
  }, [])

  // ─── File input handler ───────────────────────────────────────

  const handleFileInput = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement
    const files = input.files
    if (!files || files.length === 0) return
    processFile(files[0])
    // Reset input so the same file can be re-selected
    input.value = ''
  }, [])

  // ─── Click handler — opens file picker ────────────────────────

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleBrowseClick = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    fileInputRef.current?.click()
  }, [])

  // ─── Mode selector ───────────────────────────────────────────

  const handleModeSelect = useCallback((mode: RedactionMode) => {
    dispatch({ type: 'SET_MODE', mode })
  }, [])

  const mode = currentMode.value
  const errorMessage = error.value

  return (
    <div class="app-main">
      <div class="container-sm anim-rise">
        {/* Headline */}
        <div class="headline">
          <h1>
            Redact before
            <br />
            you <span class="u">share.</span>
          </h1>
          <p class="sub">
            Drop a PDF. Remove the parts that shouldn't travel with it — names,
            SSNs, account numbers. Download a clean version. Nothing leaves your
            browser.
          </p>
        </div>

        {/* Drop zone */}
        <div
          class="drop"
          ref={dropRef}
          onClick={handleDropZoneClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Document icon with redaction bar */}
          <svg
            class="drop-icon"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="6"
              y="2"
              width="22"
              height="28"
              rx="2.5"
              fill="#F4F1EC"
              stroke="#D8D3CB"
              stroke-width="1.5"
            />
            <path
              d="M20 2 V8.5 H28"
              fill="#EDEAE4"
              stroke="#D8D3CB"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
            <rect x="6" y="14" width="22" height="5.5" fill="#1C1812" />
            <rect
              x="9.5"
              y="22.5"
              width="10"
              height="1.5"
              rx="0.75"
              fill="#D8D3CB"
            />
            <rect
              x="9.5"
              y="25.5"
              width="7"
              height="1.5"
              rx="0.75"
              fill="#D8D3CB"
            />
            <circle
              cx="32"
              cy="32"
              r="7"
              fill="white"
              stroke="#E5E1DA"
              stroke-width="1.5"
            />
            <path
              d="M32 27.5 L32 35.5 M29 32.5 L32 35.5 L35 32.5"
              stroke="#C41E1E"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <div class="drop-label">Drop a PDF here</div>
          <div class="drop-hint">
            or{' '}
            <a onClick={handleBrowseClick} role="button" tabIndex={0}>
              browse your files
            </a>
          </div>

          <div class="drop-rule" />
          <div class="drop-spec">PDF &nbsp;·&nbsp; max 50 MB</div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>

        {/* Error display */}
        {errorMessage && <ErrorMessage message={errorMessage} />}

        {/* Mode selector */}
        <div class="modes">
          <button
            class={`mode ${mode === 'IDENTITY_ONLY' ? 'active' : ''}`}
            data-mode="identity"
            onClick={() => handleModeSelect('IDENTITY_ONLY')}
            type="button"
          >
            <div class="radio" />
            <div class="mode-copy">
              <div class="mode-name">Identity only</div>
              <div class="mode-desc">Keeps dollar amounts</div>
            </div>
          </button>
          <button
            class={`mode ${mode === 'FULL_REDACTION' ? 'active' : ''}`}
            data-mode="full"
            onClick={() => handleModeSelect('FULL_REDACTION')}
            type="button"
          >
            <div class="radio" />
            <div class="mode-copy">
              <div class="mode-name">Full redaction</div>
              <div class="mode-desc">Removes everything</div>
            </div>
          </button>
        </div>

        {/* Trust statement */}
        <p class="trust">
          <strong>Zero bytes transmitted.</strong> Runs in your tab. Open{' '}
          <code>DevTools → Network</code> to confirm.
        </p>

        {/* Footer links */}
        <div class="drop-footer">
          <a class="drop-footer-link" href="/faq.html">FAQ</a>
          <span class="drop-footer-sep">·</span>
          <a class="drop-footer-link" href="/privacy.html">Privacy</a>
          <span class="drop-footer-sep">·</span>
          <a
            class="drop-footer-link"
            href="https://github.com/codeugox/localredact"
            target="_blank"
            rel="noopener noreferrer"
          >Source</a>
          <span class="drop-footer-sep">·</span>
          <span class="drop-footer-link" style={{ cursor: 'default' }}>MIT License</span>
        </div>
      </div>
    </div>
  )
}
