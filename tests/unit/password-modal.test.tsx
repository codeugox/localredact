// tests/unit/password-modal.test.tsx
// Tests for PasswordModal component: renders input, submit triggers callback,
// wrong password shows error, escape/cancel returns to drop screen.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'preact'

// Mock pdfjs-dist to avoid DOMMatrix dependency in jsdom.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

import { resetState, appState } from '../../src/app/state'
import { PasswordReason } from '../../src/core/pdf/loader'

describe('PasswordModal', () => {
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

  // Helper to import and render PasswordModal
  async function renderPasswordModal(props?: {
    reason?: number
    onSubmit?: (password: string) => void
    onCancel?: () => void
  }) {
    const { PasswordModal } = await import(
      '../../src/components/PasswordModal'
    )
    const defaultProps = {
      reason: props?.reason ?? PasswordReason.NEED_PASSWORD,
      onSubmit: props?.onSubmit ?? vi.fn(),
      onCancel: props?.onCancel ?? vi.fn(),
    }
    render(<PasswordModal {...defaultProps} />, container)
  }

  // ─── Rendering ──────────────────────────────────────────────────

  describe('renders password modal', () => {
    it('should render a modal overlay', async () => {
      await renderPasswordModal()

      const overlay = container.querySelector('.password-overlay')
      expect(overlay).toBeTruthy()
    })

    it('should render a modal dialog', async () => {
      await renderPasswordModal()

      const dialog = container.querySelector('.password-modal')
      expect(dialog).toBeTruthy()
    })

    it('should render a password input field', async () => {
      await renderPasswordModal()

      const input = container.querySelector(
        'input[type="password"]'
      ) as HTMLInputElement
      expect(input).toBeTruthy()
    })

    it('should render a submit button', async () => {
      await renderPasswordModal()

      const button = container.querySelector(
        '.password-submit'
      ) as HTMLButtonElement
      expect(button).toBeTruthy()
      expect(button.textContent).toMatch(/unlock|submit|open/i)
    })

    it('should render a cancel button', async () => {
      await renderPasswordModal()

      const button = container.querySelector(
        '.password-cancel'
      ) as HTMLButtonElement
      expect(button).toBeTruthy()
    })

    it('should show prompt text for initial password request', async () => {
      await renderPasswordModal({ reason: PasswordReason.NEED_PASSWORD })

      const modal = container.querySelector('.password-modal')
      expect(modal!.textContent).toMatch(/password|protected|encrypted/i)
    })
  })

  // ─── Wrong password error ─────────────────────────────────────

  describe('wrong password error', () => {
    it('should show error message when reason is INCORRECT_PASSWORD', async () => {
      await renderPasswordModal({
        reason: PasswordReason.INCORRECT_PASSWORD,
      })

      const errorEl = container.querySelector('.password-error')
      expect(errorEl).toBeTruthy()
      expect(errorEl!.textContent).toMatch(/incorrect|wrong|invalid/i)
    })

    it('should NOT show error message for initial password request', async () => {
      await renderPasswordModal({ reason: PasswordReason.NEED_PASSWORD })

      const errorEl = container.querySelector('.password-error')
      expect(errorEl).toBeNull()
    })
  })

  // ─── Submit handler ───────────────────────────────────────────

  describe('submit triggers callback', () => {
    it('should call onSubmit with entered password when submit button is clicked', async () => {
      const onSubmit = vi.fn()
      await renderPasswordModal({ onSubmit })

      const input = container.querySelector(
        'input[type="password"]'
      ) as HTMLInputElement
      // Simulate typing
      input.value = 'test-password'
      input.dispatchEvent(new Event('input', { bubbles: true }))

      const submitBtn = container.querySelector(
        '.password-submit'
      ) as HTMLButtonElement
      submitBtn.click()

      expect(onSubmit).toHaveBeenCalledWith('test-password')
    })

    it('should call onSubmit when form is submitted via Enter key', async () => {
      const onSubmit = vi.fn()
      await renderPasswordModal({ onSubmit })

      const input = container.querySelector(
        'input[type="password"]'
      ) as HTMLInputElement
      input.value = 'enter-password'
      input.dispatchEvent(new Event('input', { bubbles: true }))

      // Submit form via Enter key on input
      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      form!.dispatchEvent(new Event('submit', { bubbles: true }))

      expect(onSubmit).toHaveBeenCalledWith('enter-password')
    })

    it('should not call onSubmit when password is empty', async () => {
      const onSubmit = vi.fn()
      await renderPasswordModal({ onSubmit })

      const submitBtn = container.querySelector(
        '.password-submit'
      ) as HTMLButtonElement
      submitBtn.click()

      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  // ─── Cancel handler ───────────────────────────────────────────

  describe('cancel returns to drop screen', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const onCancel = vi.fn()
      await renderPasswordModal({ onCancel })

      const cancelBtn = container.querySelector(
        '.password-cancel'
      ) as HTMLButtonElement
      cancelBtn.click()

      expect(onCancel).toHaveBeenCalled()
    })

    it('should call onCancel when Escape key is pressed', async () => {
      const onCancel = vi.fn()
      await renderPasswordModal({ onCancel })

      // Wait for useEffect to register the event listener
      await new Promise((r) => setTimeout(r, 10))

      // Simulate Escape key press
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )

      expect(onCancel).toHaveBeenCalled()
    })

    it('should call onCancel when overlay backdrop is clicked', async () => {
      const onCancel = vi.fn()
      await renderPasswordModal({ onCancel })

      const overlay = container.querySelector(
        '.password-overlay'
      ) as HTMLElement
      // Click on the overlay itself (not the modal)
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(onCancel).toHaveBeenCalled()
    })

    it('should NOT call onCancel when modal content is clicked', async () => {
      const onCancel = vi.fn()
      await renderPasswordModal({ onCancel })

      const modal = container.querySelector('.password-modal') as HTMLElement
      modal.click()

      // onCancel should not have been called because the click was on the modal,
      // not the overlay
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  // ─── Input focus ──────────────────────────────────────────────

  describe('input behavior', () => {
    it('should clear input value when re-rendered with incorrect password', async () => {
      const { PasswordModal } = await import(
        '../../src/components/PasswordModal'
      )
      const onSubmit = vi.fn()
      const onCancel = vi.fn()

      // First render with NEED_PASSWORD
      render(
        <PasswordModal
          reason={PasswordReason.NEED_PASSWORD}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />,
        container
      )

      const input = container.querySelector(
        'input[type="password"]'
      ) as HTMLInputElement
      input.value = 'wrong-pass'
      input.dispatchEvent(new Event('input', { bubbles: true }))

      // Re-render with INCORRECT_PASSWORD (simulating wrong password)
      render(
        <PasswordModal
          reason={PasswordReason.INCORRECT_PASSWORD}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />,
        container
      )

      // Error should be shown
      const errorEl = container.querySelector('.password-error')
      expect(errorEl).toBeTruthy()
    })
  })
})
