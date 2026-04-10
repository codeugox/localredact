// src/components/DoneScreen.tsx
// Done screen shown after redaction is complete and PDF has been downloaded.
// Shows output filename, privacy message, and "Redact another document" button.

import { useCallback } from 'preact/hooks'
import { dispatch, currentFile, dpiFallbackWarning } from '../app/state'
import { getOutputFilename } from '../utils/filename'

/**
 * DoneScreen component — displayed after successful redaction and download.
 * Shows the output filename, a privacy reassurance message, and a button
 * to start over with a new document.
 */
export function DoneScreen() {
  const file = currentFile.value
  const outputName = file
    ? getOutputFilename(file.name)
    : 'document-redacted.pdf'
  const fallbackWarning = dpiFallbackWarning.value

  const handleStartOver = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return (
    <div class="app-main">
      <div class="container-sm anim-rise">
        <div class="done-screen">
          {/* Success icon */}
          <div class="done-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="var(--green)" stroke-width="2.5" />
              <path
                d="M15 24.5 L21 30.5 L33 18.5"
                stroke="var(--green)"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>

          {/* Heading */}
          <h2 class="done-heading">Redaction complete</h2>

          {/* Output filename */}
          <p class="done-filename">{outputName}</p>

          {/* DPI fallback warning */}
          {fallbackWarning && (
            <p class="done-warning" role="alert">
              {fallbackWarning}
            </p>
          )}

          {/* Privacy message */}
          <p class="done-privacy">
            Your document was processed entirely on your device.
            No data was sent to any server.
          </p>

          {/* Start over button */}
          <button
            class="btn-start-over"
            onClick={handleStartOver}
            type="button"
          >
            Redact another document
          </button>

          {/* Footer links */}
          <div class="drop-footer" style={{ marginTop: '24px' }}>
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
          </div>
        </div>
      </div>
    </div>
  )
}
