// src/components/PreviewScreen.tsx
// Main preview/review screen layout: left sidebar (240px) + document area.
// For now, the sidebar is a placeholder — sidebar content comes in next features.
// The document area contains the DocumentViewer (canvas + SVG overlay).

import { DocumentViewer } from './DocumentViewer'

/**
 * Preview/review screen component.
 * Renders a two-column layout:
 * - Left sidebar (240px): placeholder for SummaryPanel (next feature)
 * - Document area: DocumentViewer with PDF canvas and highlight overlay
 */
export function PreviewScreen() {
  return (
    <div class="preview-layout">
      {/* Sidebar — placeholder for SummaryPanel, PageNav, etc. */}
      <aside class="preview-sidebar">
        {/* Sidebar content will be added by preview-sidebar-panel feature */}
      </aside>

      {/* Document area */}
      <div class="preview-content">
        {/* Document toolbar placeholder */}
        <div class="doc-bar">
          {/* Page navigation will be added by preview-nav-tooltips-keyboard feature */}
        </div>

        {/* Note bar — output transformation explanation */}
        <div class="note-bar">
          <span class="note-bar-swatch note-bar-swatch--preview" />
          Preview
          <span style={{ margin: '0 4px', color: 'var(--300)' }}>→</span>
          <span class="note-bar-swatch note-bar-swatch--output" />
          Downloaded PDF
          <span style={{ margin: '0 6px', color: 'var(--300)' }}>·</span>
          Text stays visible here so you can verify. The downloaded file has
          permanent black bars — nothing recoverable.
        </div>

        {/* Document viewer with canvas + SVG overlay */}
        <DocumentViewer />
      </div>
    </div>
  )
}
