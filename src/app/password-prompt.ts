// src/app/password-prompt.ts
// Global password prompt state — signals and resolver for the PasswordModal.
// Mounted at App.tsx level so the modal is visible regardless of app state.
// Used by DropScreen detection flow to request a password from the user.

import { signal } from '@preact/signals'
import { dispatch, pdfPassword } from './state'

/** Whether the password modal is currently visible */
export const showPasswordModal = signal(false)

/** The reason code from PDF.js (1 = need password, 2 = incorrect) */
export const passwordReason = signal<number>(1)

/** Stored reference to the PDF.js updatePassword callback */
let pendingPasswordCallback: ((password: string) => void) | null = null

/**
 * Create an onPassword callback for use with loadPDF / detectDocument.
 * When invoked by PDF.js, this shows the global password modal and stores
 * the updatePassword callback so the modal can resolve it.
 *
 * Uses `reason: number` to match the detectDocument onPassword signature.
 */
export function createOnPasswordCallback(): (
  updatePassword: (password: string) => void,
  reason: number
) => void {
  return (updatePassword, reason) => {
    pendingPasswordCallback = updatePassword
    passwordReason.value = reason
    showPasswordModal.value = true
  }
}

/**
 * Called when the user submits a password in the modal.
 * Forwards it to PDF.js via the stored callback.
 * Also stores the password in global state for reuse by
 * DocumentViewer and redactDocument.
 */
export function submitPassword(password: string): void {
  if (pendingPasswordCallback) {
    // Store the password for reuse in preview and download
    pdfPassword.value = password
    pendingPasswordCallback(password)
    // Don't hide the modal yet — if the password is wrong,
    // onPassword will be called again with INCORRECT_PASSWORD reason.
    // If correct, the detection pipeline will continue and we hide
    // the modal when detection completes.
  }
}

/**
 * Called when the user cancels the password modal.
 * Resets modal state and dispatches RESET to return to drop screen.
 */
export function cancelPassword(): void {
  showPasswordModal.value = false
  pendingPasswordCallback = null
  pdfPassword.value = null
  dispatch({ type: 'RESET' })
}

/**
 * Hide the password modal. Called when detection completes successfully
 * (the password was accepted).
 */
export function hidePasswordModal(): void {
  showPasswordModal.value = false
  pendingPasswordCallback = null
}
