// src/components/PreviewScreen.tsx
// Main preview/review screen layout: left sidebar (240px) + document area.
// Sidebar contains SummaryPanel (mode tabs, entity list, callout, legend) + PageNav thumbnails.
// Document area contains the DocumentViewer (canvas + SVG overlay + tooltip).
// Keyboard shortcuts: Tab (next uncertain), R (redact), K (keep).
// Jump button: 'Go to next unresolved ↓' in action bar.

import { useEffect, useCallback } from 'preact/hooks'
import { DocumentViewer } from './DocumentViewer'
import { SummaryPanel } from './SummaryPanel'
import { DocToolbar, PageNav } from './PageNav'
import { FooterBar } from './FooterBar'
import { handleKeyboardShortcut, focusNextUncertain } from './KeyboardNav'
import { uncertainCount } from '../app/state'

/**
 * Preview/review screen component.
 * Renders a two-column layout:
 * - Left sidebar (240px): SummaryPanel + PageNav thumbnails
 * - Document area: DocToolbar + note bar + DocumentViewer
 * Plus keyboard shortcut handler and jump button.
 */
export function PreviewScreen() {
  const uncertain = uncertainCount.value

  // ─── Keyboard shortcuts ─────────────────────────────────────────

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept if user is typing in an input/textarea
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return

    if (e.key === 'Tab') {
      e.preventDefault()
      handleKeyboardShortcut('Tab')
    } else if (e.key === 'r' || e.key === 'R') {
      handleKeyboardShortcut('r')
    } else if (e.key === 'k' || e.key === 'K') {
      handleKeyboardShortcut('k')
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ─── Jump button handler ────────────────────────────────────────

  const handleJump = useCallback(() => {
    focusNextUncertain()
  }, [])

  return (
    <div class="preview-layout">
      {/* Sidebar with summary panel + page thumbnails */}
      <aside class="preview-sidebar">
        <SummaryPanel />
        <PageNav />
      </aside>

      {/* Document area */}
      <div class="preview-content">
        {/* Document toolbar with page navigation */}
        <div class="doc-bar">
          <DocToolbar />
        </div>

        {/* Note bar — output transformation explanation */}
        <div class="note-bar">
          <span class="note-bar-swatch note-bar-swatch--preview" />
          Preview
          <span style={{ margin: '0 4px', color: 'var(--300)' }}>→</span>
          <span class="note-bar-swatch note-bar-swatch--output" />
          Downloaded PDF
          <span style={{ margin: '0 6px', color: 'var(--300)' }}>·</span>
          In your downloaded PDF, highlights become permanent black bars. The original text is destroyed.
        </div>

        {/* Document viewer with canvas + SVG overlay */}
        <DocumentViewer />

        {/* Footer bar with start over, counts, jump, and download */}
        <FooterBar />

        {/* Jump button overlay — shown only when uncertain entities exist */}
        {uncertain > 0 && (
          <div class="jump-bar">
            <button
              class="btn-jump"
              onClick={handleJump}
              type="button"
            >
              Go to next unresolved ↓
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
