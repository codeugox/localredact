// src/components/PasswordModal.tsx
// Modal overlay prompted when PDF.js requests a password for an encrypted PDF.
// Input field, submit button, error message for wrong password.
// On submit, resolves the password promise back to the loader.
// Escape/cancel returns to drop screen.

import { useRef, useCallback } from 'preact/hooks'
import { useEffect } from 'preact/hooks'
import { PasswordReason } from '../core/pdf/loader'

interface PasswordModalProps {
  /** The reason code from PDF.js — NEED_PASSWORD (1) or INCORRECT_PASSWORD (2) */
  reason: number
  /** Called with the entered password when the user submits */
  onSubmit: (password: string) => void
  /** Called when the user cancels (Escape, cancel button, or overlay click) */
  onCancel: () => void
}

/**
 * Password modal component.
 * Displays an overlay with a password input field, submit and cancel buttons.
 * Shows an inline error when the reason is INCORRECT_PASSWORD.
 */
export function PasswordModal({ reason, onSubmit, onCancel }: PasswordModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef('')

  const isIncorrect = reason === PasswordReason.INCORRECT_PASSWORD

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle Escape key to cancel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleInput = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement
    passwordRef.current = input.value
  }, [])

  const handleSubmit = useCallback(
    (e: Event) => {
      e.preventDefault()
      const password = passwordRef.current.trim()
      if (password.length === 0) return
      onSubmit(password)
    },
    [onSubmit]
  )

  const handleOverlayClick = useCallback(
    (e: MouseEvent) => {
      // Only cancel when clicking the overlay itself, not the modal
      if ((e.target as HTMLElement).classList.contains('password-overlay')) {
        onCancel()
      }
    },
    [onCancel]
  )

  return (
    <div class="password-overlay" onClick={handleOverlayClick}>
      <div class="password-modal" onClick={(e) => e.stopPropagation()}>
        {/* Lock icon */}
        <div class="password-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="11"
              width="18"
              height="11"
              rx="2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M7 11V7a5 5 0 0110 0v4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <circle cx="12" cy="16.5" r="1.5" fill="currentColor" />
          </svg>
        </div>

        <h3 class="password-title">This PDF is password-protected</h3>
        <p class="password-desc">
          Enter the password to open and process this document.
        </p>

        {/* Error message for wrong password */}
        {isIncorrect && (
          <div class="password-error" role="alert">
            Incorrect password. Please try again.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            class="password-input"
            placeholder="Enter password"
            onInput={handleInput}
            autocomplete="off"
          />

          <div class="password-actions">
            <button
              type="button"
              class="password-cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button type="submit" class="password-submit">
              Unlock PDF
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
