// tests/unit/done-screen.test.tsx
// Tests for the DoneScreen component: output filename, privacy message,
// and "Redact another document" button.

import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'preact'
import { DoneScreen } from '../../src/components/DoneScreen'
import {
  appState,
  currentFile,
  resetState,
} from '../../src/app/state'

// ─── Helpers ─────────────────────────────────────────────────────

function renderDoneScreen() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  render(<DoneScreen />, container)
  return container
}

// ─── Setup ───────────────────────────────────────────────────────

beforeEach(() => {
  resetState()
  document.body.innerHTML = ''
})

// ─── Tests ───────────────────────────────────────────────────────

describe('DoneScreen', () => {
  describe('rendering', () => {
    it('should render the done screen container', () => {
      currentFile.value = new File(['test'], 'invoice.pdf', { type: 'application/pdf' })
      const container = renderDoneScreen()
      expect(container.querySelector('.done-screen')).toBeTruthy()
    })

    it('should show the output filename in the format [original]-redacted.pdf', () => {
      currentFile.value = new File(['test'], 'invoice.pdf', { type: 'application/pdf' })
      const container = renderDoneScreen()
      const filename = container.querySelector('.done-filename')
      expect(filename?.textContent).toContain('invoice-redacted.pdf')
    })

    it('should show the privacy message', () => {
      currentFile.value = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const container = renderDoneScreen()
      const text = container.textContent || ''
      expect(text).toContain('Your document was processed entirely on your device')
      expect(text).toContain('No data was sent to any server')
    })

    it('should show the "Redact another document" button', () => {
      currentFile.value = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const container = renderDoneScreen()
      const btn = container.querySelector('.btn-start-over') as HTMLButtonElement
      expect(btn).toBeTruthy()
      expect(btn.textContent).toContain('Redact another document')
    })
  })

  describe('start over action', () => {
    it('should dispatch RESET when "Redact another document" is clicked', () => {
      appState.value = 'DONE'
      currentFile.value = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      const container = renderDoneScreen()
      const btn = container.querySelector('.btn-start-over') as HTMLButtonElement
      btn.click()

      expect(appState.value).toBe('IDLE')
    })
  })

  describe('filename generation', () => {
    it('should handle filename with spaces', () => {
      currentFile.value = new File(['test'], 'my document.pdf', { type: 'application/pdf' })
      const container = renderDoneScreen()
      const filename = container.querySelector('.done-filename')
      expect(filename?.textContent).toContain('my document-redacted.pdf')
    })

    it('should handle filename with no .pdf extension', () => {
      currentFile.value = new File(['test'], 'report', { type: 'application/pdf' })
      const container = renderDoneScreen()
      const filename = container.querySelector('.done-filename')
      expect(filename?.textContent).toContain('report-redacted.pdf')
    })

    it('should fallback to "document-redacted.pdf" when no file is set', () => {
      currentFile.value = null
      const container = renderDoneScreen()
      const filename = container.querySelector('.done-filename')
      expect(filename?.textContent).toContain('document-redacted.pdf')
    })
  })
})
