// src/core/modes/full-redaction.ts
// Mode configuration for Full Redaction mode.
// Full mode redacts ALL detected PII types — zero user review required.
// getDefaultDecision short-circuits in FULL_REDACTION mode so these
// defaults are not consulted, but they are kept consistent at REDACT.

import type { EntityType, RedactionDecision } from '../detectors/entities'

/**
 * Default redaction decisions for Full Redaction mode.
 *
 * Every entity type → REDACT. No UNCERTAIN items exist in this mode.
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
  ORG: 'REDACT',
  ZIP_CODE: 'REDACT',
}
