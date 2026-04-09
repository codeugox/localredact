/**
 * tests/fixtures/create-fixtures.ts
 *
 * Generates pre-built PDF test fixtures for browser validation.
 * Each fixture corresponds to one or more VAL-DETECT-* assertions.
 *
 * Usage:
 *   npx tsx tests/fixtures/create-fixtures.ts
 *
 * Generated PDFs:
 *   tests/fixtures/detect-001-all-entities.pdf    — VAL-DETECT-001 (all entity types)
 *   tests/fixtures/detect-005-credit-card.pdf     — VAL-DETECT-005 (valid + invalid Luhn)
 *   tests/fixtures/detect-007-ein-context.pdf     — VAL-DETECT-007 (EIN context, separate pages)
 *   tests/fixtures/detect-008-no-pii.pdf          — VAL-DETECT-008 (no PII)
 *   tests/fixtures/detect-011-bank-context.pdf    — VAL-DETECT-011 (bank account context, separate pages)
 */

import { jsPDF } from 'jspdf'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filenameESM = fileURLToPath(import.meta.url)
const FIXTURES_DIR = dirname(__filenameESM)

/** Helper: save a jsPDF doc to disk */
function savePDF(doc: jsPDF, filename: string): void {
  const buffer = doc.output('arraybuffer') as ArrayBuffer
  const filepath = join(FIXTURES_DIR, filename)
  writeFileSync(filepath, Buffer.from(buffer))
  console.log(`  ✓ ${filename} (${Math.round(buffer.byteLength / 1024)} KB)`)
}

// ─── VAL-DETECT-001: All entity types ───────────────────────────────

function createDetect001(): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  // Page setup: use Helvetica (built-in to jsPDF, always available)
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(12)

  let y = 72 // start below top margin

  // Title
  doc.setFontSize(14)
  doc.text('PII Detection Test — All Entity Types', 72, y)
  y += 30

  doc.setFontSize(12)

  // SSN (formatted)
  doc.text('SSN: 412-67-9823', 72, y)
  y += 20

  // ITIN
  doc.text('ITIN: 912-94-7890', 72, y)
  y += 20

  // EIN (labeled)
  doc.text('EIN: 12-3456789', 72, y)
  y += 20

  // Credit card (valid Luhn)
  doc.text('Credit Card: 4532015112830366', 72, y)
  y += 20

  // Phone
  doc.text('Phone: (202) 555-0147', 72, y)
  y += 20

  // Email
  doc.text('Email: john.martinez@gmail.com', 72, y)
  y += 20

  // Street address + city/state/zip (multi-line)
  doc.text('441 Birchwood Lane', 72, y)
  y += 16
  doc.text('Columbus, OH 43201', 72, y)
  y += 20

  // Date of birth
  doc.text('DOB: 03/15/1985', 72, y)
  y += 20

  // Bank account (labeled)
  doc.text('Account Number: 123456789012', 72, y)
  y += 20

  // Routing number (labeled)
  doc.text('Routing Number: 021000021', 72, y)
  y += 20

  // Dollar amount
  doc.text('Amount: $84,200.00', 72, y)
  y += 20

  // Passport (labeled)
  doc.text('Passport: A12345678', 72, y)
  y += 20

  savePDF(doc, 'detect-001-all-entities.pdf')
}

// ─── VAL-DETECT-005: Credit card — valid vs invalid Luhn ────────────

function createDetect005(): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(12)

  let y = 72

  doc.setFontSize(14)
  doc.text('Credit Card Luhn Validation Test', 72, y)
  y += 30

  doc.setFontSize(12)

  // Valid Luhn card
  doc.text('Valid card number: 4532015112830366', 72, y)
  y += 30

  // Invalid Luhn card
  doc.text('Invalid card number: 4532015112830367', 72, y)
  y += 20

  savePDF(doc, 'detect-005-credit-card.pdf')
}

// ─── VAL-DETECT-007: EIN context — SEPARATE PAGES ──────────────────
//
// CRITICAL: The labeled and unlabeled EINs MUST be on separate pages
// to guarantee no context bleed. The 80-char context lookbehind window
// operates within a single normalized page string, so putting values
// on different pages eliminates any possibility of false context boosting.

function createDetect007(): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  doc.setFont('Helvetica', 'normal')

  // ── Page 1: Labeled EIN ──
  doc.setFontSize(14)
  doc.text('EIN Context Test — Page 1 (Labeled)', 72, 72)

  doc.setFontSize(12)
  doc.text('EIN: 12-3456789', 72, 120)

  // ── Page 2: Unlabeled EIN ──
  doc.addPage('letter')
  doc.setFontSize(14)
  doc.text('Page 2 (Unlabeled)', 72, 72)

  doc.setFontSize(12)
  // Only the bare EIN value — no context words on this page.
  // No "EIN", "Employer Identification Number", "Federal ID", or "Tax ID".
  doc.text('98-7654321', 72, 120)

  savePDF(doc, 'detect-007-ein-context.pdf')
}

// ─── VAL-DETECT-008: No PII document ────────────────────────────────

function createDetect008(): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  doc.setFont('Helvetica', 'normal')

  doc.setFontSize(14)
  doc.text('Generic Document — No PII', 72, 72)

  doc.setFontSize(12)

  const lines = [
    'This document contains only generic text with no personally',
    'identifiable information. It is used to verify that the detection',
    'engine does not produce false positives on clean content.',
    '',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
    '',
    'The quick brown fox jumps over the lazy dog.',
    'Pack my box with five dozen liquor jugs.',
  ]

  let y = 110
  for (const line of lines) {
    doc.text(line, 72, y)
    y += 18
  }

  savePDF(doc, 'detect-008-no-pii.pdf')
}

// ─── VAL-DETECT-011: Bank account context — SEPARATE PAGES ─────────
//
// Same principle as DETECT-007: labeled and unlabeled values on
// separate pages to prevent context bleed through the lookbehind window.

function createDetect011(): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  doc.setFont('Helvetica', 'normal')

  // ── Page 1: Labeled bank account ──
  doc.setFontSize(14)
  doc.text('Bank Account Context Test — Page 1 (Labeled)', 72, 72)

  doc.setFontSize(12)
  doc.text('Account Number: 123456789012', 72, 120)

  // ── Page 2: Unlabeled standalone number ──
  doc.addPage('letter')
  doc.setFontSize(14)
  doc.text('Page 2 (Unlabeled)', 72, 72)

  doc.setFontSize(12)
  // Only the bare number — no context words on this page.
  // No "account", "acct", "number", "#", or "no." anywhere on this page.
  doc.text('987654321012', 72, 120)

  savePDF(doc, 'detect-011-bank-context.pdf')
}

// ─── Main ───────────────────────────────────────────────────────────

function main(): void {
  console.log('Creating test fixture PDFs...\n')

  createDetect001()
  createDetect005()
  createDetect007()
  createDetect008()
  createDetect011()

  console.log('\nAll fixtures created successfully.')
}

main()
