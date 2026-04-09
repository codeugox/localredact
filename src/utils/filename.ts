// src/utils/filename.ts
// Output filename generation utility.
// Framework-agnostic — no Preact imports.

/**
 * Generate the output filename for a redacted PDF.
 * Strips the .pdf extension (case-insensitive), appends '-redacted.pdf'.
 *
 * @param original - The original filename (e.g., 'invoice.pdf')
 * @returns The output filename (e.g., 'invoice-redacted.pdf')
 */
export function getOutputFilename(original: string): string {
  const name = original.replace(/\.pdf$/i, '')
  return `${name}-redacted.pdf`
}
