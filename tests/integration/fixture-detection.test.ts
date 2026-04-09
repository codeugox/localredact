/**
 * tests/integration/fixture-detection.test.ts
 *
 * Integration tests that load pre-built PDF fixtures, extract text items
 * using pdfjs-dist (legacy build for Node.js), and feed them through
 * the detection pipeline to verify correct results.
 *
 * This validates that the fixture PDFs contain the right content and
 * that the detection pipeline produces correct decisions for each.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { TextItem } from '../../src/core/text-index'
import {
  detectPipeline,
  resetEntityCounter,
} from '../../src/core/pipeline/detect-document'
import type { PageInput } from '../../src/core/pipeline/detect-document'

// ─── Helpers ────────────────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, '..', 'fixtures')

/**
 * Load a fixture PDF and extract text items per page using the legacy
 * pdfjs-dist build (which works in Node.js without DOMMatrix).
 */
async function loadFixturePages(filename: string): Promise<PageInput[]> {
  // Dynamic import of legacy build to avoid static analysis issues
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const data = new Uint8Array(readFileSync(join(FIXTURES_DIR, filename)))
  const pdf = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  const pages: PageInput[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent({
      disableNormalization: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems = textContent.items as any[]
    const items: TextItem[] = rawItems
      .filter((item) => 'str' in item)
      .map((item) => ({
        str: item.str as string,
        transform: item.transform as number[],
        width: item.width as number,
        height: item.height as number,
        hasEOL: item.hasEOL as boolean,
      }))

    pages.push({
      items,
      viewport: { width: viewport.width, height: viewport.height },
    })
  }

  await pdf.destroy()
  return pages
}

// ─── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  resetEntityCounter()
})

describe('Fixture: detect-001-all-entities.pdf — VAL-DETECT-001', () => {
  let pages: PageInput[]

  beforeAll(async () => {
    pages = await loadFixturePages('detect-001-all-entities.pdf')
  })

  it('should load a single-page fixture', () => {
    expect(pages).toHaveLength(1)
  })

  it('should detect at least 10 entities in identity-only mode', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    // At minimum: SSN, ITIN, EIN, credit card, phone, email, address, DOB,
    // bank account, routing number, money, passport
    expect(result.entities.length).toBeGreaterThanOrEqual(10)
  })

  it('should detect SSN', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const ssn = result.entities.find((e) => e.type === 'US_SSN')
    expect(ssn).toBeDefined()
    expect(ssn!.text).toContain('412-67-9823')
  })

  it('should detect credit card (valid Luhn)', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const cc = result.entities.find((e) => e.type === 'CREDIT_CARD')
    expect(cc).toBeDefined()
    expect(cc!.text).toContain('4532015112830366')
  })

  it('should detect email', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const email = result.entities.find((e) => e.type === 'EMAIL_ADDRESS')
    expect(email).toBeDefined()
    expect(email!.text).toContain('john.martinez@gmail.com')
  })

  it('should detect phone number', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const phone = result.entities.find((e) => e.type === 'PHONE_NUMBER')
    expect(phone).toBeDefined()
  })

  it('should detect labeled EIN', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const ein = result.entities.find((e) => e.type === 'US_EIN')
    expect(ein).toBeDefined()
    expect(ein!.decision).toBe('REDACT')
  })

  it('should detect address (merged street + city/state/zip)', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    // Should be an ADDRESS (merged) or have at least street or city/state/zip
    const address = result.entities.find(
      (e) =>
        e.type === 'ADDRESS' ||
        e.type === 'STREET_ADDRESS' ||
        e.type === 'CITY_STATE_ZIP'
    )
    expect(address).toBeDefined()
  })

  it('should detect money as KEEP in identity mode', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const money = result.entities.find((e) => e.type === 'MONEY')
    expect(money).toBeDefined()
    expect(money!.decision).toBe('KEEP')
  })

  it('should detect passport', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const passport = result.entities.find((e) => e.type === 'PASSPORT')
    expect(passport).toBeDefined()
  })
})

describe('Fixture: detect-005-credit-card.pdf — VAL-DETECT-005', () => {
  let pages: PageInput[]

  beforeAll(async () => {
    pages = await loadFixturePages('detect-005-credit-card.pdf')
  })

  it('should detect the valid Luhn credit card number', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const cc = result.entities.find((e) => e.type === 'CREDIT_CARD')
    expect(cc).toBeDefined()
    expect(cc!.text).toContain('4532015112830366')
  })

  it('should NOT detect the invalid Luhn credit card number', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const invalidCC = result.entities.find(
      (e) => e.text.includes('4532015112830367')
    )
    expect(invalidCC).toBeUndefined()
  })
})

describe('Fixture: detect-007-ein-context.pdf — VAL-DETECT-007', () => {
  let pages: PageInput[]

  beforeAll(async () => {
    pages = await loadFixturePages('detect-007-ein-context.pdf')
  })

  it('should have 2 pages (labeled on page 1, unlabeled on page 2)', () => {
    expect(pages).toHaveLength(2)
  })

  it('should detect the labeled EIN on page 1 as REDACT', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const labeledEIN = result.entities.find(
      (e) => e.type === 'US_EIN' && e.page === 1
    )
    expect(labeledEIN).toBeDefined()
    expect(labeledEIN!.text).toContain('12-3456789')
    expect(labeledEIN!.confidence).toBeGreaterThanOrEqual(0.85)
    expect(labeledEIN!.decision).toBe('REDACT')
  })

  it('should detect the unlabeled EIN on page 2 as UNCERTAIN', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const unlabeledEIN = result.entities.find(
      (e) => e.type === 'US_EIN' && e.page === 2
    )
    expect(unlabeledEIN).toBeDefined()
    expect(unlabeledEIN!.text).toContain('98-7654321')
    expect(unlabeledEIN!.confidence).toBeLessThan(0.85)
    expect(unlabeledEIN!.confidence).toBeGreaterThanOrEqual(0.60)
    expect(unlabeledEIN!.decision).toBe('UNCERTAIN')
  })

  it('should not have context bleed — page 2 EIN gets NO_CONTEXT score', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const unlabeledEIN = result.entities.find(
      (e) => e.type === 'US_EIN' && e.page === 2
    )
    expect(unlabeledEIN).toBeDefined()
    // NO_CONTEXT = 0.65, not WITH_CONTEXT = 0.95
    expect(unlabeledEIN!.confidence).toBe(0.65)
  })
})

describe('Fixture: detect-008-no-pii.pdf — VAL-DETECT-008', () => {
  let pages: PageInput[]

  beforeAll(async () => {
    pages = await loadFixturePages('detect-008-no-pii.pdf')
  })

  it('should produce zero entities (no PII)', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    expect(result.entities).toHaveLength(0)
  })

  it('should also produce zero entities in full redaction mode', () => {
    const result = detectPipeline(pages, 'FULL_REDACTION')
    expect(result.entities).toHaveLength(0)
  })
})

describe('Fixture: detect-011-bank-context.pdf — VAL-DETECT-011', () => {
  let pages: PageInput[]

  beforeAll(async () => {
    pages = await loadFixturePages('detect-011-bank-context.pdf')
  })

  it('should have 2 pages (labeled on page 1, unlabeled on page 2)', () => {
    expect(pages).toHaveLength(2)
  })

  it('should detect the labeled bank account on page 1 as REDACT', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const labeled = result.entities.find(
      (e) => e.type === 'BANK_ACCOUNT' && e.page === 1
    )
    expect(labeled).toBeDefined()
    expect(labeled!.text).toContain('123456789012')
    expect(labeled!.confidence).toBeGreaterThanOrEqual(0.85)
    expect(labeled!.decision).toBe('REDACT')
  })

  it('should NOT detect any bank account on page 2 (unlabeled → discarded)', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    const unlabeled = result.entities.find(
      (e) => e.type === 'BANK_ACCOUNT' && e.page === 2
    )
    expect(unlabeled).toBeUndefined()
  })

  it('should not have context bleed — page 2 standalone number is not detected', () => {
    const result = detectPipeline(pages, 'IDENTITY_ONLY')
    // No entity should match the standalone number on page 2
    const page2Entities = result.entities.filter((e) => e.page === 2)
    const bankOnPage2 = page2Entities.find(
      (e) => e.text.includes('987654321012')
    )
    expect(bankOnPage2).toBeUndefined()
  })
})
