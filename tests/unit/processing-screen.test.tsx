// tests/unit/processing-screen.test.tsx
// Tests for ProcessingScreen component: renders progress during detection
// and redaction phases with correct header text and page-by-page progress.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'preact'

// Mock pdfjs-dist to avoid DOMMatrix dependency in jsdom.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

import {
  resetState,
  appState,
  processingProgress,
} from '../../src/app/state'

describe('ProcessingScreen', () => {
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

  // Helper to import and render ProcessingScreen
  async function renderProcessingScreen() {
    const { ProcessingScreen } = await import(
      '../../src/components/ProcessingScreen'
    )
    render(<ProcessingScreen />, container)
  }

  // Helper to render App in a given state
  async function renderApp() {
    const { App } = await import('../../src/components/App')
    render(<App />, container)
  }

  // ─── Rendering ──────────────────────────────────────────────────

  describe('renders processing screen', () => {
    it('should render a processing screen container', async () => {
      appState.value = 'LOADING'
      await renderProcessingScreen()

      const screen = container.querySelector('.processing-screen')
      expect(screen).toBeTruthy()
    })

    it('should show a spinner/loading indicator', async () => {
      appState.value = 'LOADING'
      await renderProcessingScreen()

      const spinner = container.querySelector('.processing-spinner')
      expect(spinner).toBeTruthy()
    })
  })

  // ─── Detection phase (LOADING state) ─────────────────────────────

  describe('detection phase (LOADING)', () => {
    it('should show "Detecting" header text during LOADING state', async () => {
      appState.value = 'LOADING'
      processingProgress.value = { page: 1, total: 3 }
      await renderProcessingScreen()

      const header = container.querySelector('.processing-header')
      expect(header).toBeTruthy()
      expect(header!.textContent).toMatch(/detect/i)
    })

    it('should show page progress "Processing page X of Y"', async () => {
      appState.value = 'LOADING'
      processingProgress.value = { page: 2, total: 5 }
      await renderProcessingScreen()

      const progress = container.querySelector('.processing-progress')
      expect(progress).toBeTruthy()
      expect(progress!.textContent).toContain('2')
      expect(progress!.textContent).toContain('5')
    })

    it('should update progress when signal changes', async () => {
      appState.value = 'LOADING'
      processingProgress.value = { page: 1, total: 3 }
      await renderProcessingScreen()

      let progress = container.querySelector('.processing-progress')
      expect(progress!.textContent).toContain('1')
      expect(progress!.textContent).toContain('3')

      // Update progress
      processingProgress.value = { page: 3, total: 3 }
      // Re-render to pick up signal change
      await renderProcessingScreen()

      progress = container.querySelector('.processing-progress')
      expect(progress!.textContent).toContain('3')
    })
  })

  // ─── Redaction phase (PROCESSING state) ────────────────────────

  describe('redaction phase (PROCESSING)', () => {
    it('should show "Redacting" header text during PROCESSING state', async () => {
      appState.value = 'PROCESSING'
      processingProgress.value = { page: 1, total: 3 }
      await renderProcessingScreen()

      const header = container.querySelector('.processing-header')
      expect(header).toBeTruthy()
      expect(header!.textContent).toMatch(/redact/i)
    })

    it('should show page progress during redaction', async () => {
      appState.value = 'PROCESSING'
      processingProgress.value = { page: 3, total: 5 }
      await renderProcessingScreen()

      const progress = container.querySelector('.processing-progress')
      expect(progress).toBeTruthy()
      expect(progress!.textContent).toContain('3')
      expect(progress!.textContent).toContain('5')
    })
  })

  // ─── Progress bar ──────────────────────────────────────────────

  describe('progress bar', () => {
    it('should render a progress bar element', async () => {
      appState.value = 'LOADING'
      processingProgress.value = { page: 2, total: 4 }
      await renderProcessingScreen()

      const bar = container.querySelector('.processing-bar')
      expect(bar).toBeTruthy()
    })

    it('should have a progress bar fill that reflects progress', async () => {
      appState.value = 'LOADING'
      processingProgress.value = { page: 2, total: 4 }
      await renderProcessingScreen()

      const fill = container.querySelector('.processing-bar-fill') as HTMLElement
      expect(fill).toBeTruthy()
      // 2/4 = 50%
      expect(fill.style.width).toBe('50%')
    })

    it('should show 0% when page is 0', async () => {
      appState.value = 'LOADING'
      processingProgress.value = { page: 0, total: 0 }
      await renderProcessingScreen()

      const fill = container.querySelector('.processing-bar-fill') as HTMLElement
      expect(fill).toBeTruthy()
      expect(fill.style.width).toBe('0%')
    })
  })

  // ─── App routing ──────────────────────────────────────────────

  describe('App routes to ProcessingScreen', () => {
    it('should render ProcessingScreen when appState is LOADING', async () => {
      appState.value = 'LOADING'
      processingProgress.value = { page: 1, total: 2 }
      await renderApp()

      const screen = container.querySelector('.processing-screen')
      expect(screen).toBeTruthy()
    })

    it('should render ProcessingScreen when appState is PROCESSING', async () => {
      appState.value = 'PROCESSING'
      processingProgress.value = { page: 1, total: 2 }
      await renderApp()

      const screen = container.querySelector('.processing-screen')
      expect(screen).toBeTruthy()
    })
  })
})
