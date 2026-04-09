// tests/unit/detection-assertions.test.ts
// Regression tests for 5 failed detection assertions:
// VAL-DETECT-005, VAL-DETECT-007, VAL-DETECT-009, VAL-DETECT-011, VAL-DETECT-012

import { describe, it, expect, beforeEach } from 'vitest'
import type { TextItem } from '@/core/text-index'
import { detectPipeline, resetEntityCounter } from '@/core/pipeline/detect-document'

// ─── Test Helpers ──────────────────────────────────────────────────

function makeTextItem(
  str: string,
  x: number,
  y: number,
  width: number,
  height: number = 12,
  hasEOL: boolean = false
): TextItem {
  return {
    str,
    transform: [1, 0, 0, 1, x, y],
    width,
    height,
    hasEOL,
  }
}

const LETTER_VIEWPORT = { width: 612, height: 792 }

beforeEach(() => {
  resetEntityCounter()
})

// ─── VAL-DETECT-005: Invalid Luhn credit card produces no highlight ──

describe('VAL-DETECT-005 — Invalid Luhn credit card ignored completely', () => {
  it('should not highlight a 16-digit number that fails Luhn (no detection of any type)', () => {
    // 4532015112830367 fails Luhn check — should NOT be detected as CREDIT_CARD,
    // BANK_ACCOUNT, or any other type
    const items: TextItem[] = [
      makeTextItem('4532015112830367', 72, 720, 100),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    // No entity of ANY type should be detected for this number
    expect(result.entities).toHaveLength(0)
  })

  it('should still detect a valid Luhn credit card number', () => {
    const items: TextItem[] = [
      makeTextItem('4532015112830366', 72, 720, 100),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const cc = result.entities.find((e) => e.type === 'CREDIT_CARD')
    expect(cc).toBeDefined()
    expect(cc!.confidence).toBeGreaterThanOrEqual(0.99)
  })

  it('should not highlight invalid Luhn even with "Card:" context label', () => {
    const items: TextItem[] = [
      makeTextItem('Card: ', 72, 720, 32),
      makeTextItem('4532015112830367', 104, 720, 100),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    // Should produce zero highlights — the 16-digit number failing Luhn
    // should be suppressed as any type
    expect(result.entities).toHaveLength(0)
  })

  it('should detect both valid and only valid when valid and invalid are on same page', () => {
    const items: TextItem[] = [
      makeTextItem('4532015112830366', 72, 720, 100), // valid Luhn
      makeTextItem('4532015112830367', 72, 700, 100), // invalid Luhn
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const ccs = result.entities.filter((e) => e.type === 'CREDIT_CARD')
    expect(ccs).toHaveLength(1)
    expect(ccs[0].text).toBe('4532015112830366')

    // The invalid one should not appear as any entity type
    const invalidEntities = result.entities.filter((e) =>
      e.text === '4532015112830367'
    )
    expect(invalidEntities).toHaveLength(0)
  })
})

// ─── VAL-DETECT-007: Unlabeled EIN shows UNCERTAIN, labeled shows REDACT ──

describe('VAL-DETECT-007 — EIN context-sensitive confidence', () => {
  it('should produce UNCERTAIN for unlabeled EIN (no context)', () => {
    // Standalone EIN without label — should have confidence < 0.85 → UNCERTAIN
    const items: TextItem[] = [
      makeTextItem('98-7654321', 72, 720, 62),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const ein = result.entities.find((e) => e.type === 'US_EIN')
    expect(ein).toBeDefined()
    expect(ein!.confidence).toBeGreaterThanOrEqual(0.60)
    expect(ein!.confidence).toBeLessThan(0.85)
    expect(ein!.decision).toBe('UNCERTAIN')
  })

  it('should produce REDACT for labeled EIN (with context)', () => {
    // EIN with "EIN:" label — should have confidence >= 0.85 → REDACT
    const items: TextItem[] = [
      makeTextItem('EIN: ', 72, 720, 28),
      makeTextItem('12-3456789', 100, 720, 62),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const ein = result.entities.find((e) => e.type === 'US_EIN')
    expect(ein).toBeDefined()
    expect(ein!.confidence).toBeGreaterThanOrEqual(0.85)
    expect(ein!.decision).toBe('REDACT')
  })

  it('should show both labeled and unlabeled EINs with correct decisions', () => {
    // Place the two EINs far apart so the unlabeled one is outside the
    // 80-char lookbehind window of the labeled one's context label.
    const items: TextItem[] = [
      makeTextItem('EIN: 12-3456789', 72, 720, 90),
      // Padding text to push unlabeled EIN beyond 80 chars from "EIN:"
      makeTextItem('This is some filler text that ensures the next value is well outside the context window for lookbehind.', 72, 680, 400),
      makeTextItem('98-7654321', 72, 660, 62),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const eins = result.entities.filter((e) => e.type === 'US_EIN')
    expect(eins.length).toBeGreaterThanOrEqual(2)

    const labeled = eins.find((e) => e.text === '12-3456789')
    expect(labeled).toBeDefined()
    expect(labeled!.decision).toBe('REDACT')

    const unlabeled = eins.find((e) => e.text === '98-7654321')
    expect(unlabeled).toBeDefined()
    expect(unlabeled!.decision).toBe('UNCERTAIN')
  })
})

// ─── VAL-DETECT-009: Duplicate SSNs at different positions are separate ──

describe('VAL-DETECT-009 — Duplicate SSN counting', () => {
  it('should keep two identical SSNs at different positions as separate entities', () => {
    // Same SSN appears twice on the same page at different offsets
    const items: TextItem[] = [
      makeTextItem('412-67-9823', 72, 720, 70),
      makeTextItem(' and ', 142, 720, 25),
      makeTextItem('412-67-9823', 167, 720, 70),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const ssns = result.entities.filter((e) => e.type === 'US_SSN')
    expect(ssns).toHaveLength(2)
    // Both should have distinct textOffsets
    expect(ssns[0].textOffset.start).not.toBe(ssns[1].textOffset.start)
  })

  it('should deduplicate SSNs only when page AND textOffset match exactly', () => {
    // Same SSN at the exact same position should still dedup
    const items: TextItem[] = [
      makeTextItem('SSN: 412-67-9823', 72, 720, 100),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const ssns = result.entities.filter((e) => e.type === 'US_SSN')
    expect(ssns).toHaveLength(1)
  })

  it('should keep identical SSNs on different pages as separate entities', () => {
    const items: TextItem[] = [
      makeTextItem('412-67-9823', 72, 720, 70),
    ]
    const pages = [
      { items, viewport: LETTER_VIEWPORT },
      { items, viewport: LETTER_VIEWPORT },
    ]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const ssns = result.entities.filter((e) => e.type === 'US_SSN')
    expect(ssns).toHaveLength(2)
    expect(ssns[0].page).not.toBe(ssns[1].page)
  })
})

// ─── VAL-DETECT-011: Standalone unlabeled number not highlighted ──

describe('VAL-DETECT-011 — Bank account context strictness', () => {
  it('should NOT highlight a standalone unlabeled 12-digit number', () => {
    // 987654321012 with no context label should not be highlighted
    const items: TextItem[] = [
      makeTextItem('987654321012', 72, 720, 76),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    // Should produce no entities for this standalone number
    const bankAcct = result.entities.find((e) => e.type === 'BANK_ACCOUNT')
    expect(bankAcct).toBeUndefined()
  })

  it('should highlight bank account WITH context label', () => {
    const items: TextItem[] = [
      makeTextItem('Account Number: ', 72, 720, 96),
      makeTextItem('123456789012', 168, 720, 76),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const bankAcct = result.entities.find((e) => e.type === 'BANK_ACCOUNT')
    expect(bankAcct).toBeDefined()
    expect(bankAcct!.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('should NOT highlight label text — only the value', () => {
    const items: TextItem[] = [
      makeTextItem('Account Number: ', 72, 720, 96),
      makeTextItem('123456789012', 168, 720, 76),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const bankAcct = result.entities.find((e) => e.type === 'BANK_ACCOUNT')
    expect(bankAcct).toBeDefined()
    expect(bankAcct!.text).toBe('123456789012')
    // Ensure the label is NOT in the matched text
    expect(bankAcct!.text).not.toContain('Account')
  })

  it('should NOT highlight standalone 12-digit number even in full redaction mode', () => {
    const items: TextItem[] = [
      makeTextItem('987654321012', 72, 720, 76),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'FULL_REDACTION')

    const bankAcct = result.entities.find((e) => e.type === 'BANK_ACCOUNT')
    expect(bankAcct).toBeUndefined()
  })
})

// ─── VAL-DETECT-012: Multi-line address unified ──

describe('VAL-DETECT-012 — Multi-line address merged', () => {
  it('should merge STREET_ADDRESS + CITY_STATE_ZIP into a single ADDRESS entity', () => {
    // Two-line address:
    //   Line 1: "441 Birchwood Lane"
    //   Line 2: "Columbus, OH 43201"
    const items: TextItem[] = [
      makeTextItem('441 Birchwood Lane', 72, 720, 110),
      makeTextItem('Columbus, OH 43201', 72, 700, 100),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    // Should be merged into one ADDRESS entity
    const addresses = result.entities.filter((e) => e.type === 'ADDRESS')
    expect(addresses).toHaveLength(1)
    expect(addresses[0].quads.length).toBeGreaterThanOrEqual(2) // quads on both lines
  })

  it('should NOT have separate STREET_ADDRESS or CITY_STATE_ZIP entities after merge', () => {
    const items: TextItem[] = [
      makeTextItem('441 Birchwood Lane', 72, 720, 110),
      makeTextItem('Columbus, OH 43201', 72, 700, 100),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const street = result.entities.find((e) => e.type === 'STREET_ADDRESS')
    const cityStateZip = result.entities.find((e) => e.type === 'CITY_STATE_ZIP')
    expect(street).toBeUndefined()
    expect(cityStateZip).toBeUndefined()
  })

  it('should keep standalone STREET_ADDRESS when no CITY_STATE_ZIP follows', () => {
    const items: TextItem[] = [
      makeTextItem('441 Birchwood Lane', 72, 720, 110),
      makeTextItem('Some random text about nothing', 72, 700, 180),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const street = result.entities.find((e) => e.type === 'STREET_ADDRESS')
    expect(street).toBeDefined()
    // No ADDRESS entity should be created
    const address = result.entities.find((e) => e.type === 'ADDRESS')
    expect(address).toBeUndefined()
  })

  it('should keep standalone CITY_STATE_ZIP when no STREET_ADDRESS precedes', () => {
    const items: TextItem[] = [
      makeTextItem('Some random text about nothing', 72, 720, 180),
      makeTextItem('Columbus, OH 43201', 72, 700, 100),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const cityStateZip = result.entities.find((e) => e.type === 'CITY_STATE_ZIP')
    expect(cityStateZip).toBeDefined()
    const address = result.entities.find((e) => e.type === 'ADDRESS')
    expect(address).toBeUndefined()
  })

  it('should merge address with combined quads spanning both lines', () => {
    const items: TextItem[] = [
      makeTextItem('441 Birchwood Lane', 72, 720, 110),
      makeTextItem('Columbus, OH 43201', 72, 700, 100),
    ]
    const pages = [{ items, viewport: LETTER_VIEWPORT }]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    const address = result.entities.find((e) => e.type === 'ADDRESS')
    expect(address).toBeDefined()
    // Quads should cover both lines
    expect(address!.quads.length).toBeGreaterThanOrEqual(2)
  })

  it('should not merge address entities across pages', () => {
    // Street address on page 1, city/state/zip on page 2
    const page1Items: TextItem[] = [
      makeTextItem('441 Birchwood Lane', 72, 720, 110),
    ]
    const page2Items: TextItem[] = [
      makeTextItem('Columbus, OH 43201', 72, 720, 100),
    ]
    const pages = [
      { items: page1Items, viewport: LETTER_VIEWPORT },
      { items: page2Items, viewport: LETTER_VIEWPORT },
    ]
    const result = detectPipeline(pages, 'IDENTITY_ONLY')

    // Should NOT merge across pages
    const address = result.entities.find((e) => e.type === 'ADDRESS')
    expect(address).toBeUndefined()
    // Each should remain as its original type
    const street = result.entities.find((e) => e.type === 'STREET_ADDRESS')
    expect(street).toBeDefined()
  })
})
