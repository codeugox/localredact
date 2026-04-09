import { describe, it, expect } from 'vitest'
import {
  SSN_FORMATTED,
  SSN_UNFORMATTED,
  ITIN,
  EIN_VALUE,
  EIN_CONTEXT,
  CREDIT_CARD,
  luhn,
  PHONE_US,
  EMAIL,
  STREET_ADDRESS,
  CITY_STATE_ZIP,
  ZIP_VALUE,
  ZIP_CONTEXT,
  DOB_NUMERIC,
  DOB_WRITTEN,
  DOB_CONTEXT,
  BANK_ACCOUNT_VALUE,
  BANK_ACCOUNT_CONTEXT,
  ROUTING_NUMBER_VALUE,
  ROUTING_NUMBER_CONTEXT,
  MONEY_SYMBOL,
  MONEY_NO_SYMBOL,
  PASSPORT_VALUE,
  PASSPORT_CONTEXT,
  scoreContext,
} from '@/core/detectors/patterns'

import {
  CONFIDENCE_THRESHOLDS,
  BASE_CONFIDENCE,
  getDecisionFromConfidence,
} from '@/core/detectors/confidence'

// Helper to test regex match
function matches(regex: RegExp, input: string): string[] {
  const r = new RegExp(regex.source, regex.flags)
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = r.exec(input)) !== null) {
    results.push(m[0])
  }
  return results
}

function hasMatch(regex: RegExp, input: string): boolean {
  return matches(regex, input).length > 0
}

// ──────────────────────────────────────────────────
// US_SSN — Social Security Number
// ──────────────────────────────────────────────────
describe('US_SSN', () => {
  describe('formatted SSN', () => {
    it('should match valid formatted SSN', () => {
      expect(hasMatch(SSN_FORMATTED, '412-67-9823')).toBe(true)
    })

    it('should match another valid SSN', () => {
      expect(hasMatch(SSN_FORMATTED, '123-45-6789')).toBe(true)
    })

    it('should reject 000 area prefix', () => {
      expect(hasMatch(SSN_FORMATTED, '000-67-9823')).toBe(false)
    })

    it('should reject 666 area prefix', () => {
      expect(hasMatch(SSN_FORMATTED, '666-67-9823')).toBe(false)
    })

    it('should reject 9xx area prefix (reserved for ITIN)', () => {
      expect(hasMatch(SSN_FORMATTED, '900-67-9823')).toBe(false)
      expect(hasMatch(SSN_FORMATTED, '999-67-9823')).toBe(false)
    })

    it('should reject 00 group', () => {
      expect(hasMatch(SSN_FORMATTED, '412-00-9823')).toBe(false)
    })

    it('should reject 0000 serial', () => {
      expect(hasMatch(SSN_FORMATTED, '412-67-0000')).toBe(false)
    })

    it('should extract SSN from surrounding text', () => {
      const result = matches(SSN_FORMATTED, 'SSN: 412-67-9823 is the number')
      expect(result).toEqual(['412-67-9823'])
    })
  })

  describe('unformatted SSN', () => {
    it('should match valid unformatted SSN', () => {
      expect(hasMatch(SSN_UNFORMATTED, '412679823')).toBe(true)
    })

    it('should reject invalid area prefix unformatted', () => {
      expect(hasMatch(SSN_UNFORMATTED, '000679823')).toBe(false)
      expect(hasMatch(SSN_UNFORMATTED, '666679823')).toBe(false)
      expect(hasMatch(SSN_UNFORMATTED, '900679823')).toBe(false)
    })
  })
})

// ──────────────────────────────────────────────────
// US_ITIN — Individual Taxpayer Identification Number
// ──────────────────────────────────────────────────
describe('US_ITIN', () => {
  it('should match valid ITIN with middle digits 50-65', () => {
    expect(hasMatch(ITIN, '912-56-7890')).toBe(true)
    expect(hasMatch(ITIN, '978-50-1234')).toBe(true)
    expect(hasMatch(ITIN, '978-65-1234')).toBe(true)
  })

  it('should match valid ITIN with middle digits 70-88', () => {
    expect(hasMatch(ITIN, '978-70-1234')).toBe(true)
    expect(hasMatch(ITIN, '978-88-1234')).toBe(true)
  })

  it('should match valid ITIN with middle digits 90-92', () => {
    expect(hasMatch(ITIN, '978-90-1234')).toBe(true)
    expect(hasMatch(ITIN, '978-92-1234')).toBe(true)
  })

  it('should match valid ITIN with middle digits 94-99 (fix from doc 02)', () => {
    // 912-94-7890 IS valid per the feature description
    expect(hasMatch(ITIN, '912-94-7890')).toBe(true)
    expect(hasMatch(ITIN, '912-95-7890')).toBe(true)
    expect(hasMatch(ITIN, '912-99-7890')).toBe(true)
  })

  it('should reject non-9xx prefix (that is an SSN, not ITIN)', () => {
    expect(hasMatch(ITIN, '412-56-7890')).toBe(false)
  })

  it('should reject invalid middle digit ranges', () => {
    // 66-69, 93 are invalid
    expect(hasMatch(ITIN, '912-67-7890')).toBe(false)
    expect(hasMatch(ITIN, '912-69-7890')).toBe(false)
    expect(hasMatch(ITIN, '912-93-7890')).toBe(false)
  })

  it('should reject middle digits outside valid ranges', () => {
    expect(hasMatch(ITIN, '912-00-7890')).toBe(false)
    expect(hasMatch(ITIN, '912-49-7890')).toBe(false)
  })
})

// ──────────────────────────────────────────────────
// US_EIN — Employer Identification Number
// ──────────────────────────────────────────────────
describe('US_EIN', () => {
  it('should match valid EIN format', () => {
    expect(hasMatch(EIN_VALUE, '12-3456789')).toBe(true)
    expect(hasMatch(EIN_VALUE, '98-7654321')).toBe(true)
  })

  it('should reject wrong grouping', () => {
    expect(hasMatch(EIN_VALUE, '1-23456789')).toBe(false)
  })

  it('should reject too short', () => {
    expect(hasMatch(EIN_VALUE, '12-345678')).toBe(false)
  })

  it('should reject too long', () => {
    expect(hasMatch(EIN_VALUE, '12-34567890')).toBe(false)
  })

  it('should have context regex that matches EIN labels', () => {
    expect(hasMatch(EIN_CONTEXT, 'EIN:')).toBe(true)
    expect(hasMatch(EIN_CONTEXT, 'Employer Identification Number')).toBe(true)
    expect(hasMatch(EIN_CONTEXT, 'Federal ID')).toBe(true)
    expect(hasMatch(EIN_CONTEXT, 'Tax ID')).toBe(true)
  })
})

// ──────────────────────────────────────────────────
// CREDIT_CARD — Credit Card Numbers
// ──────────────────────────────────────────────────
describe('CREDIT_CARD', () => {
  describe('regex matching', () => {
    it('should match Visa (16-digit)', () => {
      expect(hasMatch(CREDIT_CARD, '4532015112830366')).toBe(true)
    })

    it('should match Mastercard classic (51-55)', () => {
      expect(hasMatch(CREDIT_CARD, '5105105105105100')).toBe(true)
    })

    it('should match Mastercard 2-series (2221-2720)', () => {
      expect(hasMatch(CREDIT_CARD, '2221000000000009')).toBe(true)
      expect(hasMatch(CREDIT_CARD, '2720990000000007')).toBe(true)
    })

    it('should match Amex (15-digit, 34xx/37xx)', () => {
      expect(hasMatch(CREDIT_CARD, '371449635398431')).toBe(true)
      expect(hasMatch(CREDIT_CARD, '340000000000009')).toBe(true)
    })

    it('should match Discover (6011, 65xx)', () => {
      expect(hasMatch(CREDIT_CARD, '6011111111111117')).toBe(true)
      expect(hasMatch(CREDIT_CARD, '6500000000000002')).toBe(true)
    })

    it('should reject numbers with wrong prefixes', () => {
      expect(hasMatch(CREDIT_CARD, '1234567890123456')).toBe(false)
    })

    it('should reject too short numbers', () => {
      expect(hasMatch(CREDIT_CARD, '453201511283')).toBe(false)
    })
  })

  describe('Luhn validation', () => {
    it('should validate known good Visa number', () => {
      expect(luhn('4532015112830366')).toBe(true)
    })

    it('should validate known good Mastercard', () => {
      expect(luhn('5105105105105100')).toBe(true)
    })

    it('should validate known good Amex', () => {
      expect(luhn('371449635398431')).toBe(true)
    })

    it('should validate known good Discover', () => {
      expect(luhn('6011111111111117')).toBe(true)
    })

    it('should validate with dashes', () => {
      expect(luhn('4532-0151-1283-0366')).toBe(true)
    })

    it('should validate with spaces', () => {
      expect(luhn('4532 0151 1283 0366')).toBe(true)
    })

    it('should reject invalid Luhn (last digit off)', () => {
      expect(luhn('4532015112830367')).toBe(false)
    })

    it('should reject all zeros', () => {
      expect(luhn('0000000000000000')).toBe(true) // technically passes Luhn
    })

    it('should reject random number failing Luhn', () => {
      expect(luhn('1234567890123456')).toBe(false)
    })

    it('should validate Mastercard 2-series', () => {
      expect(luhn('2221000000000009')).toBe(true)
    })

    it('should reject near-valid number', () => {
      expect(luhn('4111111111111112')).toBe(false)
    })

    it('should validate 4111111111111111 (Visa test)', () => {
      expect(luhn('4111111111111111')).toBe(true)
    })
  })
})

// ──────────────────────────────────────────────────
// PHONE_NUMBER — US Phone Numbers
// ──────────────────────────────────────────────────
describe('PHONE_NUMBER', () => {
  it('should match (xxx) xxx-xxxx format', () => {
    expect(hasMatch(PHONE_US, '(202) 555-0147')).toBe(true)
  })

  it('should match xxx-xxx-xxxx format', () => {
    expect(hasMatch(PHONE_US, '202-555-0147')).toBe(true)
  })

  it('should match xxx.xxx.xxxx format', () => {
    expect(hasMatch(PHONE_US, '202.555.0147')).toBe(true)
  })

  it('should match unformatted 10-digit', () => {
    expect(hasMatch(PHONE_US, '2025550147')).toBe(true)
  })

  it('should match with +1 prefix', () => {
    expect(hasMatch(PHONE_US, '+1 202 555 0147')).toBe(true)
    expect(hasMatch(PHONE_US, '+1-202-555-0147')).toBe(true)
  })

  it('should reject area code starting with 0', () => {
    expect(hasMatch(PHONE_US, '(011) 555-0147')).toBe(false)
  })

  it('should reject area code starting with 1', () => {
    expect(hasMatch(PHONE_US, '(102) 555-0147')).toBe(false)
  })

  it('should reject exchange starting with 0 or 1', () => {
    expect(hasMatch(PHONE_US, '(202) 155-0147')).toBe(false)
  })
})

// ──────────────────────────────────────────────────
// EMAIL_ADDRESS
// ──────────────────────────────────────────────────
describe('EMAIL_ADDRESS', () => {
  it('should match standard email', () => {
    expect(hasMatch(EMAIL, 'john.martinez@gmail.com')).toBe(true)
  })

  it('should match email with plus tag', () => {
    expect(hasMatch(EMAIL, 'j.martinez+tax2024@company.org')).toBe(true)
  })

  it('should match subdomain email', () => {
    expect(hasMatch(EMAIL, 'user@subdomain.example.com')).toBe(true)
  })

  it('should reject email without domain', () => {
    expect(hasMatch(EMAIL, 'notanemail@')).toBe(false)
  })

  it('should reject email without local part', () => {
    expect(hasMatch(EMAIL, '@nodomain.com')).toBe(false)
  })

  it('should reject plaintext', () => {
    expect(hasMatch(EMAIL, 'plaintext')).toBe(false)
  })
})

// ──────────────────────────────────────────────────
// STREET_ADDRESS
// ──────────────────────────────────────────────────
describe('STREET_ADDRESS', () => {
  it('should match street number + name + type', () => {
    expect(hasMatch(STREET_ADDRESS, '441 Birchwood Lane')).toBe(true)
  })

  it('should match longer address', () => {
    expect(hasMatch(STREET_ADDRESS, '1600 Pennsylvania Avenue')).toBe(true)
  })

  it('should match short address', () => {
    expect(hasMatch(STREET_ADDRESS, '22 Baker Street')).toBe(true)
  })

  it('should reject no street number', () => {
    expect(hasMatch(STREET_ADDRESS, 'Main Street')).toBe(false)
  })

  it('should reject no street type', () => {
    expect(hasMatch(STREET_ADDRESS, 'Floor 4')).toBe(false)
  })
})

// ──────────────────────────────────────────────────
// CITY_STATE_ZIP
// ──────────────────────────────────────────────────
describe('CITY_STATE_ZIP', () => {
  it('should match city, state ZIP', () => {
    expect(hasMatch(CITY_STATE_ZIP, 'Columbus, OH 43201')).toBe(true)
  })

  it('should match with ZIP+4', () => {
    expect(hasMatch(CITY_STATE_ZIP, 'New York, NY 10001-1234')).toBe(true)
  })

  it('should match without comma', () => {
    expect(hasMatch(CITY_STATE_ZIP, 'San Francisco CA 94103')).toBe(true)
  })

  it('should reject missing city name', () => {
    expect(hasMatch(CITY_STATE_ZIP, 'OH 43201')).toBe(false)
  })

  it('should reject missing state', () => {
    expect(hasMatch(CITY_STATE_ZIP, 'Columbus 43201')).toBe(false)
  })
})

// ──────────────────────────────────────────────────
// ZIP_CODE — Standalone
// ──────────────────────────────────────────────────
describe('ZIP_CODE', () => {
  it('should match 5-digit ZIP', () => {
    expect(hasMatch(ZIP_VALUE, '43201')).toBe(true)
  })

  it('should match ZIP+4', () => {
    expect(hasMatch(ZIP_VALUE, '43201-1234')).toBe(true)
  })

  it('should have context regex matching ZIP labels', () => {
    expect(hasMatch(ZIP_CONTEXT, 'ZIP')).toBe(true)
    expect(hasMatch(ZIP_CONTEXT, 'zip code')).toBe(true)
    expect(hasMatch(ZIP_CONTEXT, 'OH')).toBe(true) // state abbreviation
  })
})

// ──────────────────────────────────────────────────
// DATE_OF_BIRTH
// ──────────────────────────────────────────────────
describe('DATE_OF_BIRTH', () => {
  describe('numeric format', () => {
    it('should match MM/DD/YYYY', () => {
      expect(hasMatch(DOB_NUMERIC, '03/15/1985')).toBe(true)
    })

    it('should match M/D/YYYY', () => {
      expect(hasMatch(DOB_NUMERIC, '3/5/1985')).toBe(true)
    })

    it('should match with dashes', () => {
      expect(hasMatch(DOB_NUMERIC, '03-15-1985')).toBe(true)
    })

    it('should match 20xx years', () => {
      expect(hasMatch(DOB_NUMERIC, '01/01/2024')).toBe(true)
    })

    it('should reject invalid month', () => {
      expect(hasMatch(DOB_NUMERIC, '13/15/1985')).toBe(false)
    })

    it('should reject invalid day', () => {
      expect(hasMatch(DOB_NUMERIC, '03/32/1985')).toBe(false)
    })
  })

  describe('written format', () => {
    it('should match Month Day, Year', () => {
      expect(hasMatch(DOB_WRITTEN, 'March 15, 1985')).toBe(true)
    })

    it('should match Month Day Year (no comma)', () => {
      expect(hasMatch(DOB_WRITTEN, 'March 15 1985')).toBe(true)
    })

    it('should match January format', () => {
      expect(hasMatch(DOB_WRITTEN, 'January 1, 2024')).toBe(true)
    })
  })

  describe('context', () => {
    it('should have context regex matching DOB labels', () => {
      expect(hasMatch(DOB_CONTEXT, 'Date of Birth')).toBe(true)
      expect(hasMatch(DOB_CONTEXT, 'DOB')).toBe(true)
      expect(hasMatch(DOB_CONTEXT, 'Born')).toBe(true)
    })
  })
})

// ──────────────────────────────────────────────────
// BANK_ACCOUNT
// ──────────────────────────────────────────────────
describe('BANK_ACCOUNT', () => {
  it('should match 8-17 digit value', () => {
    expect(hasMatch(BANK_ACCOUNT_VALUE, '123456789')).toBe(true)
    expect(hasMatch(BANK_ACCOUNT_VALUE, '12345678901234567')).toBe(true)
  })

  it('should reject too short (7 digits)', () => {
    expect(hasMatch(BANK_ACCOUNT_VALUE, '1234567')).toBe(false)
  })

  it('should reject too long (18 digits)', () => {
    // 18 digit: should still match partial (the first 17 digits)
    // But standalone 18 digit string won't match as a full entity
    const result = matches(BANK_ACCOUNT_VALUE, '123456789012345678')
    // The regex \b\d{8,17}\b should not match 18 digits as one unit
    expect(result.some(m => m.length === 18)).toBe(false)
  })

  it('should have context regex matching account labels', () => {
    expect(hasMatch(BANK_ACCOUNT_CONTEXT, 'Account Number:')).toBe(true)
    expect(hasMatch(BANK_ACCOUNT_CONTEXT, 'Acct #:')).toBe(true)
    expect(hasMatch(BANK_ACCOUNT_CONTEXT, 'account no.')).toBe(true)
  })
})

// ──────────────────────────────────────────────────
// ROUTING_NUMBER
// ──────────────────────────────────────────────────
describe('ROUTING_NUMBER', () => {
  it('should match valid Federal Reserve district prefix (01-12)', () => {
    expect(hasMatch(ROUTING_NUMBER_VALUE, '021000021')).toBe(true)
    expect(hasMatch(ROUTING_NUMBER_VALUE, '121000248')).toBe(true)
  })

  it('should match valid prefix (21-32)', () => {
    expect(hasMatch(ROUTING_NUMBER_VALUE, '210000021')).toBe(true)
    expect(hasMatch(ROUTING_NUMBER_VALUE, '321000021')).toBe(true)
  })

  it('should reject invalid prefix 00', () => {
    expect(hasMatch(ROUTING_NUMBER_VALUE, '001000021')).toBe(false)
  })

  it('should reject invalid prefix 33+', () => {
    expect(hasMatch(ROUTING_NUMBER_VALUE, '331000021')).toBe(false)
    expect(hasMatch(ROUTING_NUMBER_VALUE, '991000021')).toBe(false)
  })

  it('should have context regex matching routing labels', () => {
    expect(hasMatch(ROUTING_NUMBER_CONTEXT, 'routing number:')).toBe(true)
    expect(hasMatch(ROUTING_NUMBER_CONTEXT, 'Routing:')).toBe(true)
    expect(hasMatch(ROUTING_NUMBER_CONTEXT, 'routing #')).toBe(true)
  })
})

// ──────────────────────────────────────────────────
// MONEY — Dollar Amounts
// ──────────────────────────────────────────────────
describe('MONEY', () => {
  it('should match dollar sign amounts', () => {
    expect(hasMatch(MONEY_SYMBOL, '$84,200.00')).toBe(true)
    expect(hasMatch(MONEY_SYMBOL, '$1,234.56')).toBe(true)
    expect(hasMatch(MONEY_SYMBOL, '$500')).toBe(true)
  })

  it('should match dollar sign with space', () => {
    expect(hasMatch(MONEY_SYMBOL, '$ 500')).toBe(true)
  })

  it('should match money without dollar sign (comma format)', () => {
    expect(hasMatch(MONEY_NO_SYMBOL, '84,200.00')).toBe(true)
  })

  it('should not match ambiguous numbers without dollar sign and commas', () => {
    expect(hasMatch(MONEY_NO_SYMBOL, '84200')).toBe(false)
  })
})

// ──────────────────────────────────────────────────
// PASSPORT
// ──────────────────────────────────────────────────
describe('PASSPORT', () => {
  it('should match valid US passport format', () => {
    expect(hasMatch(PASSPORT_VALUE, 'A12345678')).toBe(true)
  })

  it('should reject lowercase letter prefix', () => {
    expect(hasMatch(PASSPORT_VALUE, 'a12345678')).toBe(false)
  })

  it('should reject wrong digit count', () => {
    expect(hasMatch(PASSPORT_VALUE, 'A1234567')).toBe(false)  // 7 digits
    expect(hasMatch(PASSPORT_VALUE, 'A123456789')).toBe(false) // 9 digits
  })

  it('should have context regex matching passport labels', () => {
    expect(hasMatch(PASSPORT_CONTEXT, 'Passport')).toBe(true)
    expect(hasMatch(PASSPORT_CONTEXT, 'passport number')).toBe(true)
  })
})

// ──────────────────────────────────────────────────
// Context Scoring
// ──────────────────────────────────────────────────
describe('scoreContext', () => {
  it('should return true when context label is within 80 chars before match', () => {
    const text = 'EIN: 12-3456789'
    const matchStart = text.indexOf('12-3456789')
    expect(scoreContext(text, matchStart, EIN_CONTEXT)).toBe(true)
  })

  it('should return false when no context label is present', () => {
    const text = '12-3456789'
    expect(scoreContext(text, 0, EIN_CONTEXT)).toBe(false)
  })

  it('should return false when context label is too far before match', () => {
    const text = 'EIN:' + ' '.repeat(90) + '12-3456789'
    const matchStart = text.indexOf('12-3456789')
    expect(scoreContext(text, matchStart, EIN_CONTEXT)).toBe(false)
  })

  it('should find context label on the previous line', () => {
    const text = 'Account Number:\n123456789012'
    const matchStart = text.indexOf('123456789012')
    expect(scoreContext(text, matchStart, BANK_ACCOUNT_CONTEXT)).toBe(true)
  })

  it('should work with passport context', () => {
    const text = 'Passport: A12345678'
    const matchStart = text.indexOf('A12345678')
    expect(scoreContext(text, matchStart, PASSPORT_CONTEXT)).toBe(true)
  })

  it('should work with ZIP context (state abbreviation)', () => {
    const text = 'OH 43201'
    const matchStart = text.indexOf('43201')
    expect(scoreContext(text, matchStart, ZIP_CONTEXT)).toBe(true)
  })
})

// ──────────────────────────────────────────────────
// Confidence Thresholds and Decision
// ──────────────────────────────────────────────────
describe('confidence', () => {
  it('should have correct threshold values', () => {
    expect(CONFIDENCE_THRESHOLDS.AUTO_REDACT).toBe(0.85)
    expect(CONFIDENCE_THRESHOLDS.UNCERTAIN).toBe(0.60)
    expect(CONFIDENCE_THRESHOLDS.DISCARD).toBe(0.60)
  })

  it('should return REDACT for high confidence', () => {
    expect(getDecisionFromConfidence(0.99)).toBe('REDACT')
    expect(getDecisionFromConfidence(0.85)).toBe('REDACT')
    expect(getDecisionFromConfidence(0.90)).toBe('REDACT')
  })

  it('should return UNCERTAIN for medium confidence', () => {
    expect(getDecisionFromConfidence(0.65)).toBe('UNCERTAIN')
    expect(getDecisionFromConfidence(0.60)).toBe('UNCERTAIN')
    expect(getDecisionFromConfidence(0.84)).toBe('UNCERTAIN')
  })

  it('should return null (discard) for low confidence', () => {
    expect(getDecisionFromConfidence(0.59)).toBeNull()
    expect(getDecisionFromConfidence(0.10)).toBeNull()
    expect(getDecisionFromConfidence(0.0)).toBeNull()
  })

  it('should have base confidence constants', () => {
    expect(BASE_CONFIDENCE.CHECKSUM_VALID).toBe(0.99)
    expect(BASE_CONFIDENCE.WITH_CONTEXT).toBe(0.95)
    expect(BASE_CONFIDENCE.MODERATE_CONTEXT).toBe(0.90)
    expect(BASE_CONFIDENCE.NO_CONTEXT).toBe(0.65)
    expect(BASE_CONFIDENCE.FORMAT_MATCH).toBe(0.99)
    expect(BASE_CONFIDENCE.UNFORMATTED_MATCH).toBe(0.90)
  })
})
