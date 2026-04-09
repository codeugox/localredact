// tests/unit/merger.test.ts
// Tests for entity merger: exact dedup, overlapping spans, adjacent merge, different pages.

import { describe, it, expect } from 'vitest'
import { mergeEntities } from '@/core/detectors/merger'
import type { DetectedEntity, Quad } from '@/core/detectors/entities'

// ─── Helpers ────────────────────────────────────────────────────────

let idCounter = 0

/** Create a DetectedEntity with sensible defaults. */
function makeEntity(overrides: Partial<DetectedEntity> = {}): DetectedEntity {
  idCounter++
  return {
    id: `entity-${idCounter}`,
    type: 'US_SSN',
    text: '123-45-6789',
    layer: 'REGEX',
    confidence: 0.95,
    decision: 'REDACT',
    page: 1,
    textOffset: { start: 0, end: 11 },
    quads: [[10, 10, 100, 10, 100, 22, 10, 22]] as Quad[],
    ...overrides,
  }
}

// ─── Exact Dedup ────────────────────────────────────────────────────

describe('mergeEntities', () => {
  describe('exact deduplication', () => {
    it('should remove exact duplicate entities (same page, same textOffset)', () => {
      const entities = [
        makeEntity({ page: 1, textOffset: { start: 0, end: 11 }, confidence: 0.95 }),
        makeEntity({ page: 1, textOffset: { start: 0, end: 11 }, confidence: 0.95 }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
    })

    it('should keep both entities when textOffset differs', () => {
      const entities = [
        makeEntity({ page: 1, textOffset: { start: 0, end: 11 } }),
        makeEntity({ page: 1, textOffset: { start: 20, end: 31 } }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(2)
    })

    it('should keep the entity with higher confidence when deduplicating', () => {
      const entities = [
        makeEntity({ page: 1, textOffset: { start: 0, end: 11 }, confidence: 0.80 }),
        makeEntity({ page: 1, textOffset: { start: 0, end: 11 }, confidence: 0.95 }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].confidence).toBe(0.95)
    })

    it('should deduplicate multiple copies of the same entity', () => {
      const entities = [
        makeEntity({ page: 1, textOffset: { start: 5, end: 16 }, confidence: 0.90 }),
        makeEntity({ page: 1, textOffset: { start: 5, end: 16 }, confidence: 0.85 }),
        makeEntity({ page: 1, textOffset: { start: 5, end: 16 }, confidence: 0.95 }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].confidence).toBe(0.95)
    })
  })

  // ─── Overlapping Spans ──────────────────────────────────────────

  describe('overlapping span resolution', () => {
    it('should resolve overlapping spans — keep higher confidence', () => {
      const entities = [
        makeEntity({
          page: 1,
          textOffset: { start: 0, end: 15 },
          confidence: 0.90,
          type: 'US_SSN',
        }),
        makeEntity({
          page: 1,
          textOffset: { start: 5, end: 20 },
          confidence: 0.95,
          type: 'US_EIN',
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].confidence).toBe(0.95)
      expect(result[0].type).toBe('US_EIN')
    })

    it('should keep lower-confidence entity if it does not overlap', () => {
      const entities = [
        makeEntity({
          page: 1,
          textOffset: { start: 0, end: 10 },
          confidence: 0.80,
        }),
        makeEntity({
          page: 1,
          textOffset: { start: 50, end: 60 },
          confidence: 0.95,
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(2)
    })

    it('should resolve contained span — keep the one with higher confidence', () => {
      // Entity B is fully contained within Entity A
      const entities = [
        makeEntity({
          page: 1,
          textOffset: { start: 0, end: 30 },
          confidence: 0.85,
          type: 'STREET_ADDRESS',
        }),
        makeEntity({
          page: 1,
          textOffset: { start: 5, end: 15 },
          confidence: 0.95,
          type: 'US_SSN',
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].confidence).toBe(0.95)
    })

    it('should handle multiple overlapping entities on the same page', () => {
      const entities = [
        makeEntity({
          page: 1,
          textOffset: { start: 0, end: 15 },
          confidence: 0.80,
        }),
        makeEntity({
          page: 1,
          textOffset: { start: 10, end: 25 },
          confidence: 0.90,
        }),
        makeEntity({
          page: 1,
          textOffset: { start: 20, end: 35 },
          confidence: 0.85,
        }),
      ]

      const result = mergeEntities(entities)
      // The first overlaps with second → second wins (0.90).
      // The second overlaps with third → second wins (0.90).
      // Only one remains.
      expect(result).toHaveLength(1)
      expect(result[0].confidence).toBe(0.90)
    })
  })

  // ─── Adjacent Merge ───────────────────────────────────────────

  describe('adjacent match merging', () => {
    it('should merge adjacent matches of the same type', () => {
      const entities = [
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: '441 Birchwood',
          textOffset: { start: 0, end: 14 },
          confidence: 0.90,
          quads: [[10, 10, 80, 10, 80, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Lane',
          textOffset: { start: 14, end: 18 },
          confidence: 0.92,
          quads: [[80, 10, 110, 10, 110, 22, 80, 22]],
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('STREET_ADDRESS')
      // Merged entity should have quads from both
      expect(result[0].quads).toHaveLength(2)
      // Text should be combined
      expect(result[0].text).toBe('441 BirchwoodLane')
    })

    it('should merge adjacent matches with a small gap (within 3 chars)', () => {
      const entities = [
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: '441 Birchwood',
          textOffset: { start: 0, end: 14 },
          confidence: 0.90,
          quads: [[10, 10, 80, 10, 80, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Lane',
          textOffset: { start: 15, end: 19 },
          confidence: 0.92,
          quads: [[82, 10, 110, 10, 110, 22, 82, 22]],
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('STREET_ADDRESS')
    })

    it('should NOT merge adjacent matches of different types', () => {
      const entities = [
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: '441 Birchwood Lane',
          textOffset: { start: 0, end: 18 },
          confidence: 0.90,
        }),
        makeEntity({
          page: 1,
          type: 'CITY_STATE_ZIP',
          text: 'Columbus, OH 43201',
          textOffset: { start: 19, end: 37 },
          confidence: 0.92,
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(2)
    })

    it('should use highest confidence from merged entities', () => {
      const entities = [
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Part A',
          textOffset: { start: 0, end: 6 },
          confidence: 0.85,
          quads: [[10, 10, 50, 10, 50, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Part B',
          textOffset: { start: 6, end: 12 },
          confidence: 0.95,
          quads: [[50, 10, 90, 10, 90, 22, 50, 22]],
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].confidence).toBe(0.95)
    })

    it('should update textOffset to span from first start to last end', () => {
      const entities = [
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Part A',
          textOffset: { start: 10, end: 16 },
          confidence: 0.90,
          quads: [[10, 10, 50, 10, 50, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Part B',
          textOffset: { start: 17, end: 23 },
          confidence: 0.88,
          quads: [[52, 10, 90, 10, 90, 22, 52, 22]],
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].textOffset.start).toBe(10)
      expect(result[0].textOffset.end).toBe(23)
    })
  })

  // ─── Different Pages ──────────────────────────────────────────

  describe('different pages', () => {
    it('should NOT merge entities on different pages even if same offset', () => {
      const entities = [
        makeEntity({
          page: 1,
          textOffset: { start: 0, end: 11 },
          confidence: 0.95,
        }),
        makeEntity({
          page: 2,
          textOffset: { start: 0, end: 11 },
          confidence: 0.95,
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(2)
    })

    it('should NOT merge adjacent entities on different pages', () => {
      const entities = [
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: '441 Birchwood Lane',
          textOffset: { start: 0, end: 18 },
          confidence: 0.90,
        }),
        makeEntity({
          page: 2,
          type: 'STREET_ADDRESS',
          text: 'Columbus, OH',
          textOffset: { start: 18, end: 30 },
          confidence: 0.92,
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(2)
    })

    it('should NOT resolve overlapping entities on different pages', () => {
      const entities = [
        makeEntity({
          page: 1,
          textOffset: { start: 0, end: 15 },
          confidence: 0.80,
        }),
        makeEntity({
          page: 2,
          textOffset: { start: 10, end: 25 },
          confidence: 0.95,
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(2)
    })
  })

  // ─── Edge Cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = mergeEntities([])
      expect(result).toHaveLength(0)
    })

    it('should handle single entity', () => {
      const entities = [makeEntity()]
      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
    })

    it('should not mutate the original array', () => {
      const entities = [
        makeEntity({ page: 1, textOffset: { start: 0, end: 11 } }),
        makeEntity({ page: 1, textOffset: { start: 0, end: 11 } }),
      ]
      const original = [...entities]
      mergeEntities(entities)
      expect(entities).toHaveLength(original.length)
    })

    it('should handle entities with touching but non-overlapping offsets', () => {
      // Entity A: [0, 10), Entity B: [10, 20) — they touch but don't overlap
      // They should NOT be resolved as overlapping, but SHOULD be merged if same type
      const entities = [
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Part A',
          textOffset: { start: 0, end: 10 },
          confidence: 0.90,
          quads: [[10, 10, 50, 10, 50, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Part B',
          textOffset: { start: 10, end: 20 },
          confidence: 0.88,
          quads: [[50, 10, 90, 10, 90, 22, 50, 22]],
        }),
      ]

      const result = mergeEntities(entities)
      // Adjacent same-type should merge
      expect(result).toHaveLength(1)
      expect(result[0].textOffset.start).toBe(0)
      expect(result[0].textOffset.end).toBe(20)
    })
  })

  // ─── Separator Preservation (Regression) ────────────────────

  describe('separator preservation when merging adjacent spans', () => {
    it('should preserve space between adjacent spans when normalizedTexts is provided', () => {
      // Simulates "John Martinez" where "John" and "Martinez" are detected separately
      // Normalized string: "John Martinez" (offset 0–13)
      const normalizedTexts = new Map<number, string>()
      normalizedTexts.set(1, 'John Martinez')

      const entities = [
        makeEntity({
          page: 1,
          type: 'PERSON',
          text: 'John',
          textOffset: { start: 0, end: 4 },
          confidence: 0.90,
          quads: [[10, 10, 40, 10, 40, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'PERSON',
          text: 'Martinez',
          textOffset: { start: 5, end: 13 },
          confidence: 0.88,
          quads: [[42, 10, 90, 10, 90, 22, 42, 22]],
        }),
      ]

      const result = mergeEntities(entities, normalizedTexts)
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('John Martinez')
      expect(result[0].textOffset.start).toBe(0)
      expect(result[0].textOffset.end).toBe(13)
    })

    it('should preserve newline between adjacent spans on different lines', () => {
      // Simulates "441 Birchwood Lane\nColumbus, OH 43201"
      const normalizedTexts = new Map<number, string>()
      normalizedTexts.set(1, '441 Birchwood Lane\nColumbus, OH 43201')

      const entities = [
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: '441 Birchwood Lane',
          textOffset: { start: 0, end: 18 },
          confidence: 0.90,
          quads: [[10, 10, 130, 10, 130, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'STREET_ADDRESS',
          text: 'Columbus, OH 43201',
          textOffset: { start: 19, end: 37 },
          confidence: 0.92,
          quads: [[10, 30, 130, 30, 130, 42, 10, 42]],
        }),
      ]

      const result = mergeEntities(entities, normalizedTexts)
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('441 Birchwood Lane\nColumbus, OH 43201')
    })

    it('should fall back to space when normalizedTexts is not provided and gap exists', () => {
      // No normalizedTexts — mergeAdjacent should insert ' ' fallback for gaps
      const entities = [
        makeEntity({
          page: 1,
          type: 'PERSON',
          text: 'John',
          textOffset: { start: 0, end: 4 },
          confidence: 0.90,
          quads: [[10, 10, 40, 10, 40, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'PERSON',
          text: 'Martinez',
          textOffset: { start: 5, end: 13 },
          confidence: 0.88,
          quads: [[42, 10, 90, 10, 90, 22, 42, 22]],
        }),
      ]

      const result = mergeEntities(entities)
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('John Martinez')
    })

    it('should NOT insert separator when spans are touching (no gap)', () => {
      // Offsets: [0,4) and [4,12) — touching, no gap
      const normalizedTexts = new Map<number, string>()
      normalizedTexts.set(1, 'JohnMartinez')

      const entities = [
        makeEntity({
          page: 1,
          type: 'PERSON',
          text: 'John',
          textOffset: { start: 0, end: 4 },
          confidence: 0.90,
          quads: [[10, 10, 40, 10, 40, 22, 10, 22]],
        }),
        makeEntity({
          page: 1,
          type: 'PERSON',
          text: 'Martinez',
          textOffset: { start: 4, end: 12 },
          confidence: 0.88,
          quads: [[40, 10, 90, 10, 90, 22, 40, 22]],
        }),
      ]

      const result = mergeEntities(entities, normalizedTexts)
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('JohnMartinez')
    })
  })
})
