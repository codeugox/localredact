// src/core/modes/index.ts
// Mode configuration exports and getDefaultDecision function.

import type { EntityType, RedactionDecision, RedactionMode } from '../detectors/entities'
import { CONFIDENCE_THRESHOLDS } from '../detectors/confidence'
import { IDENTITY_ONLY_DEFAULTS } from './identity-only'
import { FULL_REDACTION_DEFAULTS } from './full-redaction'

export { IDENTITY_ONLY_DEFAULTS } from './identity-only'
export { FULL_REDACTION_DEFAULTS } from './full-redaction'

/** Map of mode to its default decision table. */
const MODE_DEFAULTS: Record<RedactionMode, Record<EntityType, RedactionDecision>> = {
  IDENTITY_ONLY: IDENTITY_ONLY_DEFAULTS,
  FULL_REDACTION: FULL_REDACTION_DEFAULTS,
}

/** Set of entity types that are always UNCERTAIN regardless of confidence. */
const AMBIGUOUS_TYPES: ReadonlySet<EntityType> = new Set(['ORG', 'ZIP_CODE'])

/**
 * Get the default redaction decision for an entity based on its type,
 * the active mode, and the confidence score.
 *
 * Decision logic:
 * 1. If confidence is below DISCARD threshold → null (entity should be dropped)
 * 2. FULL_REDACTION mode: everything above discard threshold → REDACT
 *    (no UNCERTAIN items — the whole point of full mode is zero user review)
 * 3. IDENTITY_ONLY mode:
 *    a. If entity type is ambiguous (ORG, ZIP_CODE) → UNCERTAIN
 *    b. If mode defaults the type to KEEP (e.g., MONEY) → KEEP
 *    c. If confidence >= AUTO_REDACT threshold → use mode's default
 *    d. Otherwise → UNCERTAIN
 *
 * @param type - The entity's PII type
 * @param mode - The active redaction mode
 * @param confidence - The confidence score (0.0 to 1.0)
 * @returns The redaction decision, or null if the entity should be discarded
 */
export function getDefaultDecision(
  type: EntityType,
  mode: RedactionMode,
  confidence: number
): RedactionDecision | null {
  // Below discard threshold → drop entity entirely
  if (confidence < CONFIDENCE_THRESHOLDS.DISCARD) {
    return null
  }

  // FULL_REDACTION mode: everything above discard → REDACT (zero amber items)
  if (mode === 'FULL_REDACTION') {
    return 'REDACT'
  }

  // ── IDENTITY_ONLY mode logic ──────────────────────────────────

  // Ambiguous types are always UNCERTAIN (above discard threshold)
  if (AMBIGUOUS_TYPES.has(type)) {
    return 'UNCERTAIN'
  }

  const modeDefault = MODE_DEFAULTS[mode][type]

  // If mode says KEEP for this type (e.g., MONEY in identity mode), always KEEP
  if (modeDefault === 'KEEP') {
    return 'KEEP'
  }

  // High confidence → use the mode's default (REDACT for most types)
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_REDACT) {
    return modeDefault
  }

  // Medium confidence → UNCERTAIN (user must decide)
  return 'UNCERTAIN'
}
