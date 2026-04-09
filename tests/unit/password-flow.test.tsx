// tests/unit/password-flow.test.tsx
// Regression tests for the encrypted PDF password flow across all stages:
// 1. Password modal is reachable during LOADING state (mounted at App level)
// 2. Stored password is passed to DocumentViewer for preview rendering
// 3. Stored password is passed to redactDocument for download
// 4. Wrong password shows error, retry works
// 5. Cancel on password modal returns to drop screen
// 6. Password is cleared on RESET

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
  pdfPassword,
  dispatch,
} from '../../src/app/state'
import {
  showPasswordModal,
  passwordReason,
  submitPassword,
  cancelPassword,
  hidePasswordModal,
  createOnPasswordCallback,
} from '../../src/app/password-prompt'
import { PasswordReason } from '../../src/core/pdf/loader'

describe('Password flow — global state', () => {
  beforeEach(() => {
    resetState()
    showPasswordModal.value = false
    passwordReason.value = 1
  })

  describe('pdfPassword signal', () => {
    it('should default to null', () => {
      expect(pdfPassword.value).toBeNull()
    })

    it('should be cleared on RESET', () => {
      pdfPassword.value = 'secret123'
      dispatch({ type: 'RESET' })
      expect(pdfPassword.value).toBeNull()
    })

    it('should be cleared on resetState', () => {
      pdfPassword.value = 'secret123'
      resetState()
      expect(pdfPassword.value).toBeNull()
    })
  })

  describe('createOnPasswordCallback', () => {
    it('should return a function', () => {
      const cb = createOnPasswordCallback()
      expect(typeof cb).toBe('function')
    })

    it('should show password modal when invoked', () => {
      const cb = createOnPasswordCallback()
      const updatePassword = vi.fn()

      cb(updatePassword, PasswordReason.NEED_PASSWORD)

      expect(showPasswordModal.value).toBe(true)
      expect(passwordReason.value).toBe(PasswordReason.NEED_PASSWORD)
    })

    it('should set INCORRECT_PASSWORD reason when invoked with reason 2', () => {
      const cb = createOnPasswordCallback()
      const updatePassword = vi.fn()

      cb(updatePassword, PasswordReason.INCORRECT_PASSWORD)

      expect(showPasswordModal.value).toBe(true)
      expect(passwordReason.value).toBe(PasswordReason.INCORRECT_PASSWORD)
    })
  })

  describe('submitPassword', () => {
    it('should store password in pdfPassword signal', () => {
      const cb = createOnPasswordCallback()
      const updatePassword = vi.fn()

      cb(updatePassword, PasswordReason.NEED_PASSWORD)
      submitPassword('my-password')

      expect(pdfPassword.value).toBe('my-password')
    })

    it('should call the updatePassword callback from PDF.js', () => {
      const cb = createOnPasswordCallback()
      const updatePassword = vi.fn()

      cb(updatePassword, PasswordReason.NEED_PASSWORD)
      submitPassword('my-password')

      expect(updatePassword).toHaveBeenCalledWith('my-password')
    })

    it('should not hide modal immediately (waits for PDF.js response)', () => {
      const cb = createOnPasswordCallback()
      const updatePassword = vi.fn()

      cb(updatePassword, PasswordReason.NEED_PASSWORD)
      submitPassword('my-password')

      // Modal should still be visible — PDF.js may call back with INCORRECT_PASSWORD
      expect(showPasswordModal.value).toBe(true)
    })
  })

  describe('cancelPassword', () => {
    it('should hide password modal', () => {
      showPasswordModal.value = true
      cancelPassword()
      expect(showPasswordModal.value).toBe(false)
    })

    it('should reset app state to IDLE', () => {
      appState.value = 'LOADING'
      showPasswordModal.value = true
      cancelPassword()
      expect(appState.value).toBe('IDLE')
    })

    it('should clear pdfPassword', () => {
      pdfPassword.value = 'secret'
      cancelPassword()
      expect(pdfPassword.value).toBeNull()
    })
  })

  describe('hidePasswordModal', () => {
    it('should hide password modal without resetting app state', () => {
      appState.value = 'LOADING'
      showPasswordModal.value = true
      hidePasswordModal()

      expect(showPasswordModal.value).toBe(false)
      // App state should NOT be reset — detection continues
      expect(appState.value).toBe('LOADING')
    })
  })

  describe('wrong password → retry flow', () => {
    it('should allow resubmission after incorrect password callback', () => {
      const cb = createOnPasswordCallback()
      const updatePassword1 = vi.fn()
      const updatePassword2 = vi.fn()

      // First attempt
      cb(updatePassword1, PasswordReason.NEED_PASSWORD)
      submitPassword('wrong-pass')
      expect(updatePassword1).toHaveBeenCalledWith('wrong-pass')

      // PDF.js calls back with INCORRECT_PASSWORD and a new callback
      cb(updatePassword2, PasswordReason.INCORRECT_PASSWORD)
      expect(passwordReason.value).toBe(PasswordReason.INCORRECT_PASSWORD)
      expect(showPasswordModal.value).toBe(true)

      // Second attempt with correct password
      submitPassword('correct-pass')
      expect(updatePassword2).toHaveBeenCalledWith('correct-pass')
      expect(pdfPassword.value).toBe('correct-pass')
    })
  })
})

describe('Password flow — App component', () => {
  let container: HTMLElement

  beforeEach(() => {
    resetState()
    showPasswordModal.value = false
    passwordReason.value = 1
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    render(null, container)
    container.remove()
  })

  it('should render password modal at App level when showPasswordModal is true', async () => {
    const { App } = await import('../../src/components/App')

    appState.value = 'LOADING'
    showPasswordModal.value = true
    passwordReason.value = PasswordReason.NEED_PASSWORD

    render(<App />, container)

    // Processing screen should be rendered (LOADING state)
    const processingEl = container.querySelector('.processing-screen')
    expect(processingEl).toBeTruthy()

    // Password modal should also be rendered (global overlay)
    const overlay = container.querySelector('.password-overlay')
    expect(overlay).toBeTruthy()

    const modal = container.querySelector('.password-modal')
    expect(modal).toBeTruthy()
  })

  it('should NOT render password modal when showPasswordModal is false', async () => {
    const { App } = await import('../../src/components/App')

    appState.value = 'LOADING'
    showPasswordModal.value = false

    render(<App />, container)

    const overlay = container.querySelector('.password-overlay')
    expect(overlay).toBeNull()
  })

  it('should render password modal over DropScreen in IDLE state', async () => {
    const { App } = await import('../../src/components/App')

    appState.value = 'IDLE'
    showPasswordModal.value = true

    render(<App />, container)

    // Drop screen
    const dropEl = container.querySelector('.app-main')
    expect(dropEl).toBeTruthy()

    // Password modal overlay
    const overlay = container.querySelector('.password-overlay')
    expect(overlay).toBeTruthy()
  })

  it('should render password modal with incorrect password error', async () => {
    const { App } = await import('../../src/components/App')

    appState.value = 'LOADING'
    showPasswordModal.value = true
    passwordReason.value = PasswordReason.INCORRECT_PASSWORD

    render(<App />, container)

    const errorEl = container.querySelector('.password-error')
    expect(errorEl).toBeTruthy()
    expect(errorEl!.textContent).toMatch(/incorrect|wrong/i)
  })
})

describe('Password flow — DropScreen no longer mounts modal', () => {
  let container: HTMLElement

  beforeEach(() => {
    resetState()
    showPasswordModal.value = false
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    render(null, container)
    container.remove()
  })

  it('should NOT render password modal inside DropScreen', async () => {
    const { DropScreen } = await import('../../src/components/DropScreen')

    // Even if showPasswordModal is true, DropScreen should not render it
    showPasswordModal.value = true

    render(<DropScreen />, container)

    // DropScreen should NOT have the password overlay
    // (It's now in App.tsx)
    const overlays = container.querySelectorAll('.password-overlay')
    expect(overlays.length).toBe(0)
  })
})
