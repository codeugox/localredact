// src/components/DropScreen.tsx
// File drop zone with drag-and-drop, file validation, mode selector,
// trust statement, error display, and password modal for encrypted PDFs.

import { useRef, useCallback } from 'preact/hooks'
import { signal } from '@preact/signals'
import {
  dispatch,
  currentMode,
  error,
  appState,
} from '../app/state'
import { validateFile } from '../core/pdf/loader'
import { ErrorMessage } from './ErrorMessage'
import { PasswordModal } from './PasswordModal'
import type { RedactionMode } from '../core/detectors/entities'

/** Maximum number of files accepted in a single drop. */
const MAX_FILES = 1

// ─── Password modal state ──────────────────────────────────────────

/** Whether the password modal is currently visible */
const showPasswordModal = signal(false)

/** The reason code from PDF.js (1 = need password, 2 = incorrect) */
const passwordReason = signal<number>(1)

/** Stored reference to the PDF.js updatePassword callback */
let pendingPasswordCallback: ((password: string) => void) | null = null

/**
 * Process a valid file: dispatch SET_FILE and trigger detection pipeline.
 * Wires the onPassword callback to show the PasswordModal.
 */
async function handleValidFile(file: File): Promise<void> {
  dispatch({ type: 'SET_FILE', file })
  dispatch({ type: 'DETECTION_START' })

  try {
    const { detectDocument } = await import('../core/pipeline/detect-document')
    const result = await detectDocument(
      file,
      currentMode.value,
      (page, total) => {
        dispatch({ type: 'DETECTION_PROGRESS', page, total })
      },
      (updatePassword, reason) => {
        // Store the callback and show the modal
        pendingPasswordCallback = updatePassword
        passwordReason.value = reason
        showPasswordModal.value = true
      }
    )
    dispatch({
      type: 'DETECTION_COMPLETE',
      entities: result.entities,
      pages: result.pages,
      totalPages: result.pages.length,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
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

    // Handle multiple files: only accept first, warn if multiple
    if (files.length > MAX_FILES) {
      // Still process the first valid PDF, but only one at a time
      error.value = null
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

  // ─── Password modal handlers ──────────────────────────────────

  const handlePasswordSubmit = useCallback((password: string) => {
    if (pendingPasswordCallback) {
      pendingPasswordCallback(password)
      // Don't hide the modal yet — if the password is wrong,
      // onPassword will be called again with INCORRECT_PASSWORD reason.
      // If correct, the detection pipeline will continue and the modal
      // will be hidden when the state changes to NEEDS_REVIEW.
    }
  }, [])

  const handlePasswordCancel = useCallback(() => {
    showPasswordModal.value = false
    pendingPasswordCallback = null
    dispatch({ type: 'RESET' })
  }, [])

  const mode = currentMode.value
  const errorMessage = error.value
  const isPasswordModalVisible = showPasswordModal.value
  const passwordReasonValue = passwordReason.value

  return (
    <div class="app-main">
      {/* Password modal overlay */}
      {isPasswordModalVisible && (
        <PasswordModal
          reason={passwordReasonValue}
          onSubmit={handlePasswordSubmit}
          onCancel={handlePasswordCancel}
        />
      )}
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
      </div>
    </div>
  )
}
