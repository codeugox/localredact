// src/core/text-index.ts
// Text index layer: builds normalized page string from PDF.js TextItem array,
// records char-to-source-item mapping, and resolves match offsets to quads.

import type { Quad } from './detectors/entities'

// ─── Types ──────────────────────────────────────────────────────────

/**
 * Represents a single text item from PDF.js getTextContent().
 * Use disableNormalization: true with getTextContent.
 */
export interface TextItem {
  str: string
  /** 6-element PDF transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY] */
  transform: number[]
  width: number
  height: number
  hasEOL: boolean
}

/**
 * Maps a range in the normalized page string back to a specific
 * substring within a specific PDF.js text item.
 * Supports partial-item matches (e.g., only the number in "SSN: 123-45-6789").
 */
export interface CharMapEntry {
  /** Start index in normalized page string (inclusive) */
  normStart: number
  /** End index in normalized page string (exclusive) */
  normEnd: number
  /** Index into the items array, or null for synthetic whitespace/newlines */
  itemIndex: number | null
  /** Start index within item.str (inclusive) */
  itemCharStart?: number
  /** End index within item.str (exclusive) */
  itemCharEnd?: number
}

/**
 * Result of indexing a single page.
 */
export interface IndexedPage {
  pageNum: number
  /** Normalized full-page string */
  text: string
  /** Per-segment mapping from normalized string ranges to source items */
  charMap: CharMapEntry[]
  /** Original text items (deduplicated, reading-order sorted) */
  items: TextItem[]
  viewport: { width: number; height: number }
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Extract x position from transform matrix */
function getX(item: TextItem): number {
  return item.transform[4]
}

/** Extract y position from transform matrix */
function getY(item: TextItem): number {
  return item.transform[5]
}

/**
 * Deduplicate items that share the same position regardless of text content.
 * Some PDFs emit duplicate text items at the same coordinates (sometimes with
 * slightly different strings, e.g., bolded overlays). Using position-only
 * dedup keys ensures we keep only one item per position.
 */
function deduplicateItems(items: TextItem[]): TextItem[] {
  const seen = new Set<string>()
  const result: TextItem[] = []

  for (const item of items) {
    const key = `${getX(item).toFixed(2)}|${getY(item).toFixed(2)}|${item.width.toFixed(2)}|${item.height.toFixed(2)}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }

  return result
}

/**
 * Compute the median height of items (used for y-clustering tolerance).
 */
function medianHeight(items: TextItem[]): number {
  if (items.length === 0) return 12

  const heights = items
    .filter((item) => item.height > 0)
    .map((item) => item.height)
    .sort((a, b) => a - b)

  if (heights.length === 0) return 12

  const mid = Math.floor(heights.length / 2)
  return heights.length % 2 === 0
    ? (heights[mid - 1] + heights[mid]) / 2
    : heights[mid]
}

/**
 * Sort items in reading order:
 * 1. Cluster by y-position (with ~30% median height tolerance)
 * 2. Sort by x within each cluster
 * 3. Higher y first (PDF coordinate system: origin bottom-left, y up)
 */
function sortByReadingOrder(items: TextItem[]): TextItem[] {
  if (items.length <= 1) return [...items]

  const tolerance = medianHeight(items) * 0.3

  // Group items into line clusters by y-position
  const clusters: TextItem[][] = []
  const sorted = [...items].sort((a, b) => getY(b) - getY(a)) // higher y first

  for (const item of sorted) {
    const y = getY(item)
    let placed = false

    for (const cluster of clusters) {
      const clusterY = getY(cluster[0])
      if (Math.abs(y - clusterY) <= tolerance) {
        cluster.push(item)
        placed = true
        break
      }
    }

    if (!placed) {
      clusters.push([item])
    }
  }

  // Sort clusters by y descending (top of page first in PDF space)
  clusters.sort((a, b) => getY(b[0]) - getY(a[0]))

  // Sort items within each cluster by x ascending (left to right)
  for (const cluster of clusters) {
    cluster.sort((a, b) => getX(a) - getX(b))
  }

  return clusters.flat()
}

// ─── indexPage ──────────────────────────────────────────────────────

/**
 * Build a normalized page string from PDF.js TextItem array.
 *
 * - Concatenates item.str values
 * - Inserts synthetic spaces based on x-gap between items
 * - Inserts synthetic newlines based on y-position changes
 * - Records CharMapEntry[] mapping char ranges back to source items
 *
 * @param items - TextItem array from PDF.js getTextContent
 * @param viewport - Page viewport dimensions
 * @param pageNum - 1-indexed page number (defaults to 1)
 * @returns IndexedPage with normalized text and char-to-item mapping
 */
export function indexPage(
  items: TextItem[],
  viewport: { width: number; height: number },
  pageNum: number = 1
): IndexedPage {
  if (items.length === 0) {
    return { pageNum, text: '', charMap: [], items: [], viewport }
  }

  // Step 1: Deduplicate
  const dedupedItems = deduplicateItems(items)

  // Step 2: Sort in reading order
  const sortedItems = sortByReadingOrder(dedupedItems)

  // Step 3: Build normalized string and charMap
  const charMap: CharMapEntry[] = []
  let text = ''
  let offset = 0

  const tolerance = medianHeight(sortedItems) * 0.3

  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i]

    // Skip empty string items
    if (item.str.length === 0) continue

    // Check if we need synthetic whitespace before this item
    if (i > 0) {
      const prevItem = sortedItems[i - 1]

      // Skip if previous item had empty string
      if (prevItem.str.length === 0) {
        // Still might need newline check
      }

      const prevY = getY(prevItem)
      const currY = getY(item)
      const yDiff = Math.abs(prevY - currY)

      const prevHadEOL = prevItem.hasEOL

      if (prevHadEOL || yDiff > tolerance) {
        // Different line — insert synthetic newline
        charMap.push({
          normStart: offset,
          normEnd: offset + 1,
          itemIndex: null,
        })
        text += '\n'
        offset += 1
      } else {
        // Same line — check for x-gap to insert synthetic space
        const prevEnd = getX(prevItem) + prevItem.width
        const currStart = getX(item)
        const gap = currStart - prevEnd

        // Insert space only if there's a meaningful gap
        // Use a small threshold relative to item height
        const spaceThreshold = medianHeight(sortedItems) * 0.15
        if (gap > spaceThreshold) {
          charMap.push({
            normStart: offset,
            normEnd: offset + 1,
            itemIndex: null,
          })
          text += ' '
          offset += 1
        }
      }
    }

    // Add the item's text to the normalized string
    const itemStart = offset
    text += item.str
    offset += item.str.length

    // Record charMap entry mapping this range to the item
    // Use the original index in sortedItems for charMap
    const originalIndex = i
    charMap.push({
      normStart: itemStart,
      normEnd: offset,
      itemIndex: originalIndex,
      itemCharStart: 0,
      itemCharEnd: item.str.length,
    })
  }

  return {
    pageNum,
    text,
    charMap,
    items: sortedItems,
    viewport,
  }
}

// ─── resolveMatchToQuads ────────────────────────────────────────────

/**
 * Map a {start, end} offset in the normalized string to Quad[] using the charMap.
 * Produces proportional sub-quads for partial item matches.
 *
 * @param match - Character offset range in the normalized page string
 * @param page - IndexedPage from indexPage()
 * @returns Array of Quads in PDF coordinate space
 */
export function resolveMatchToQuads(
  match: { start: number; end: number },
  page: IndexedPage
): Quad[] {
  if (match.start >= match.end) return []

  const quads: Quad[] = []

  for (const entry of page.charMap) {
    // Skip entries that don't overlap with the match
    if (entry.normEnd <= match.start || entry.normStart >= match.end) continue

    // Skip synthetic whitespace — no geometry
    if (entry.itemIndex === null) continue

    const item = page.items[entry.itemIndex]
    if (!item) continue

    // Compute the overlap between the match and this charMap entry
    const overlapStart = Math.max(match.start, entry.normStart)
    const overlapEnd = Math.min(match.end, entry.normEnd)

    // Map the overlap back to character positions within the item
    const entryLength = entry.normEnd - entry.normStart
    const itemCharStart = entry.itemCharStart ?? 0
    const itemCharEnd = entry.itemCharEnd ?? item.str.length
    const itemCharLength = itemCharEnd - itemCharStart

    // Character fraction within the item
    const startFraction =
      (overlapStart - entry.normStart) / entryLength
    const endFraction = (overlapEnd - entry.normStart) / entryLength

    // Compute sub-item character bounds
    const subCharStart = itemCharStart + startFraction * itemCharLength
    const subCharEnd = itemCharStart + endFraction * itemCharLength

    // Convert to proportional position within the item's width
    const totalChars = item.str.length
    const xFractionStart = subCharStart / totalChars
    const xFractionEnd = subCharEnd / totalChars

    const itemX = getX(item)
    const itemY = getY(item)
    const itemW = item.width
    const itemH = item.height

    // Build quad in PDF coordinate space
    // PDF space: origin bottom-left, Y up
    // Corners: bottomLeft, bottomRight, topRight, topLeft
    const x1 = itemX + xFractionStart * itemW
    const x2 = itemX + xFractionEnd * itemW
    const yBottom = itemY
    const yTop = itemY + itemH

    const quad: Quad = [
      x1, yBottom,     // bottom-left
      x2, yBottom,     // bottom-right
      x2, yTop,        // top-right
      x1, yTop,        // top-left
    ]

    quads.push(quad)
  }

  return quads
}
