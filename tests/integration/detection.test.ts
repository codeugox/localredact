// tests/integration/detection.test.ts
// Integration tests for the detection pipeline: indexing → pattern matching →
// context scoring → merging → final entity list.

import { describe, it, expect, vi } from 'vitest'
import type { TextItem } from '@/core/text-index'
import type { RedactionMode, DetectedEntity } from '@/core/detectors/entities'
import { detectPipeline } from '@/core/pipeline/detect-document'

// ─── Test Helpers ──────────────────────────────────────────────────

/** Create a realistic TextItem at a given position */
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

/** Viewport for a typical US letter-sized page */
const LETTER_VIEWPORT = { width: 612, height: 792 }

// ─── Test Data ─────────────────────────────────────────────────────

/**
 * Page 1: Contains multiple PII types — SSN, email, phone, credit card, money
 * Layout simulates a realistic form:
 *   Line 1: "SSN: 412-67-9823"
 *   Line 2: "Email: john.martinez@gmail.com"
 *   Line 3: "Phone: (202) 555-0147"
 *   Line 4: "Card: 4532015112830366"
 *   Line 5: "Amount: $84,200.00"
 */
function buildPage1Items(): TextItem[] {
  return [
    // Line 1
    makeTextItem('SSN: ', 72, 720, 30),
    makeTextItem('412-67-9823', 102, 720, 70),
    // Line 2
    makeTextItem('Email: ', 72, 700, 38, 12, false),
    makeTextItem('john.martinez@gmail.com', 110, 700, 140),
    // Line 3
    makeTextItem('Phone: ', 72, 680, 38),
    makeTextItem('(202) 555-0147', 110, 680, 90),
    // Line 4
    makeTextItem('Card: ', 72, 660, 32),
    makeTextItem('4532015112830366', 104, 660, 100),
    // Line 5
    makeTextItem('Amount: ', 72, 640, 42),
    makeTextItem('$84,200.00', 114, 640, 60),
  ]
}

/**
 * Page 2: Contains address, EIN, and DOB
 *   Line 1: "441 Birchwood Lane"
 *   Line 2: "Columbus, OH 43201"
 *   Line 3: "EIN: 12-3456789"
 *   Line 4: "DOB: 03/15/1985"
 */
function buildPage2Items(): TextItem[] {
  return [
    // Line 1 - address
    makeTextItem('441 Birchwood Lane', 72, 720, 110),
    // Line 2 - city state zip
    makeTextItem('Columbus, OH 43201', 72, 700, 100),
    // Line 3 - EIN
    makeTextItem('EIN: ', 72, 680, 28),
    makeTextItem('12-3456789', 100, 680, 62),
    // Line 4 - DOB
    makeTextItem('DOB: ', 72, 660, 28),
    makeTextItem('03/15/1985', 100, 660, 60),
  ]
}

/**
 * Page 3: Contains bank account and routing number
 *   Line 1: "Account Number: 123456789012"
 *   Line 2: "Routing Number: 021000021"
 *   Line 3: "Passport: A12345678"
 */
function buildPage3Items(): TextItem[] {
  return [
    // Line 1 - bank account
    makeTextItem('Account Number: ', 72, 720, 96),
    makeTextItem('123456789012', 168, 720, 76),
    // Line 2 - routing number
    makeTextItem('Routing Number: ', 72, 700, 96),
    makeTextItem('021000021', 168, 700, 56),
    // Line 3 - passport
    makeTextItem('Passport: ', 72, 680, 56),
    makeTextItem('A12345678', 128, 680, 56),
  ]
}

/** Empty page — no text items */
function buildEmptyPageItems(): TextItem[] {
  return []
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('detectPipeline', () => {
  describe('single page — identity only mode', () => {
    it('should detect SSN, email, phone, credit card, and money on page 1', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      // Should detect: SSN, email, phone, credit card, money
      expect(result.entities.length).toBeGreaterThanOrEqual(5)

      const types = result.entities.map((e) => e.type)
      expect(types).toContain('US_SSN')
      expect(types).toContain('EMAIL_ADDRESS')
      expect(types).toContain('PHONE_NUMBER')
      expect(types).toContain('CREDIT_CARD')
      expect(types).toContain('MONEY')
    })

    it('should assign KEEP to MONEY in identity only mode', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const money = result.entities.filter((e) => e.type === 'MONEY')
      expect(money.length).toBeGreaterThanOrEqual(1)
      for (const e of money) {
        expect(e.decision).toBe('KEEP')
      }
    })

    it('should assign REDACT to high-confidence identity entities', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const ssn = result.entities.find((e) => e.type === 'US_SSN')
      expect(ssn).toBeDefined()
      expect(ssn!.decision).toBe('REDACT')

      const email = result.entities.find((e) => e.type === 'EMAIL_ADDRESS')
      expect(email).toBeDefined()
      expect(email!.decision).toBe('REDACT')

      const cc = result.entities.find((e) => e.type === 'CREDIT_CARD')
      expect(cc).toBeDefined()
      expect(cc!.decision).toBe('REDACT')
    })

    it('should give credit card a high confidence (Luhn valid)', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const cc = result.entities.find((e) => e.type === 'CREDIT_CARD')
      expect(cc).toBeDefined()
      expect(cc!.confidence).toBeGreaterThanOrEqual(0.99)
    })

    it('should return IndexedPage for each page', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].pageNum).toBe(1)
      expect(result.pages[0].text.length).toBeGreaterThan(0)
    })
  })

  describe('full redaction mode', () => {
    it('should assign REDACT to MONEY in full redaction mode', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'FULL_REDACTION')

      const money = result.entities.filter((e) => e.type === 'MONEY')
      expect(money.length).toBeGreaterThanOrEqual(1)
      for (const e of money) {
        expect(e.decision).toBe('REDACT')
      }
    })
  })

  describe('multi-page detection', () => {
    it('should detect entities across all pages', () => {
      const pages = [
        { items: buildPage1Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage2Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage3Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      // Entities should be present from all pages
      const page1Entities = result.entities.filter((e) => e.page === 1)
      const page2Entities = result.entities.filter((e) => e.page === 2)
      const page3Entities = result.entities.filter((e) => e.page === 3)

      expect(page1Entities.length).toBeGreaterThan(0)
      expect(page2Entities.length).toBeGreaterThan(0)
      expect(page3Entities.length).toBeGreaterThan(0)
    })

    it('should detect address-related entities on page 2', () => {
      const pages = [
        { items: buildPage1Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage2Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const page2Types = result.entities
        .filter((e) => e.page === 2)
        .map((e) => e.type)

      expect(page2Types).toContain('STREET_ADDRESS')
      expect(page2Types).toContain('CITY_STATE_ZIP')
    })

    it('should detect EIN with context label on page 2', () => {
      const pages = [
        { items: buildPage2Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const ein = result.entities.find((e) => e.type === 'US_EIN')
      expect(ein).toBeDefined()
      // EIN with "EIN:" label should have high confidence
      expect(ein!.confidence).toBeGreaterThanOrEqual(0.85)
      expect(ein!.decision).toBe('REDACT')
    })

    it('should detect bank account with context label on page 3', () => {
      const pages = [
        { items: buildPage3Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const bankAcct = result.entities.find((e) => e.type === 'BANK_ACCOUNT')
      expect(bankAcct).toBeDefined()
      expect(bankAcct!.confidence).toBeGreaterThanOrEqual(0.85)
    })

    it('should detect passport with context label on page 3', () => {
      const pages = [
        { items: buildPage3Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const passport = result.entities.find((e) => e.type === 'PASSPORT')
      expect(passport).toBeDefined()
      expect(passport!.confidence).toBeGreaterThanOrEqual(0.85)
    })

    it('should return correct number of IndexedPages', () => {
      const pages = [
        { items: buildPage1Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage2Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage3Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      expect(result.pages).toHaveLength(3)
      expect(result.pages[0].pageNum).toBe(1)
      expect(result.pages[1].pageNum).toBe(2)
      expect(result.pages[2].pageNum).toBe(3)
    })
  })

  describe('context-sensitive detection', () => {
    it('should use 80-char lookbehind for context scoring', () => {
      // EIN value without context label — should have lower confidence
      const items: TextItem[] = [
        makeTextItem('Some random text that is not related to anything. Value is ', 72, 720, 300),
        makeTextItem('12-3456789', 372, 720, 62),
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const ein = result.entities.find((e) => e.type === 'US_EIN')
      // Without context, EIN should have lower confidence
      if (ein) {
        expect(ein.confidence).toBeLessThan(0.85)
      }
    })

    it('should boost confidence when context label is within 80 chars', () => {
      // EIN value with context label nearby
      const items: TextItem[] = [
        makeTextItem('EIN: ', 72, 720, 28),
        makeTextItem('12-3456789', 100, 720, 62),
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const ein = result.entities.find((e) => e.type === 'US_EIN')
      expect(ein).toBeDefined()
      expect(ein!.confidence).toBeGreaterThanOrEqual(0.85)
    })
  })

  describe('entity properties', () => {
    it('should assign unique IDs to each entity', () => {
      const pages = [
        { items: buildPage1Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage2Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const ids = result.entities.map((e) => e.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should set layer to REGEX for all entities', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      for (const entity of result.entities) {
        expect(entity.layer).toBe('REGEX')
      }
    })

    it('should set correct page numbers on entities', () => {
      const pages = [
        { items: buildPage1Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage2Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      for (const entity of result.entities) {
        expect(entity.page).toBeGreaterThanOrEqual(1)
        expect(entity.page).toBeLessThanOrEqual(2)
      }
    })

    it('should have quads for each entity', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      for (const entity of result.entities) {
        expect(entity.quads.length).toBeGreaterThanOrEqual(1)
        // Each quad should have 8 numbers
        for (const quad of entity.quads) {
          expect(quad).toHaveLength(8)
          for (const n of quad) {
            expect(typeof n).toBe('number')
            expect(Number.isFinite(n)).toBe(true)
          }
        }
      }
    })

    it('should have valid textOffset for each entity', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      for (const entity of result.entities) {
        expect(entity.textOffset.start).toBeGreaterThanOrEqual(0)
        expect(entity.textOffset.end).toBeGreaterThan(entity.textOffset.start)
      }
    })

    it('should have text matching the matched substring', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const ssn = result.entities.find((e) => e.type === 'US_SSN')
      expect(ssn).toBeDefined()
      expect(ssn!.text).toBe('412-67-9823')
    })
  })

  describe('empty pages', () => {
    it('should handle empty pages without error', () => {
      const pages = [{ items: buildEmptyPageItems(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      expect(result.entities).toHaveLength(0)
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].text).toBe('')
    })

    it('should handle mixed empty and non-empty pages', () => {
      const pages = [
        { items: buildEmptyPageItems(), viewport: LETTER_VIEWPORT },
        { items: buildPage1Items(), viewport: LETTER_VIEWPORT },
        { items: buildEmptyPageItems(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      // Entities should only come from page 2 (1-indexed)
      expect(result.entities.length).toBeGreaterThan(0)
      for (const entity of result.entities) {
        expect(entity.page).toBe(2)
      }
      expect(result.pages).toHaveLength(3)
    })
  })

  describe('merging', () => {
    it('should not create duplicate entities for the same text', () => {
      // Same SSN appearing on the same page at the same position
      const items: TextItem[] = [
        makeTextItem('SSN: 412-67-9823', 72, 720, 100),
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const ssns = result.entities.filter((e) => e.type === 'US_SSN')
      expect(ssns).toHaveLength(1)
    })

    it('should handle overlapping detections correctly', () => {
      // This tests that the merger resolves overlapping spans
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      // No two entities on the same page should have overlapping textOffsets
      const page1Entities = result.entities.filter((e) => e.page === 1)
      for (let i = 0; i < page1Entities.length; i++) {
        for (let j = i + 1; j < page1Entities.length; j++) {
          const a = page1Entities[i].textOffset
          const b = page1Entities[j].textOffset
          const overlaps = a.start < b.end && b.start < a.end
          expect(overlaps).toBe(false)
        }
      }
    })
  })

  describe('progress callback', () => {
    it('should call onProgress for each page', () => {
      const onProgress = vi.fn()
      const pages = [
        { items: buildPage1Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage2Items(), viewport: LETTER_VIEWPORT },
        { items: buildPage3Items(), viewport: LETTER_VIEWPORT },
      ]
      const result = detectPipeline(pages, 'IDENTITY_ONLY', onProgress)

      expect(onProgress).toHaveBeenCalledTimes(3)
      expect(onProgress).toHaveBeenCalledWith(1, 3)
      expect(onProgress).toHaveBeenCalledWith(2, 3)
      expect(onProgress).toHaveBeenCalledWith(3, 3)
    })

    it('should work without onProgress callback', () => {
      const pages = [{ items: buildPage1Items(), viewport: LETTER_VIEWPORT }]
      // Should not throw without callback
      expect(() => detectPipeline(pages, 'IDENTITY_ONLY')).not.toThrow()
    })
  })

  describe('DOB detection', () => {
    it('should detect DOB with context label', () => {
      const pages = [{ items: buildPage2Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const dob = result.entities.find((e) => e.type === 'DATE_OF_BIRTH')
      expect(dob).toBeDefined()
      expect(dob!.text).toBe('03/15/1985')
    })
  })

  describe('routing number detection', () => {
    it('should detect routing number with context label', () => {
      const pages = [{ items: buildPage3Items(), viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const routing = result.entities.find((e) => e.type === 'ROUTING_NUMBER')
      expect(routing).toBeDefined()
      expect(routing!.text).toBe('021000021')
    })
  })

  describe('ZIP context case sensitivity', () => {
    it('should NOT boost confidence for common lowercase word "in" before ZIP code', () => {
      const items: TextItem[] = [
        makeTextItem('lives in 43201 area', 72, 720, 140),
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      // ZIP_CODE is in AMBIGUOUS_TYPES so it should be UNCERTAIN,
      // but the key thing is that "in" (lowercase) does NOT boost confidence
      const zip = result.entities.find(
        (e) => e.type === 'ZIP_CODE' && e.text === '43201'
      )
      // If found, confidence should be NO_CONTEXT (0.65), not boosted
      if (zip) {
        expect(zip.confidence).toBeLessThanOrEqual(0.65)
      }
    })

    it('should NOT boost confidence for common lowercase word "or" before ZIP code', () => {
      const items: TextItem[] = [
        makeTextItem('this or 97201', 72, 720, 100),
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const zip = result.entities.find(
        (e) => e.type === 'ZIP_CODE' && e.text === '97201'
      )
      if (zip) {
        expect(zip.confidence).toBeLessThanOrEqual(0.65)
      }
    })

    it('should boost confidence for uppercase state code "OH" before ZIP code', () => {
      const items: TextItem[] = [
        makeTextItem('OH 43201', 72, 720, 60),
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const zip = result.entities.find(
        (e) => e.type === 'ZIP_CODE' && e.text === '43201'
      )
      expect(zip).toBeDefined()
      // Should be boosted to MODERATE_CONTEXT (0.90) by uppercase state code
      expect(zip!.confidence).toBeGreaterThanOrEqual(0.90)
    })

    it('should boost confidence for explicit ZIP label', () => {
      const items: TextItem[] = [
        makeTextItem('ZIP: 43201', 72, 720, 60),
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const zip = result.entities.find(
        (e) => e.type === 'ZIP_CODE' && e.text === '43201'
      )
      expect(zip).toBeDefined()
      expect(zip!.confidence).toBeGreaterThanOrEqual(0.90)
    })

    it('should boost confidence for case-insensitive "zip code" label', () => {
      const items: TextItem[] = [
        makeTextItem('zip code: 43201', 72, 720, 80),
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const zip = result.entities.find(
        (e) => e.type === 'ZIP_CODE' && e.text === '43201'
      )
      expect(zip).toBeDefined()
      expect(zip!.confidence).toBeGreaterThanOrEqual(0.90)
    })
  })

  describe('credit card Luhn filtering', () => {
    it('should reject credit card numbers that fail Luhn', () => {
      const items: TextItem[] = [
        makeTextItem('Card: ', 72, 720, 32),
        makeTextItem('4532015112830367', 104, 720, 100), // fails Luhn
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const cc = result.entities.find((e) => e.type === 'CREDIT_CARD')
      expect(cc).toBeUndefined()
    })

    it('should accept credit card numbers that pass Luhn', () => {
      const items: TextItem[] = [
        makeTextItem('Card: ', 72, 720, 32),
        makeTextItem('4532015112830366', 104, 720, 100), // passes Luhn
      ]
      const pages = [{ items, viewport: LETTER_VIEWPORT }]
      const result = detectPipeline(pages, 'IDENTITY_ONLY')

      const cc = result.entities.find((e) => e.type === 'CREDIT_CARD')
      expect(cc).toBeDefined()
      expect(cc!.confidence).toBeGreaterThanOrEqual(0.99)
    })
  })
})
