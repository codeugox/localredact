// src/core/detectors/merger.ts
// Entity merger: deduplicates exact matches, resolves overlapping spans,
// and merges adjacent matches of the same type.

import type { DetectedEntity } from './entities'

/** Maximum gap (in characters) between entities to consider them adjacent. */
const ADJACENT_GAP_THRESHOLD = 3

/**
 * Check whether two text offset ranges overlap.
 * [startA, endA) and [startB, endB) overlap if startA < endB && startB < endA.
 */
function offsetsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number }
): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * Check whether two entities on the same page are adjacent (within ADJACENT_GAP_THRESHOLD chars).
 * Adjacent means end of first entity is at or near start of second entity.
 */
function areAdjacent(
  a: { start: number; end: number },
  b: { start: number; end: number }
): boolean {
  // a comes before b
  if (a.end <= b.start && b.start - a.end <= ADJACENT_GAP_THRESHOLD) return true
  // b comes before a
  if (b.end <= a.start && a.start - b.end <= ADJACENT_GAP_THRESHOLD) return true
  return false
}

/**
 * Merge two adjacent entities of the same type into one.
 * Takes the higher confidence, combines quads and text, spans the full offset range.
 * When there is a gap between the two spans, preserves a space separator to avoid
 * collapsed text like "JohnMartinez" instead of "John Martinez".
 */
function mergeAdjacent(a: DetectedEntity, b: DetectedEntity, normalizedText?: string): DetectedEntity {
  // Ensure a comes first
  const first = a.textOffset.start <= b.textOffset.start ? a : b
  const second = a.textOffset.start <= b.textOffset.start ? b : a

  // Determine separator between the two spans
  let separator = ''
  if (first.textOffset.end < second.textOffset.start) {
    if (normalizedText) {
      // Use the actual characters between the two offsets from the normalized string
      separator = normalizedText.slice(first.textOffset.end, second.textOffset.start)
    } else {
      // Fallback: insert a space when there is a gap between adjacent spans
      separator = ' '
    }
  }

  return {
    id: first.id,
    type: first.type,
    text: first.text + separator + second.text,
    layer: first.layer,
    confidence: Math.max(first.confidence, second.confidence),
    decision: first.confidence >= second.confidence ? first.decision : second.decision,
    page: first.page,
    textOffset: {
      start: first.textOffset.start,
      end: second.textOffset.end,
    },
    quads: [...first.quads, ...second.quads],
  }
}

/**
 * Merge entities by deduplicating exact matches, resolving overlapping spans
 * (keeping higher confidence), and merging adjacent matches of the same type.
 *
 * Only entities on the same page are considered for merging.
 * Entities on different pages are never merged.
 *
 * @param entities - Array of detected entities
 * @param normalizedTexts - Optional map of page number → normalized page string,
 *   used to preserve separator characters (spaces, newlines) when merging adjacent spans
 * @returns Merged array of entities
 */
export function mergeEntities(
  entities: ReadonlyArray<DetectedEntity>,
  normalizedTexts?: ReadonlyMap<number, string>
): DetectedEntity[] {
  if (entities.length === 0) return []
  if (entities.length === 1) return [{ ...entities[0] }]

  // Group entities by page
  const byPage = new Map<number, DetectedEntity[]>()
  for (const entity of entities) {
    const pageEntities = byPage.get(entity.page) ?? []
    pageEntities.push({ ...entity })
    byPage.set(entity.page, pageEntities)
  }

  const result: DetectedEntity[] = []

  for (const [, pageEntities] of byPage) {
    // Step 1: Exact dedup — same page, same textOffset → keep highest confidence
    const deduped = deduplicateExact(pageEntities)

    // Step 2: Resolve overlapping spans — keep higher confidence
    const resolved = resolveOverlaps(deduped)

    // Step 3: Merge adjacent same-type entities
    const pageText = normalizedTexts?.get(pageEntities[0].page)
    const merged = mergeAdjacentEntities(resolved, pageText)

    result.push(...merged)
  }

  return result
}

/**
 * Remove exact duplicate entities (same page, same textOffset).
 * When duplicates exist, keep the one with highest confidence.
 */
function deduplicateExact(entities: DetectedEntity[]): DetectedEntity[] {
  const map = new Map<string, DetectedEntity>()

  for (const entity of entities) {
    const key = `${entity.textOffset.start}:${entity.textOffset.end}`
    const existing = map.get(key)
    if (!existing || entity.confidence > existing.confidence) {
      map.set(key, entity)
    }
  }

  return Array.from(map.values())
}

/**
 * Resolve overlapping spans: when two entities overlap, keep the one with higher confidence.
 * Uses a greedy approach: sort by confidence descending, then mark regions as taken.
 */
function resolveOverlaps(entities: DetectedEntity[]): DetectedEntity[] {
  if (entities.length <= 1) return entities

  // Sort by confidence descending — highest confidence first
  const sorted = [...entities].sort((a, b) => b.confidence - a.confidence)

  const kept: DetectedEntity[] = []

  for (const entity of sorted) {
    const overlaps = kept.some((kept) =>
      offsetsOverlap(kept.textOffset, entity.textOffset)
    )
    if (!overlaps) {
      kept.push(entity)
    }
  }

  // Sort back by textOffset.start for consistent ordering
  kept.sort((a, b) => a.textOffset.start - b.textOffset.start)

  return kept
}

/**
 * Merge adjacent entities of the same type into a single entity.
 * Entities must be on the same page and within ADJACENT_GAP_THRESHOLD chars of each other.
 */
function mergeAdjacentEntities(entities: DetectedEntity[], normalizedText?: string): DetectedEntity[] {
  if (entities.length <= 1) return entities

  // Sort by textOffset.start
  const sorted = [...entities].sort((a, b) => a.textOffset.start - b.textOffset.start)

  const merged: DetectedEntity[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    if (
      current.type === last.type &&
      areAdjacent(last.textOffset, current.textOffset)
    ) {
      // Merge adjacent same-type entities
      merged[merged.length - 1] = mergeAdjacent(last, current, normalizedText)
    } else {
      merged.push(current)
    }
  }

  return merged
}
