// src/core/detectors/entities.ts
// All type definitions for the detection layer.

/**
 * All supported PII entity types.
 * 16 types covering identity, financial, contact, and document PII.
 */
export type EntityType =
  | 'US_SSN'
  | 'US_ITIN'
  | 'US_EIN'
  | 'CREDIT_CARD'
  | 'PHONE_NUMBER'
  | 'EMAIL_ADDRESS'
  | 'STREET_ADDRESS'
  | 'CITY_STATE_ZIP'
  | 'ADDRESS'
  | 'ZIP_CODE'
  | 'DATE_OF_BIRTH'
  | 'BANK_ACCOUNT'
  | 'ROUTING_NUMBER'
  | 'MONEY'
  | 'PERSON'
  | 'ORG'
  | 'PASSPORT'

/**
 * Redaction decision for an entity.
 * - REDACT: will be blacked out in output
 * - KEEP: will remain visible in output
 * - UNCERTAIN: requires user resolution before download
 */
export type RedactionDecision = 'REDACT' | 'KEEP' | 'UNCERTAIN'

/**
 * Redaction mode selected by user.
 * - IDENTITY_ONLY: redacts identity PII, keeps financial amounts
 * - FULL_REDACTION: redacts all detected PII
 */
export type RedactionMode = 'IDENTITY_ONLY' | 'FULL_REDACTION'

/**
 * Detection layer that produced the entity.
 * - REGEX: regex + checksum based detection (v1.0)
 * - NER: ONNX NER model detection (v1.1)
 */
export type DetectionLayer = 'REGEX' | 'NER'

/**
 * Four corners in PDF coordinate space (bottom-left origin, Y up).
 * Format: [x1,y1, x2,y2, x3,y3, x4,y4]
 */
export type Quad = [number, number, number, number, number, number, number, number]

/**
 * Character offset range in the normalized page string.
 */
export interface TextOffset {
  start: number
  end: number
}

/**
 * A detected PII entity with type, confidence, geometry, and decision.
 */
export interface DetectedEntity {
  /** Unique ID for tying overlay rects to entity */
  id: string
  /** PII type classification */
  type: EntityType
  /** The actual matched text from the document */
  text: string
  /** Which detection layer produced this entity */
  layer: DetectionLayer
  /** Confidence score 0.0 to 1.0 */
  confidence: number
  /** Redaction decision: set by mode defaults, overridable by user */
  decision: RedactionDecision
  /** 1-indexed page number */
  page: number
  /** Character positions in the normalized page string */
  textOffset: TextOffset
  /** One or more quads in PDF coordinate space */
  quads: Quad[]
}
