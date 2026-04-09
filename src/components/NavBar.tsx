// src/components/NavBar.tsx
// Shared navigation bar rendered on every screen.
// Left: logo mark + wordmark. Center/Right: varies by screen state.

import { appState, currentFile, currentPage, totalPages } from '../app/state'

/**
 * Shared navigation bar component.
 * Appears on every screen with contextual right-side content:
 * - Drop screen (IDLE/ERROR): version pill
 * - Preview screen (NEEDS_REVIEW): centered filename + page indicator
 * - Processing/Done: nothing on right
 */
export function NavBar() {
  const state = appState.value
  const file = currentFile.value
  const page = currentPage.value
  const total = totalPages.value

  const isPreview = state === 'NEEDS_REVIEW'
  const isDrop = state === 'IDLE' || state === 'ERROR'

  return (
    <nav class="app-nav" role="navigation" aria-label="Main">
      <a class="logo" href="/">
        {/* Logo mark — inline SVG document icon with redaction bar */}
        <svg class="mark" viewBox="0 0 20 26" fill="none" aria-hidden="true">
          <rect
            x="0.75" y="0.75" width="18.5" height="24.5" rx="2"
            fill="white" stroke="#D8D3CB" stroke-width="1.5"
          />
          <path
            d="M13.5 0.75 V6.25 H19" fill="#EDEAE4"
            stroke="#D8D3CB" stroke-width="1.5" stroke-linejoin="round"
          />
          <rect x="3.5" y="3" width="7" height="1.5" rx="0.75" fill="#D8D3CB" />
          <rect x="3.5" y="6.5" width="10" height="1.5" rx="0.75" fill="#D8D3CB" />
          <rect x="0.75" y="11" width="18.5" height="5.5" fill="#1C1812" />
          <rect x="3.5" y="19.5" width="9" height="1.5" rx="0.75" fill="#D8D3CB" />
          <rect x="3.5" y="22.5" width="6" height="1.5" rx="0.75" fill="#D8D3CB" />
        </svg>
        <span class="wordmark">
          local<span class="wordmark-redact">redact</span>
        </span>
      </a>

      {/* Center: filename + page indicator (preview screen only) */}
      {isPreview && file && (
        <div class="nav-file">
          <span class="nav-filename">{file.name}</span>
          <span class="nav-pages">p. {page} / {total}</span>
        </div>
      )}

      {/* Right side */}
      <div class="nav-end">
        {isDrop && <span class="nav-pill">v1.0</span>}
      </div>
    </nav>
  )
}
