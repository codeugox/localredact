// src/components/ProcessingScreen.tsx
// Processing screen displayed during LOADING (detection) and PROCESSING
// (redaction) states. Shows page-by-page progress with different header
// text depending on the current phase.

import { appState, processingProgress } from '../app/state'

/**
 * Processing screen component.
 * Displays during detection (LOADING) and redaction (PROCESSING) phases.
 * Shows a spinner, phase-appropriate header, page progress text, and
 * a progress bar reflecting current page / total pages.
 */
export function ProcessingScreen() {
  const state = appState.value
  const { page, total } = processingProgress.value

  const isDetecting = state === 'LOADING'
  const headerText = isDetecting ? 'Detecting PII…' : 'Redacting document…'
  const subText = isDetecting
    ? 'Scanning your document for sensitive information.'
    : 'Burning redactions into your document.'

  // Progress percentage: 0% when page is 0 or total is 0
  const percent = total > 0 ? Math.round((page / total) * 100) : 0

  return (
    <div class="app-main">
      <div class="container-sm anim-rise">
        <div class="processing-screen">
          {/* Spinner */}
          <div class="processing-spinner" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <circle
                cx="20"
                cy="20"
                r="17"
                stroke="var(--150)"
                stroke-width="3"
              />
              <path
                d="M20 3 A17 17 0 0 1 37 20"
                stroke="var(--red)"
                stroke-width="3"
                stroke-linecap="round"
              />
            </svg>
          </div>

          {/* Header text */}
          <h2 class="processing-header">{headerText}</h2>
          <p class="processing-sub">{subText}</p>

          {/* Progress bar */}
          <div class="processing-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div
              class="processing-bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Page progress text */}
          <p class="processing-progress">
            {total > 0
              ? `Processing page ${page} of ${total}`
              : 'Preparing…'}
          </p>
        </div>
      </div>
    </div>
  )
}
