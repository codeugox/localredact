// src/core/pdf/loader.ts
// PDF loading module: file validation, PDF.js document loading, and cleanup.

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Configure PDF.js web worker for pdfjs-dist 5.x.
// The worker file is copied to public/ by a Vite plugin (see vite.config.ts)
// so it is served as a raw static file without Vite transforms. This avoids
// Safari failures with `new Worker(url, { type: "module" })` and HMR injection.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  './pdf.worker.min.mjs',
  window.location.href
).toString()

/** Maximum allowed file size: 50 MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024

/** Password callback reason codes from PDF.js */
export const PasswordReason = {
  NEED_PASSWORD: 1,
  INCORRECT_PASSWORD: 2,
} as const

export type PasswordReasonType = (typeof PasswordReason)[keyof typeof PasswordReason]

/**
 * Callback invoked when a PDF requires a password.
 * @param updatePassword - Call with the password string to unlock the document.
 * @param reason - 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
 */
export type OnPasswordCallback = (
  updatePassword: (password: string) => void,
  reason: PasswordReasonType
) => void

/** Result from file validation. */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string }

/** Result from loadPDF. */
export interface LoadPDFResult {
  pdf: PDFDocumentProxy
  numPages: number
}

/**
 * Validate a File before attempting to load it as a PDF.
 * Checks MIME type and file size constraints.
 */
export function validateFile(file: File): ValidationResult {
  if (file.size === 0) {
    return { valid: false, error: 'File is empty. Please select a valid PDF.' }
  }

  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Only PDF files are supported. Please select a valid PDF.' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds the 50 MB size limit. Please select a smaller PDF.`,
    }
  }

  return { valid: true }
}

/**
 * Read a File into an ArrayBuffer.
 * Uses File.arrayBuffer() when available, falling back to FileReader for
 * environments where arrayBuffer() is not implemented (e.g., jsdom).
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer()
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Load a PDF file using pdfjs-dist.
 *
 * Validates the file, reads it into an ArrayBuffer, creates a loading task,
 * and optionally wires up the onPassword callback for encrypted PDFs.
 *
 * @param file - The PDF File to load
 * @param onPassword - Optional callback for password-protected PDFs
 * @returns The loaded PDFDocumentProxy and page count
 * @throws Error if file validation fails or PDF.js cannot load the document
 */
export async function loadPDF(
  file: File,
  onPassword?: OnPasswordCallback
): Promise<LoadPDFResult> {
  const validation = validateFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const data = new Uint8Array(await readFileAsArrayBuffer(file))

  const loadingTask = pdfjsLib.getDocument({ data })

  if (onPassword) {
    loadingTask.onPassword = (
      updateCallback: (password: string) => void,
      reason: number
    ) => {
      onPassword(updateCallback, reason as PasswordReasonType)
    }
  }

  const pdf = await loadingTask.promise

  return {
    pdf,
    numPages: pdf.numPages,
  }
}

/**
 * Clean up and destroy a loaded PDF document.
 * Calls cleanup() first to release internal caches, then destroy() to
 * terminate the worker and release all resources.
 *
 * @param pdf - The PDFDocumentProxy to destroy
 */
export async function destroyPDF(pdf: PDFDocumentProxy): Promise<void> {
  await pdf.cleanup()
  await pdf.destroy()
}
