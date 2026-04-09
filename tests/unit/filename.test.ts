// tests/unit/filename.test.ts
// Tests for output filename generation utility.

import { describe, it, expect } from 'vitest'
import { getOutputFilename } from '@/utils/filename'

describe('getOutputFilename', () => {
  it('should append -redacted before .pdf extension', () => {
    expect(getOutputFilename('invoice.pdf')).toBe('invoice-redacted.pdf')
  })

  it('should handle simple filename', () => {
    expect(getOutputFilename('document.pdf')).toBe('document-redacted.pdf')
  })

  it('should handle filename with multiple dots', () => {
    expect(getOutputFilename('my.report.final.pdf')).toBe('my.report.final-redacted.pdf')
  })

  it('should handle filename with spaces', () => {
    expect(getOutputFilename('my document.pdf')).toBe('my document-redacted.pdf')
  })

  it('should handle filename with dashes already', () => {
    expect(getOutputFilename('tax-return-2024.pdf')).toBe('tax-return-2024-redacted.pdf')
  })

  it('should handle filename with uppercase extension', () => {
    expect(getOutputFilename('scan.PDF')).toBe('scan-redacted.pdf')
  })

  it('should handle filename without .pdf extension', () => {
    expect(getOutputFilename('document')).toBe('document-redacted.pdf')
  })

  it('should handle filename with mixed-case .Pdf extension', () => {
    expect(getOutputFilename('report.Pdf')).toBe('report-redacted.pdf')
  })

  it('should handle filename with only .pdf', () => {
    expect(getOutputFilename('.pdf')).toBe('-redacted.pdf')
  })

  it('should handle empty string', () => {
    expect(getOutputFilename('')).toBe('-redacted.pdf')
  })
})
