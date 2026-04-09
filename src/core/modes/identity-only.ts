// src/core/modes/identity-only.ts
// Mode configuration for Identity Only redaction mode.
// Identity mode redacts identity PII types but keeps MONEY visible.
// Ambiguous types (ORG, ZIP_CODE) are marked UNCERTAIN for user review.

import type { EntityType, RedactionDecision } from '../detectors/entities'

/**
 * Default redaction decisions for Identity Only mode.
 *
 * - Identity types (SSN, ITIN, EIN, etc.) → REDACT
 * - Financial amounts (MONEY) → KEEP
 * - Ambiguous types (ORG, ZIP_CODE) → UNCERTAIN
 */
export const IDENTITY_ONLY_DEFAULTS: Record<EntityType, RedactionDecision> = {
  US_SSN: 'REDACT',
  US_ITIN: 'REDACT',
  US_EIN: 'REDACT',
  CREDIT_CARD: 'REDACT',
  PHONE_NUMBER: 'REDACT',
  EMAIL_ADDRESS: 'REDACT',
  STREET_ADDRESS: 'REDACT',
  CITY_STATE_ZIP: 'REDACT',
  DATE_OF_BIRTH: 'REDACT',
  BANK_ACCOUNT: 'REDACT',
  ROUTING_NUMBER: 'REDACT',
  PASSPORT: 'REDACT',
  PERSON: 'REDACT',
  MONEY: 'KEEP',
  ORG: 'UNCERTAIN',
  ZIP_CODE: 'UNCERTAIN',
}
