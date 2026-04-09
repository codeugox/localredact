// tests/unit/drop-screen.test.ts
// Tests for DropScreen component: renders drop zone, file validation,
// mode selector toggling, error display and clearing.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'preact'

// Mock pdfjs-dist to avoid DOMMatrix dependency in jsdom.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

import { resetState, appState, currentMode, error, currentFile } from '../../src/app/state'

// We test through App since DropScreen is rendered when appState = IDLE
// But we also test DropScreen directly for unit coverage

describe('DropScreen', () => {
  let container: HTMLElement

  beforeEach(() => {
    resetState()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    render(null, container)
    container.remove()
  })

  // Helper to import and render DropScreen
  async function renderDropScreen() {
    const { DropScreen } = await import('../../src/components/DropScreen')
    render(<DropScreen />, container)
  }

  // Helper to import and render App
  async function renderApp() {
    const { App } = await import('../../src/components/App')
    render(<App />, container)
  }

  // ─── Drop zone rendering ─────────────────────────────────────────

  describe('renders drop zone', () => {
    it('should render the drop zone with icon, text, and browse link', async () => {
      await renderDropScreen()

      // Drop zone container
      const dropZone = container.querySelector('.drop')
      expect(dropZone).toBeTruthy()

      // Document icon (SVG)
      const icon = container.querySelector('.drop-icon')
      expect(icon).toBeTruthy()

      // "Drop a PDF here" label
      const label = container.querySelector('.drop-label')
      expect(label).toBeTruthy()
      expect(label!.textContent).toContain('Drop a PDF here')

      // "browse your files" link
      const browseLink = container.querySelector('.drop-hint a')
      expect(browseLink).toBeTruthy()
      expect(browseLink!.textContent).toContain('browse your files')

      // Spec badge (PDF · max 50 MB)
      const spec = container.querySelector('.drop-spec')
      expect(spec).toBeTruthy()
      expect(spec!.textContent).toMatch(/PDF.*50/i)
    })

    it('should have a hidden file input with accept=".pdf"', async () => {
      await renderDropScreen()

      const input = container.querySelector('input[type="file"]') as HTMLInputElement
      expect(input).toBeTruthy()
      expect(input.accept).toBe('.pdf')
      expect(input.style.display).toBe('none')
    })
  })

  // ─── File validation ──────────────────────────────────────────────

  describe('file validation rejects non-PDF', () => {
    it('should show error when a non-PDF file is dropped', async () => {
      await renderDropScreen()

      const dropZone = container.querySelector('.drop')!
      const file = new File(['hello'], 'test.txt', { type: 'text/plain' })

      // Create a mock drop event with dataTransfer (DataTransfer not available in jsdom)
      const dropEvent = new Event('drop', { bubbles: true }) as any
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [file] },
      })
      dropEvent.preventDefault = vi.fn()
      dropEvent.stopPropagation = vi.fn()
      dropZone.dispatchEvent(dropEvent)

      // Wait for state update
      await new Promise((r) => setTimeout(r, 10))

      // Error should be set in state
      expect(error.value).toBeTruthy()
      expect(error.value).toMatch(/PDF/i)

      // App should still be on drop screen (IDLE or ERROR)
      expect(['IDLE', 'ERROR']).toContain(appState.value)
    })
  })

  describe('file validation rejects >50MB', () => {
    it('should show error when a file exceeding 50MB is dropped', async () => {
      await renderDropScreen()

      const dropZone = container.querySelector('.drop')!

      // Create a mock file that claims to be > 50MB
      const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' })
      Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 })

      const dropEvent = new Event('drop', { bubbles: true }) as any
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [bigFile] },
      })
      dropEvent.preventDefault = vi.fn()
      dropEvent.stopPropagation = vi.fn()
      dropZone.dispatchEvent(dropEvent)

      await new Promise((r) => setTimeout(r, 10))

      expect(error.value).toBeTruthy()
      expect(error.value).toMatch(/50.*MB|size/i)
      expect(['IDLE', 'ERROR']).toContain(appState.value)
    })
  })

  // ─── Mode selector ───────────────────────────────────────────────

  describe('mode selector toggles', () => {
    it('should show two mode options with Identity only as default', async () => {
      await renderDropScreen()

      const modeButtons = container.querySelectorAll('.mode')
      expect(modeButtons.length).toBe(2)

      // Identity only should be active by default
      const identityMode = container.querySelector('.mode.active')
      expect(identityMode).toBeTruthy()
      expect(identityMode!.textContent).toContain('Identity only')
      expect(currentMode.value).toBe('IDENTITY_ONLY')
    })

    it('should toggle to Full redaction when clicked', async () => {
      await renderDropScreen()

      const modeButtons = container.querySelectorAll('.mode')
      const fullRedactionButton = modeButtons[1] as HTMLElement
      fullRedactionButton.click()

      await new Promise((r) => setTimeout(r, 10))

      expect(currentMode.value).toBe('FULL_REDACTION')
      expect(fullRedactionButton.classList.contains('active')).toBe(true)

      // Identity should no longer be active
      expect(modeButtons[0].classList.contains('active')).toBe(false)
    })

    it('should toggle back to Identity only when clicked', async () => {
      await renderDropScreen()

      const modeButtons = container.querySelectorAll('.mode')

      // Click Full first
      ;(modeButtons[1] as HTMLElement).click()
      await new Promise((r) => setTimeout(r, 10))
      expect(currentMode.value).toBe('FULL_REDACTION')

      // Click Identity back
      ;(modeButtons[0] as HTMLElement).click()
      await new Promise((r) => setTimeout(r, 10))
      expect(currentMode.value).toBe('IDENTITY_ONLY')
      expect(modeButtons[0].classList.contains('active')).toBe(true)
    })
  })

  // ─── Error display ────────────────────────────────────────────────

  describe('error display', () => {
    it('should display error message when error state is set', async () => {
      error.value = 'Only PDF files are supported.'
      appState.value = 'ERROR'
      await renderDropScreen()

      const errorEl = container.querySelector('.error-message')
      expect(errorEl).toBeTruthy()
      expect(errorEl!.textContent).toContain('Only PDF files are supported.')
    })

    it('should not display error when error is null', async () => {
      error.value = null
      await renderDropScreen()

      const errorEl = container.querySelector('.error-message')
      expect(errorEl).toBeNull()
    })
  })

  // ─── App routing ──────────────────────────────────────────────────

  describe('App routes to DropScreen when IDLE', () => {
    it('should render DropScreen when appState is IDLE', async () => {
      appState.value = 'IDLE'
      await renderApp()

      const dropZone = container.querySelector('.drop')
      expect(dropZone).toBeTruthy()
    })

    it('should render DropScreen with error when appState is ERROR', async () => {
      appState.value = 'ERROR'
      error.value = 'Something went wrong'
      await renderApp()

      const dropZone = container.querySelector('.drop')
      expect(dropZone).toBeTruthy()

      const errorEl = container.querySelector('.error-message')
      expect(errorEl).toBeTruthy()
    })
  })

  // ─── Trust statement ──────────────────────────────────────────────

  describe('trust statement', () => {
    it('should render the trust statement text', async () => {
      await renderDropScreen()

      const trust = container.querySelector('.trust')
      expect(trust).toBeTruthy()
      expect(trust!.textContent).toContain('Zero bytes transmitted')
    })
  })

  // ─── Click opens file picker ──────────────────────────────────────

  describe('click opens file picker', () => {
    it('should trigger file input click when drop zone is clicked', async () => {
      await renderDropScreen()

      const input = container.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(input, 'click')

      const dropZone = container.querySelector('.drop')!
      dropZone.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(clickSpy).toHaveBeenCalled()
    })
  })
})
