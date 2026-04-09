// tests/unit/text-index.test.ts
// Tests for the text index layer: indexPage and resolveMatchToQuads

import { describe, it, expect } from 'vitest'
import {
  indexPage,
  resolveMatchToQuads,
  type CharMapEntry,
  type IndexedPage,
  type TextItem,
} from '@/core/text-index'
import type { Quad } from '@/core/detectors/entities'

// ─── Helpers ────────────────────────────────────────────────────────

/** Build a minimal TextItem for testing. */
function makeItem(
  str: string,
  x: number,
  y: number,
  width: number,
  height: number = 12,
  hasEOL: boolean = false
): TextItem {
  // PDF transform matrix: [scaleX, 0, 0, scaleY, translateX, translateY]
  return {
    str,
    transform: [1, 0, 0, 1, x, y],
    width,
    height,
    hasEOL,
  }
}

const defaultViewport = { width: 612, height: 792 }

// ─── indexPage ──────────────────────────────────────────────────────

describe('indexPage', () => {
  it('should concatenate single item into normalized string', () => {
    const items = [makeItem('Hello World', 50, 700, 100)]
    const page = indexPage(items, defaultViewport)

    expect(page.text).toBe('Hello World')
    expect(page.charMap.length).toBeGreaterThan(0)
    expect(page.items).toEqual(items)
  })

  it('should insert synthetic space between items on the same line with x-gap', () => {
    // Two items on the same y, with a gap between them
    const items = [
      makeItem('SSN:', 50, 700, 30),
      makeItem('123-45-6789', 90, 700, 80),
    ]
    const page = indexPage(items, defaultViewport)

    expect(page.text).toBe('SSN: 123-45-6789')
    // The space between SSN: and 123-45-6789 should have itemIndex null
    const spaceEntry = page.charMap.find(
      (e) => e.itemIndex === null && page.text[e.normStart] === ' '
    )
    expect(spaceEntry).toBeDefined()
  })

  it('should insert synthetic newline when y-position changes', () => {
    // Two items on different y positions (different lines)
    const items = [
      makeItem('Line one', 50, 700, 60),
      makeItem('Line two', 50, 680, 60),
    ]
    const page = indexPage(items, defaultViewport)

    expect(page.text).toContain('Line one')
    expect(page.text).toContain('Line two')
    expect(page.text).toContain('\n')
  })

  it('should handle partial-item match mapping (value within item)', () => {
    // A single item contains both label and value: "SSN: 123-45-6789"
    const items = [makeItem('SSN: 123-45-6789', 50, 700, 160)]
    const page = indexPage(items, defaultViewport)

    expect(page.text).toBe('SSN: 123-45-6789')

    // Find the charMap entry covering "123-45-6789" (starts at index 5)
    const matchStart = page.text.indexOf('123-45-6789')
    expect(matchStart).toBe(5)

    // The entry covering this range should point back to item 0 with
    // itemCharStart/itemCharEnd matching the substring position
    const covering = page.charMap.find(
      (e) => e.normStart <= matchStart && e.normEnd > matchStart
    )
    expect(covering).toBeDefined()
    expect(covering!.itemIndex).toBe(0)
  })

  it('should mark synthetic whitespace entries with itemIndex null', () => {
    const items = [
      makeItem('Hello', 50, 700, 40),
      makeItem('World', 100, 700, 40),
    ]
    const page = indexPage(items, defaultViewport)

    const syntheticEntries = page.charMap.filter((e) => e.itemIndex === null)
    expect(syntheticEntries.length).toBeGreaterThan(0)
  })

  it('should sort items by reading order: cluster by y then sort by x', () => {
    // Items out of order: second line item first, then first line item
    const items = [
      makeItem('Second', 50, 680, 50),
      makeItem('First', 50, 700, 40),
    ]
    const page = indexPage(items, defaultViewport)

    // "First" should come before "Second" in the normalized string
    const firstIdx = page.text.indexOf('First')
    const secondIdx = page.text.indexOf('Second')
    expect(firstIdx).toBeLessThan(secondIdx)
  })

  it('should cluster items by y-position with tolerance', () => {
    // Items that are close in y (within ~30% of median height) should be on the same line
    const items = [
      makeItem('Same', 50, 700, 30),
      makeItem('Line', 90, 701, 30), // 1px difference in y — same line
    ]
    const page = indexPage(items, defaultViewport)

    // They should be on one line with a space between them, not separated by newline
    expect(page.text).not.toContain('\n')
    expect(page.text).toContain('Same')
    expect(page.text).toContain('Line')
  })

  it('should handle hasEOL flag — insert newline when set', () => {
    const items = [
      makeItem('Line one', 50, 700, 60, 12, true),
      makeItem('Line two', 50, 700, 60, 12, false),
    ]
    const page = indexPage(items, defaultViewport)

    expect(page.text).toContain('Line one')
    expect(page.text).toContain('Line two')
    // hasEOL should cause a newline between items even if y is same
    expect(page.text).toContain('\n')
  })

  it('should deduplicate items at same position', () => {
    const items = [
      makeItem('Duplicate', 50, 700, 60),
      makeItem('Duplicate', 50, 700, 60),
    ]
    const page = indexPage(items, defaultViewport)

    // Should appear only once
    expect(page.text).toBe('Duplicate')
  })

  it('should handle empty items array', () => {
    const page = indexPage([], defaultViewport)
    expect(page.text).toBe('')
    expect(page.charMap).toEqual([])
  })

  it('should handle items with empty strings', () => {
    const items = [
      makeItem('', 50, 700, 0),
      makeItem('Hello', 60, 700, 40),
    ]
    const page = indexPage(items, defaultViewport)

    expect(page.text).toContain('Hello')
  })

  it('should produce correct charMap for multi-item single line', () => {
    const items = [
      makeItem('441', 50, 700, 20),
      makeItem('Birchwood', 80, 700, 60),
      makeItem('Lane', 150, 700, 30),
    ]
    const page = indexPage(items, defaultViewport)

    expect(page.text).toContain('441')
    expect(page.text).toContain('Birchwood')
    expect(page.text).toContain('Lane')

    // Each real item should have at least one charMap entry
    const itemEntries = page.charMap.filter((e) => e.itemIndex !== null)
    expect(itemEntries.length).toBe(3)
  })

  it('should produce charMap for multi-line content', () => {
    const items = [
      makeItem('441 Birchwood Lane', 50, 700, 120),
      makeItem('Columbus, OH 43201', 50, 680, 120),
    ]
    const page = indexPage(items, defaultViewport)

    expect(page.text).toContain('441 Birchwood Lane')
    expect(page.text).toContain('Columbus, OH 43201')
    expect(page.text).toContain('\n')
  })

  it('should not insert extra space when items are adjacent (no gap)', () => {
    // Items that are right next to each other should not have a synthetic space
    const items = [
      makeItem('Hello', 50, 700, 40),
      makeItem('World', 90, 700, 40), // starts exactly at 50 + 40
    ]
    const page = indexPage(items, defaultViewport)

    // Should be directly concatenated without extra space
    expect(page.text).toBe('HelloWorld')
  })

  it('should handle pageNum and viewport in returned IndexedPage', () => {
    const items = [makeItem('Test', 50, 700, 30)]
    const page = indexPage(items, defaultViewport, 5)

    expect(page.pageNum).toBe(5)
    expect(page.viewport).toEqual(defaultViewport)
  })
})

// ─── resolveMatchToQuads ────────────────────────────────────────────

describe('resolveMatchToQuads', () => {
  it('should resolve a single-item match to one quad', () => {
    const items = [makeItem('123-45-6789', 50, 700, 100, 12)]
    const page = indexPage(items, defaultViewport)

    const quads = resolveMatchToQuads({ start: 0, end: 11 }, page)

    expect(quads.length).toBe(1)
    // The quad should cover the entire item
    const [x1, y1, x2, y2, x3, y3, x4, y4] = quads[0]
    expect(x1).toBeCloseTo(50, 0)
    expect(y1).toBeCloseTo(700, 0)
    expect(x2).toBeCloseTo(150, 0)  // 50 + 100
    expect(y2).toBeCloseTo(700, 0)
  })

  it('should resolve a partial-item match to a proportional sub-quad', () => {
    // "SSN: 123-45-6789" — only match "123-45-6789"
    const items = [makeItem('SSN: 123-45-6789', 50, 700, 160, 12)]
    const page = indexPage(items, defaultViewport)

    const matchStart = page.text.indexOf('123-45-6789')
    const matchEnd = matchStart + '123-45-6789'.length
    const quads = resolveMatchToQuads({ start: matchStart, end: matchEnd }, page)

    expect(quads.length).toBe(1)
    // The quad should be proportionally offset and sized
    const [x1, , x2] = quads[0]
    // "SSN: " is 5 chars out of 16 total, so offset fraction = 5/16
    // "123-45-6789" is 11 chars, so width fraction = 11/16
    const expectedX1 = 50 + (5 / 16) * 160
    const expectedX2 = 50 + (16 / 16) * 160
    expect(x1).toBeCloseTo(expectedX1, 0)
    expect(x2).toBeCloseTo(expectedX2, 0)
  })

  it('should resolve a multi-item single-line match to one quad per item', () => {
    const items = [
      makeItem('441', 50, 700, 20, 12),
      makeItem('Birchwood', 80, 700, 60, 12),
      makeItem('Lane', 150, 700, 30, 12),
    ]
    const page = indexPage(items, defaultViewport)

    // Match the entire address "441 Birchwood Lane"
    const matchStart = page.text.indexOf('441')
    const matchEnd = page.text.indexOf('Lane') + 'Lane'.length
    const quads = resolveMatchToQuads({ start: matchStart, end: matchEnd }, page)

    // Should produce one quad per item (3 items)
    expect(quads.length).toBe(3)
  })

  it('should resolve a multi-line match to quads on separate lines', () => {
    const items = [
      makeItem('441 Birchwood Lane', 50, 700, 120, 12),
      makeItem('Columbus, OH 43201', 50, 680, 120, 12),
    ]
    const page = indexPage(items, defaultViewport)

    // Match the full address across both lines
    const matchStart = page.text.indexOf('441')
    const matchEnd = page.text.indexOf('43201') + '43201'.length
    const quads = resolveMatchToQuads({ start: matchStart, end: matchEnd }, page)

    // Should produce one quad per line item
    expect(quads.length).toBe(2)

    // Quads should have different y positions
    const y1 = quads[0][1]
    const y2 = quads[1][1]
    expect(y1).not.toBeCloseTo(y2, 0)
  })

  it('should skip synthetic whitespace (produce no geometry)', () => {
    const items = [
      makeItem('Hello', 50, 700, 40, 12),
      makeItem('World', 100, 700, 40, 12),
    ]
    const page = indexPage(items, defaultViewport)

    // Match just the space (synthetic) — should produce no quads
    const spaceIdx = page.text.indexOf(' ')
    if (spaceIdx >= 0) {
      const quads = resolveMatchToQuads(
        { start: spaceIdx, end: spaceIdx + 1 },
        page
      )
      expect(quads.length).toBe(0)
    }
  })

  it('should handle a match spanning item boundary', () => {
    // "Hello Wo" + "rld" — match "World" which spans items
    const items = [
      makeItem('Hello Wo', 50, 700, 60, 12),
      makeItem('rld', 120, 700, 25, 12),
    ]
    const page = indexPage(items, defaultViewport)

    // "World" spans the boundary: "Wo" in first item, "rld" in second
    const matchStart = page.text.indexOf('Wo')
    const matchEnd = page.text.indexOf('rld') + 'rld'.length
    const quads = resolveMatchToQuads({ start: matchStart, end: matchEnd }, page)

    // Should produce two quads (one per item involved)
    expect(quads.length).toBe(2)
  })

  it('should return empty quads for empty match range', () => {
    const items = [makeItem('Hello', 50, 700, 40, 12)]
    const page = indexPage(items, defaultViewport)

    const quads = resolveMatchToQuads({ start: 0, end: 0 }, page)
    expect(quads.length).toBe(0)
  })

  it('should produce correct quad corners (PDF space: bottom-left origin)', () => {
    const items = [makeItem('Test', 100, 500, 40, 12)]
    const page = indexPage(items, defaultViewport)

    const quads = resolveMatchToQuads({ start: 0, end: 4 }, page)
    expect(quads.length).toBe(1)

    // Quad corners: bottomLeft, bottomRight, topRight, topLeft
    const [x1, y1, x2, y2, x3, y3, x4, y4] = quads[0]
    // Bottom-left corner
    expect(x1).toBeCloseTo(100, 0)
    expect(y1).toBeCloseTo(500, 0)
    // Bottom-right corner
    expect(x2).toBeCloseTo(140, 0) // 100 + 40
    expect(y2).toBeCloseTo(500, 0)
    // Top-right corner
    expect(x3).toBeCloseTo(140, 0)
    expect(y3).toBeCloseTo(512, 0) // 500 + 12
    // Top-left corner
    expect(x4).toBeCloseTo(100, 0)
    expect(y4).toBeCloseTo(512, 0)
  })
})
