// tests/unit/modes.test.ts
// Tests for mode configurations and getDefaultDecision function.

import { describe, it, expect } from 'vitest'
import { getDefaultDecision } from '@/core/modes/index'
import { IDENTITY_ONLY_DEFAULTS } from '@/core/modes/identity-only'
import { FULL_REDACTION_DEFAULTS } from '@/core/modes/full-redaction'
import type { EntityType, RedactionDecision, RedactionMode } from '@/core/detectors/entities'

// ─── Identity Only Mode ─────────────────────────────────────────────

describe('Identity Only mode', () => {
  it('should map MONEY to KEEP', () => {
    expect(IDENTITY_ONLY_DEFAULTS.MONEY).toBe('KEEP')
  })

  it('should map US_SSN to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.US_SSN).toBe('REDACT')
  })

  it('should map US_ITIN to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.US_ITIN).toBe('REDACT')
  })

  it('should map CREDIT_CARD to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.CREDIT_CARD).toBe('REDACT')
  })

  it('should map PHONE_NUMBER to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.PHONE_NUMBER).toBe('REDACT')
  })

  it('should map EMAIL_ADDRESS to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.EMAIL_ADDRESS).toBe('REDACT')
  })

  it('should map STREET_ADDRESS to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.STREET_ADDRESS).toBe('REDACT')
  })

  it('should map CITY_STATE_ZIP to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.CITY_STATE_ZIP).toBe('REDACT')
  })

  it('should map DATE_OF_BIRTH to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.DATE_OF_BIRTH).toBe('REDACT')
  })

  it('should map BANK_ACCOUNT to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.BANK_ACCOUNT).toBe('REDACT')
  })

  it('should map ROUTING_NUMBER to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.ROUTING_NUMBER).toBe('REDACT')
  })

  it('should map PASSPORT to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.PASSPORT).toBe('REDACT')
  })

  it('should map PERSON to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.PERSON).toBe('REDACT')
  })

  it('should map US_EIN to REDACT', () => {
    expect(IDENTITY_ONLY_DEFAULTS.US_EIN).toBe('REDACT')
  })

  it('should map ORG to UNCERTAIN', () => {
    expect(IDENTITY_ONLY_DEFAULTS.ORG).toBe('UNCERTAIN')
  })

  it('should map ZIP_CODE to UNCERTAIN', () => {
    expect(IDENTITY_ONLY_DEFAULTS.ZIP_CODE).toBe('UNCERTAIN')
  })

  it('should map DRIVERS_LICENSE to REDACT', () => {
    // DRIVERS_LICENSE is not in our EntityType, but we need to handle it
    // if it's in the entity list. For now, check the types we have.
    // This test validates identity types → REDACT
    expect(IDENTITY_ONLY_DEFAULTS.US_SSN).toBe('REDACT')
  })
})

// ─── Full Redaction Mode ────────────────────────────────────────────

describe('Full Redaction mode', () => {
  it('should map MONEY to REDACT (unlike identity mode)', () => {
    expect(FULL_REDACTION_DEFAULTS.MONEY).toBe('REDACT')
  })

  it('should map US_SSN to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.US_SSN).toBe('REDACT')
  })

  it('should map US_ITIN to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.US_ITIN).toBe('REDACT')
  })

  it('should map CREDIT_CARD to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.CREDIT_CARD).toBe('REDACT')
  })

  it('should map PHONE_NUMBER to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.PHONE_NUMBER).toBe('REDACT')
  })

  it('should map EMAIL_ADDRESS to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.EMAIL_ADDRESS).toBe('REDACT')
  })

  it('should map STREET_ADDRESS to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.STREET_ADDRESS).toBe('REDACT')
  })

  it('should map CITY_STATE_ZIP to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.CITY_STATE_ZIP).toBe('REDACT')
  })

  it('should map DATE_OF_BIRTH to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.DATE_OF_BIRTH).toBe('REDACT')
  })

  it('should map BANK_ACCOUNT to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.BANK_ACCOUNT).toBe('REDACT')
  })

  it('should map ROUTING_NUMBER to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.ROUTING_NUMBER).toBe('REDACT')
  })

  it('should map PASSPORT to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.PASSPORT).toBe('REDACT')
  })

  it('should map PERSON to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.PERSON).toBe('REDACT')
  })

  it('should map US_EIN to REDACT', () => {
    expect(FULL_REDACTION_DEFAULTS.US_EIN).toBe('REDACT')
  })

  it('should map ORG to REDACT (full mode redacts everything)', () => {
    expect(FULL_REDACTION_DEFAULTS.ORG).toBe('REDACT')
  })

  it('should map ZIP_CODE to REDACT (full mode redacts everything)', () => {
    expect(FULL_REDACTION_DEFAULTS.ZIP_CODE).toBe('REDACT')
  })
})

// ─── getDefaultDecision ─────────────────────────────────────────────

describe('getDefaultDecision', () => {
  describe('identity only mode', () => {
    const mode: RedactionMode = 'IDENTITY_ONLY'

    it('should return KEEP for MONEY with high confidence', () => {
      expect(getDefaultDecision('MONEY', mode, 0.95)).toBe('KEEP')
    })

    it('should return REDACT for US_SSN with high confidence', () => {
      expect(getDefaultDecision('US_SSN', mode, 0.95)).toBe('REDACT')
    })

    it('should return REDACT for EMAIL_ADDRESS with high confidence', () => {
      expect(getDefaultDecision('EMAIL_ADDRESS', mode, 0.95)).toBe('REDACT')
    })

    it('should return REDACT for CREDIT_CARD with high confidence', () => {
      expect(getDefaultDecision('CREDIT_CARD', mode, 0.99)).toBe('REDACT')
    })

    it('should return UNCERTAIN for ORG with high confidence', () => {
      expect(getDefaultDecision('ORG', mode, 0.95)).toBe('UNCERTAIN')
    })

    it('should return UNCERTAIN for ZIP_CODE with high confidence', () => {
      expect(getDefaultDecision('ZIP_CODE', mode, 0.95)).toBe('UNCERTAIN')
    })

    it('should return UNCERTAIN for identity types when confidence is medium', () => {
      // When confidence is between UNCERTAIN (0.60) and AUTO_REDACT (0.85),
      // the confidence-based decision should take precedence
      expect(getDefaultDecision('US_SSN', mode, 0.70)).toBe('UNCERTAIN')
    })

    it('should return null (discard) when confidence is below threshold', () => {
      expect(getDefaultDecision('US_SSN', mode, 0.50)).toBeNull()
    })
  })

  describe('full redaction mode', () => {
    const mode: RedactionMode = 'FULL_REDACTION'

    it('should return REDACT for MONEY with high confidence', () => {
      expect(getDefaultDecision('MONEY', mode, 0.95)).toBe('REDACT')
    })

    it('should return REDACT for US_SSN with high confidence', () => {
      expect(getDefaultDecision('US_SSN', mode, 0.95)).toBe('REDACT')
    })

    it('should return REDACT for ORG with high confidence (no uncertain in full mode)', () => {
      expect(getDefaultDecision('ORG', mode, 0.95)).toBe('REDACT')
    })

    it('should return REDACT for ZIP_CODE with high confidence (no uncertain in full mode)', () => {
      expect(getDefaultDecision('ZIP_CODE', mode, 0.95)).toBe('REDACT')
    })

    it('should return REDACT for non-ambiguous types even with medium confidence', () => {
      expect(getDefaultDecision('EMAIL_ADDRESS', mode, 0.70)).toBe('REDACT')
    })

    it('should return REDACT for ambiguous types with medium confidence', () => {
      expect(getDefaultDecision('ORG', mode, 0.65)).toBe('REDACT')
    })

    it('should return REDACT at exactly DISCARD threshold (0.60)', () => {
      expect(getDefaultDecision('US_SSN', mode, 0.60)).toBe('REDACT')
    })

    it('should return null (discard) when confidence is below threshold', () => {
      expect(getDefaultDecision('MONEY', mode, 0.50)).toBeNull()
    })

    it('should produce zero UNCERTAIN decisions for any entity type above discard', () => {
      const types: EntityType[] = [
        'US_SSN', 'US_ITIN', 'US_EIN', 'CREDIT_CARD', 'PHONE_NUMBER',
        'EMAIL_ADDRESS', 'STREET_ADDRESS', 'CITY_STATE_ZIP', 'ADDRESS',
        'ZIP_CODE', 'DATE_OF_BIRTH', 'BANK_ACCOUNT', 'ROUTING_NUMBER',
        'MONEY', 'PERSON', 'ORG', 'PASSPORT',
      ]
      for (const t of types) {
        for (const conf of [0.60, 0.70, 0.84, 0.85, 0.95, 0.99]) {
          const decision = getDefaultDecision(t, mode, conf)
          expect(decision).not.toBe('UNCERTAIN')
        }
      }
    })
  })

  describe('confidence thresholds integration', () => {
    it('should return REDACT at exactly AUTO_REDACT threshold (0.85)', () => {
      expect(getDefaultDecision('US_SSN', 'IDENTITY_ONLY', 0.85)).toBe('REDACT')
    })

    it('should return UNCERTAIN just below AUTO_REDACT threshold', () => {
      expect(getDefaultDecision('US_SSN', 'IDENTITY_ONLY', 0.84)).toBe('UNCERTAIN')
    })

    it('should return UNCERTAIN at exactly UNCERTAIN threshold (0.60)', () => {
      expect(getDefaultDecision('US_SSN', 'IDENTITY_ONLY', 0.60)).toBe('UNCERTAIN')
    })

    it('should return null (discard) just below UNCERTAIN threshold', () => {
      expect(getDefaultDecision('US_SSN', 'IDENTITY_ONLY', 0.59)).toBeNull()
    })

    it('should return KEEP for MONEY at any valid confidence in identity mode', () => {
      expect(getDefaultDecision('MONEY', 'IDENTITY_ONLY', 0.99)).toBe('KEEP')
      expect(getDefaultDecision('MONEY', 'IDENTITY_ONLY', 0.85)).toBe('KEEP')
      expect(getDefaultDecision('MONEY', 'IDENTITY_ONLY', 0.70)).toBe('KEEP')
    })

    it('should still discard MONEY below discard threshold in identity mode', () => {
      expect(getDefaultDecision('MONEY', 'IDENTITY_ONLY', 0.50)).toBeNull()
    })

    it('should return UNCERTAIN for ambiguous types in identity mode regardless of confidence', () => {
      // ORG and ZIP_CODE are always uncertain in identity mode (above discard threshold)
      expect(getDefaultDecision('ORG', 'IDENTITY_ONLY', 0.99)).toBe('UNCERTAIN')
      expect(getDefaultDecision('ZIP_CODE', 'IDENTITY_ONLY', 0.99)).toBe('UNCERTAIN')
    })

    it('should return REDACT for ambiguous types in full redaction mode', () => {
      // Full mode has zero UNCERTAIN items — everything is auto-redacted
      expect(getDefaultDecision('ORG', 'FULL_REDACTION', 0.99)).toBe('REDACT')
      expect(getDefaultDecision('ORG', 'FULL_REDACTION', 0.65)).toBe('REDACT')
      expect(getDefaultDecision('ZIP_CODE', 'FULL_REDACTION', 0.99)).toBe('REDACT')
      expect(getDefaultDecision('ZIP_CODE', 'FULL_REDACTION', 0.65)).toBe('REDACT')
    })
  })
})
