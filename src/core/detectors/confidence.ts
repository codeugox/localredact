// src/core/detectors/confidence.ts
// Confidence thresholds and scoring functions for entity detection.

/**
 * Confidence thresholds for automatic decision assignment.
 * - AUTO_REDACT: entities at or above this are automatically marked REDACT
 * - UNCERTAIN: entities between DISCARD and AUTO_REDACT are UNCERTAIN
 * - DISCARD: entities below this are dropped entirely
 */
export const CONFIDENCE_THRESHOLDS = {
  AUTO_REDACT: 0.85,
  UNCERTAIN: 0.60,
  DISCARD: 0.60,
} as const

/**
 * Base confidence scores for different match scenarios.
 */
export const BASE_CONFIDENCE = {
  /** Regex match with checksum validation (e.g., Luhn for credit cards) */
  CHECKSUM_VALID: 0.99,
  /** Regex match with strong context label present */
  WITH_CONTEXT: 0.95,
  /** Regex match with moderate context */
  MODERATE_CONTEXT: 0.90,
  /** Regex match without context (higher false positive risk) */
  NO_CONTEXT: 0.65,
  /** Inherently high-confidence format match (e.g., email, SSN formatted) */
  FORMAT_MATCH: 0.99,
  /** Unformatted match with higher ambiguity */
  UNFORMATTED_MATCH: 0.90,
} as const

/**
 * Given a confidence score, determine the default redaction decision.
 * - >= AUTO_REDACT threshold → 'REDACT'
 * - >= UNCERTAIN threshold → 'UNCERTAIN'
 * - below DISCARD threshold → null (entity should be dropped)
 */
export function getDecisionFromConfidence(
  confidence: number
): 'REDACT' | 'UNCERTAIN' | null {
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_REDACT) {
    return 'REDACT'
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.UNCERTAIN) {
    return 'UNCERTAIN'
  }
  return null // below discard threshold, drop entity
}
