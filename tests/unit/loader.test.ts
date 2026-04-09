// tests/unit/loader.test.ts
// Unit tests for PDF loader module: file validation, function signatures, and
// destroyPDF behavior. Full PDF.js integration testing requires a browser environment.

import { describe, it, expect, vi } from 'vitest'

// Mock pdfjs-dist to avoid DOMMatrix dependency in jsdom.
// The module-level side effect (GlobalWorkerOptions.workerSrc) runs at import time,
// so we must mock before importing loader.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

import {
  validateFile,
  loadPDF,
  destroyPDF,
  MAX_FILE_SIZE,
  PasswordReason,
} from '@/core/pdf/loader'
import { getDocument } from 'pdfjs-dist'

describe('validateFile', () => {
  it('should accept a valid PDF file under 50MB', () => {
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })
    const result = validateFile(file)
    expect(result).toEqual({ valid: true })
  })

  it('should reject a non-PDF MIME type', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('PDF')
    }
  })

  it('should reject image/jpeg MIME type', () => {
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
  })

  it('should reject application/msword MIME type', () => {
    const file = new File(['fake'], 'doc.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
  })

  it('should reject a file exceeding 50MB', () => {
    const file = new File(['x'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('50')
    }
  })

  it('should accept a file at exactly 50MB', () => {
    const file = new File(['x'], 'edge.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 })
    const result = validateFile(file)
    expect(result).toEqual({ valid: true })
  })

  it('should reject a zero-byte PDF file', () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 0 })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
  })

  it('should reject a file with empty string MIME type', () => {
    const file = new File(['data'], 'noext', { type: '' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
  })
})

describe('MAX_FILE_SIZE', () => {
  it('should be 50MB in bytes', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024)
  })
})

describe('PasswordReason', () => {
  it('should have NEED_PASSWORD = 1', () => {
    expect(PasswordReason.NEED_PASSWORD).toBe(1)
  })

  it('should have INCORRECT_PASSWORD = 2', () => {
    expect(PasswordReason.INCORRECT_PASSWORD).toBe(2)
  })
})

describe('loadPDF', () => {
  it('should be a function', () => {
    expect(typeof loadPDF).toBe('function')
  })

  it('should accept a File and optional onPassword callback', () => {
    // loadPDF(file: File, onPassword?: OnPasswordCallback) — at least 1 param
    expect(loadPDF.length).toBeGreaterThanOrEqual(1)
  })

  it('should reject non-PDF file with validation error', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    await expect(loadPDF(file)).rejects.toThrow('PDF')
  })

  it('should reject file exceeding 50MB with validation error', async () => {
    const file = new File(['x'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 })
    await expect(loadPDF(file)).rejects.toThrow('50')
  })

  it('should reject zero-byte file with validation error', async () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 0 })
    await expect(loadPDF(file)).rejects.toThrow()
  })

  it('should call getDocument with file data for valid PDF', async () => {
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })

    const mockPdf = { numPages: 3 }
    const mockLoadingTask = {
      promise: Promise.resolve(mockPdf),
      onPassword: null as Function | null,
    }
    vi.mocked(getDocument).mockReturnValue(mockLoadingTask as never)

    const result = await loadPDF(file)
    expect(getDocument).toHaveBeenCalled()
    expect(result.pdf).toBe(mockPdf)
    expect(result.numPages).toBe(3)
  })

  it('should wire onPassword callback when provided', async () => {
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })

    const mockPdf = { numPages: 1 }
    let capturedOnPassword: Function | null = null
    const mockLoadingTask = {
      promise: Promise.resolve(mockPdf),
      set onPassword(fn: Function) {
        capturedOnPassword = fn
      },
      get onPassword(): Function | null {
        return capturedOnPassword
      },
    }
    vi.mocked(getDocument).mockReturnValue(mockLoadingTask as never)

    const onPassword = vi.fn()
    await loadPDF(file, onPassword)

    expect(capturedOnPassword).not.toBeNull()
    // Simulate PDF.js calling the password callback
    const updateFn = vi.fn()
    capturedOnPassword!(updateFn, 1)
    expect(onPassword).toHaveBeenCalledWith(updateFn, 1)
  })

  it('should not set onPassword when no callback provided', async () => {
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })

    const mockPdf = { numPages: 2 }
    let onPasswordSet = false
    const mockLoadingTask = {
      promise: Promise.resolve(mockPdf),
      set onPassword(_fn: Function) {
        onPasswordSet = true
      },
      get onPassword(): Function | null {
        return null
      },
    }
    vi.mocked(getDocument).mockReturnValue(mockLoadingTask as never)

    await loadPDF(file)
    expect(onPasswordSet).toBe(false)
  })
})

describe('destroyPDF', () => {
  it('should be a function', () => {
    expect(typeof destroyPDF).toBe('function')
  })

  it('should call cleanup and destroy on the pdf proxy', async () => {
    const mockPdf = {
      cleanup: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    }

    await destroyPDF(mockPdf as never)
    expect(mockPdf.cleanup).toHaveBeenCalledOnce()
    expect(mockPdf.destroy).toHaveBeenCalledOnce()
  })

  it('should call cleanup before destroy', async () => {
    const callOrder: string[] = []
    const mockPdf = {
      cleanup: vi.fn(() => {
        callOrder.push('cleanup')
        return Promise.resolve()
      }),
      destroy: vi.fn(() => {
        callOrder.push('destroy')
        return Promise.resolve()
      }),
    }

    await destroyPDF(mockPdf as never)
    expect(callOrder).toEqual(['cleanup', 'destroy'])
  })
})
