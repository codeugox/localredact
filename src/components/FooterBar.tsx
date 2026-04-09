// src/components/FooterBar.tsx
// Action bar (60px): '← Start over' ghost button, three live count chips
// (removing/keeping/uncertain), 'Local only' badge with green dot,
// download button. Download disabled while uncertainCount > 0.
// Clicking enabled download dispatches REDACTION_START → calls redactDocument
// → shows ProcessingScreen with progress → triggers browser download → DONE.

import { useCallback } from 'preact/hooks'
import {
  dispatch,
  currentFile,
  entities,
  redactCount,
  keepCount,
  uncertainCount,
  pdfPassword,
} from '../app/state'
import { getOutputFilename } from '../utils/filename'

/**
 * Trigger the redaction pipeline and browser download.
 * Called when the user clicks the enabled download button.
 */
async function handleDownload(): Promise<void> {
  const file = currentFile.value
  if (!file) return

  dispatch({ type: 'REDACTION_START' })

  try {
    const { redactDocument } = await import('../core/pipeline/redact-document')

    // If we have a stored password from the detection phase,
    // pass it as an onPassword callback that auto-responds
    const storedPassword = pdfPassword.value
    const onPassword = storedPassword
      ? (updatePassword: (pw: string) => void) => {
          updatePassword(storedPassword)
        }
      : undefined

    const blob = await redactDocument(
      file,
      entities.value,
      (page, total) => {
        dispatch({ type: 'REDACTION_PROGRESS', page, total })
      },
      onPassword
    )

    // Trigger browser download via invisible <a> element
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getOutputFilename(file.name)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Revoke the object URL after a short delay to allow the download to start
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    dispatch({ type: 'REDACTION_COMPLETE' })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Redaction failed. Please try again.'
    dispatch({ type: 'ERROR', message })
  }
}

/**
 * FooterBar component — renders the action bar at the bottom of the
 * preview screen. Contains start over button, live count chips, local
 * badge, and download button.
 */
export function FooterBar() {
  const uncertain = uncertainCount.value
  const removing = redactCount.value
  const keeping = keepCount.value
  const isDisabled = uncertain > 0

  const handleStartOver = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const handleDownloadClick = useCallback(() => {
    if (!isDisabled) {
      handleDownload()
    }
  }, [isDisabled])

  return (
    <div class="action-bar">
      <div class="action-bar-left">
        {/* Start over ghost button */}
        <button class="btn-ghost" onClick={handleStartOver} type="button">
          ← Start over
        </button>

        {/* Live count chips */}
        <div class="count-chips">
          <span class="count-chip count-chip--redact">
            <span class="count-chip-dot count-chip-dot--redact" />
            {removing}
          </span>
          <span class="count-chip count-chip--keep">
            <span class="count-chip-dot count-chip-dot--keep" />
            {keeping}
          </span>
          <span class="count-chip count-chip--uncertain">
            <span class="count-chip-dot count-chip-dot--uncertain" />
            {uncertain}
          </span>
        </div>
      </div>

      <div class="action-bar-right">
        {/* Local only badge */}
        <span class="badge-local">
          <span class="badge-dot" />
          Local only
        </span>

        {/* Download button */}
        <button
          class="btn-download"
          disabled={isDisabled}
          onClick={handleDownloadClick}
          type="button"
          style={{
            opacity: isDisabled ? '0.28' : '1',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          Download redacted PDF
        </button>
      </div>
    </div>
  )
}
