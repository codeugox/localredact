// src/core/modes/full-redaction.ts
// Mode configuration for Full Redaction mode.
// Full mode redacts all detected PII types including MONEY.
// Ambiguous types (ORG, ZIP_CODE) are still marked UNCERTAIN for user review.

import type { EntityType, RedactionDecision } from '../detectors/entities'

/**
 * Default redaction decisions for Full Redaction mode.
 *
 * - All PII types including MONEY → REDACT
 * - Ambiguous types (ORG, ZIP_CODE) → UNCERTAIN
 */
export const FULL_REDACTION_DEFAULTS: Record<EntityType, RedactionDecision> = {
  US_SSN: 'REDACT',
  US_ITIN: 'REDACT',
  US_EIN: 'REDACT',
  CREDIT_CARD: 'REDACT',
  PHONE_NUMBER: 'REDACT',
  EMAIL_ADDRESS: 'REDACT',
  STREET_ADDRESS: 'REDACT',
  CITY_STATE_ZIP: 'REDACT',
  ADDRESS: 'REDACT',
  DATE_OF_BIRTH: 'REDACT',
  BANK_ACCOUNT: 'REDACT',
  ROUTING_NUMBER: 'REDACT',
  PASSPORT: 'REDACT',
  PERSON: 'REDACT',
  MONEY: 'REDACT',
  ORG: 'UNCERTAIN',
  ZIP_CODE: 'UNCERTAIN',
}
