// src/core/detectors/patterns.ts
// All 16 regex detection patterns with context-sensitive value/label split.
// Each pattern exports a value regex and optional context regex (per Revision 8).

// ──────────────────────────────────────────────────
// US_SSN — Social Security Number
// ──────────────────────────────────────────────────

/**
 * Formatted SSN: XXX-XX-XXXX
 * Rejects 000, 666, 9xx area; 00 group; 0000 serial.
 */
export const SSN_FORMATTED =
  /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g

/**
 * Unformatted SSN: XXXXXXXXX (9 digits, no separators)
 * Same validity rules as formatted.
 */
export const SSN_UNFORMATTED =
  /\b(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}\b/g

// ──────────────────────────────────────────────────
// US_ITIN — Individual Taxpayer Identification Number
// ──────────────────────────────────────────────────

/**
 * ITIN: 9XX-XX-XXXX where middle digits are in ranges:
 * 50-65, 70-88, 90-92, 94-99
 * Note: 912-94-7890 IS valid (middle 94-99 accepted per doc 02 fix).
 */
export const ITIN =
  /\b9\d{2}-(?:5[0-9]|6[0-5]|7[0-9]|8[0-8]|9[0-2]|9[4-9])-\d{4}\b/g

// ──────────────────────────────────────────────────
// US_EIN — Employer Identification Number
// ──────────────────────────────────────────────────

/** EIN value: XX-XXXXXXX (2 digits, dash, 7 digits) */
export const EIN_VALUE =
  /\b\d{2}-\d{7}\b/g

/** EIN context labels for confidence boosting */
export const EIN_CONTEXT =
  /(?:EIN|Employer\s+Identification\s+Number|Federal\s+ID|Tax\s+ID)\b/gi

// ──────────────────────────────────────────────────
// CREDIT_CARD — Credit Card Numbers
// ──────────────────────────────────────────────────

/**
 * Credit card regex per Revision 8:
 * - Visa: 4xxx (13 or 16 digit)
 * - Mastercard classic: 51xx-55xx (16 digit)
 * - Mastercard 2-series: 2221-2720 (16 digit)
 * - Amex: 34xx, 37xx (15 digit)
 * - Discover: 6011, 65xx (16 digit)
 *
 * All matches must pass Luhn validation.
 */
export const CREDIT_CARD =
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|2(?:2[2-9][1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[01][0-9]|720)[0-9]{12}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g

/**
 * Luhn algorithm validator for credit card numbers.
 * Strips non-digit characters before validation.
 */
export function luhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, '').split('').reverse().map(Number)
  const sum = digits.reduce((acc, digit, i) => {
    if (i % 2 !== 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    return acc + digit
  }, 0)
  return sum % 10 === 0
}

// ──────────────────────────────────────────────────
// PHONE_NUMBER — US Phone Numbers
// ──────────────────────────────────────────────────

/**
 * US phone number in various formats.
 * Area code and exchange cannot start with 0 or 1.
 */
export const PHONE_US =
  /\b(?:\+1[-.\s]?)?\(?([2-9][0-9]{2})\)?[-.\s]?([2-9][0-9]{2})[-.\s]?([0-9]{4})\b/g

// ──────────────────────────────────────────────────
// EMAIL_ADDRESS
// ──────────────────────────────────────────────────

/** Standard email pattern — not RFC-5322 compliant but covers real documents */
export const EMAIL =
  /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g

// ──────────────────────────────────────────────────
// STREET_ADDRESS
// ──────────────────────────────────────────────────

/**
 * Matches street number + name + type.
 * Common US street type suffixes included.
 */
export const STREET_ADDRESS =
  /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Way|Place|Pl|Terrace|Ter|Highway|Hwy)\.?\b/gi

// ──────────────────────────────────────────────────
// CITY_STATE_ZIP
// ──────────────────────────────────────────────────

/** City name, state abbreviation, ZIP code */
export const CITY_STATE_ZIP =
  /\b[A-Z][a-zA-Z\s]{2,20},?\s+(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}(?:-\d{4})?\b/g

// ──────────────────────────────────────────────────
// ZIP_CODE — Standalone (context-sensitive)
// ──────────────────────────────────────────────────

/** ZIP value: 5 digits with optional +4 */
export const ZIP_VALUE =
  /\b\d{5}(?:-\d{4})?\b/g

/** ZIP context: ZIP label or adjacent state abbreviation */
export const ZIP_CONTEXT =
  /(?:ZIP(?:\s*code)?|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/gi

// ──────────────────────────────────────────────────
// DATE_OF_BIRTH (context-sensitive)
// ──────────────────────────────────────────────────

/** Numeric date: MM/DD/YYYY or MM-DD-YYYY */
export const DOB_NUMERIC =
  /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}\b/g

/** Written date: Month Day, Year */
export const DOB_WRITTEN =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi

/** DOB context labels */
export const DOB_CONTEXT =
  /(?:Date\s+of\s+Birth|DOB|Born)\b/gi

// ──────────────────────────────────────────────────
// BANK_ACCOUNT (context-sensitive per Revision 8)
// ──────────────────────────────────────────────────

/** Bank account value: 8-17 digit number */
export const BANK_ACCOUNT_VALUE =
  /\b\d{8,17}\b/g

/** Bank account context labels */
export const BANK_ACCOUNT_CONTEXT =
  /(?:account\s*(?:number|#|no\.?)?:?\s*|acct\s*(?:#|no\.?)?:?\s*)/gi

// ──────────────────────────────────────────────────
// ROUTING_NUMBER (context-sensitive)
// ──────────────────────────────────────────────────

/**
 * Routing number value: 9 digits with valid Federal Reserve district prefix.
 * Valid prefixes: 01-12, 21-32
 */
export const ROUTING_NUMBER_VALUE =
  /\b(?:0[1-9]|1[0-2]|2[1-9]|3[0-2])\d{7}\b/g

/** Routing number context labels */
export const ROUTING_NUMBER_CONTEXT =
  /(?:routing\s*(?:number|#|no\.?)?:?\s*)/gi

// ──────────────────────────────────────────────────
// MONEY — Dollar Amounts
// ──────────────────────────────────────────────────

/** Dollar amounts with $ symbol */
export const MONEY_SYMBOL =
  /\$\s?[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?\b/g

/** Dollar amounts without $ symbol (requires comma thousands separator + decimal) */
export const MONEY_NO_SYMBOL =
  /\b[0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2}\b/g

// ──────────────────────────────────────────────────
// PASSPORT (context-sensitive)
// ──────────────────────────────────────────────────

/** US passport value: one uppercase letter + 8 digits */
export const PASSPORT_VALUE =
  /\b[A-Z]\d{8}\b/g

/** Passport context labels */
export const PASSPORT_CONTEXT =
  /(?:passport(?:\s*(?:number|#|no\.?))?)\b/gi

// ──────────────────────────────────────────────────
// Context Scoring Helper
// ──────────────────────────────────────────────────

/**
 * Checks for context labels within 80 chars before the match start
 * in the normalized string. Supports labels on the previous line
 * (separated by synthetic newline).
 *
 * @param text - The full normalized page string
 * @param matchStart - Start index of the value match in the text
 * @param contextRegex - The context regex to search for
 * @returns true if a context label is found within the lookbehind window
 */
export function scoreContext(
  text: string,
  matchStart: number,
  contextRegex: RegExp
): boolean {
  const windowStart = Math.max(0, matchStart - 80)
  const window = text.slice(windowStart, matchStart)
  const re = new RegExp(contextRegex.source, contextRegex.flags)
  return re.test(window)
}
