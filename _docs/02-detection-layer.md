# Detection Layer

## Overview

Detection runs in two layers. Both layers produce the same output format — a list of `DetectedEntity` objects with type, confidence, page number, and bounding box coordinates. The two outputs are merged and deduplicated before reaching the preview screen.

**Layer 1 — Regex + checksums**
Runs synchronously on extracted text. Zero dependencies. Instant. Handles all structured PII where the format is deterministic.

**Layer 2 — ONNX NER model (v1.1)**
Runs in a Web Worker. Downloads once (~45–80MB), cached permanently. Handles contextual PII where meaning depends on surrounding text.

---

## TypeScript Type Definitions

```typescript
// src/core/detectors/entities.ts

export type EntityType =
  | 'US_SSN'
  | 'US_ITIN'
  | 'US_EIN'
  | 'CREDIT_CARD'
  | 'PHONE_NUMBER'
  | 'EMAIL_ADDRESS'
  | 'STREET_ADDRESS'
  | 'CITY_STATE_ZIP'
  | 'ZIP_CODE'
  | 'DATE_OF_BIRTH'
  | 'BANK_ACCOUNT'
  | 'ROUTING_NUMBER'
  | 'MONEY'
  | 'PERSON'           // NER only — v1.1
  | 'ORG'              // NER only — v1.1
  | 'PASSPORT'

export type RedactionDecision = 'REDACT' | 'KEEP' | 'UNCERTAIN'

export type DetectionLayer = 'REGEX' | 'NER'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface TextOffset {
  start: number
  end: number
}

export interface DetectedEntity {
  id: string                    // unique ID, used to tie overlay rect to entity
  type: EntityType
  text: string                  // the actual matched text from the document
  layer: DetectionLayer
  confidence: number            // 0.0 to 1.0
  decision: RedactionDecision   // set by mode defaults, overridable by user
  page: number                  // 1-indexed
  textOffset: TextOffset        // character positions in extracted text string
  boundingBox: BoundingBox      // pixel coordinates on rendered canvas
}
```

---

## Mode to Decision Mapping

Every detected entity gets an initial `RedactionDecision` assigned automatically based on the active mode. The user can override any individual entity in the preview screen.

```typescript
// src/core/modes/identity-only.ts

export const IDENTITY_ONLY_DEFAULTS: Record<EntityType, RedactionDecision> = {
  US_SSN:          'REDACT',
  US_ITIN:         'REDACT',
  US_EIN:          'UNCERTAIN',   // public record but user may want removed
  CREDIT_CARD:     'REDACT',
  PHONE_NUMBER:    'REDACT',
  EMAIL_ADDRESS:   'REDACT',
  STREET_ADDRESS:  'REDACT',
  CITY_STATE_ZIP:  'REDACT',
  ZIP_CODE:        'UNCERTAIN',   // 5-digit numbers appear everywhere in tax docs
  DATE_OF_BIRTH:   'REDACT',
  BANK_ACCOUNT:    'REDACT',
  ROUTING_NUMBER:  'REDACT',
  MONEY:           'KEEP',        // preserve all dollar amounts
  PERSON:          'REDACT',
  ORG:             'REDACT',      // employer name is sensitive
  PASSPORT:        'REDACT',
}

// src/core/modes/full-redaction.ts

export const FULL_REDACTION_DEFAULTS: Record<EntityType, RedactionDecision> = {
  US_SSN:          'REDACT',
  US_ITIN:         'REDACT',
  US_EIN:          'REDACT',
  CREDIT_CARD:     'REDACT',
  PHONE_NUMBER:    'REDACT',
  EMAIL_ADDRESS:   'REDACT',
  STREET_ADDRESS:  'REDACT',
  CITY_STATE_ZIP:  'REDACT',
  ZIP_CODE:        'REDACT',
  DATE_OF_BIRTH:   'REDACT',
  BANK_ACCOUNT:    'REDACT',
  ROUTING_NUMBER:  'REDACT',
  MONEY:           'REDACT',
  PERSON:          'REDACT',
  ORG:             'REDACT',
  PASSPORT:        'REDACT',
}
```

---

## Confidence Thresholds

```typescript
// src/core/detectors/confidence.ts

export const CONFIDENCE_THRESHOLDS = {
  AUTO_REDACT:  0.85,   // entity is marked REDACT without user review
  UNCERTAIN:    0.60,   // entity is flagged for user review
  DISCARD:      0.60,   // below this threshold, entity is dropped entirely
}

// Regex matches with checksum validation get 0.99
// Regex matches without checksum get 0.90
// Regex matches requiring context (ZIP, PASSPORT) get 0.65 → UNCERTAIN
// NER matches above 0.85 get AUTO_REDACT
// NER matches 0.60–0.85 get UNCERTAIN
// NER matches below 0.60 are discarded
```

---

## Layer 1 — Regex Patterns

All patterns are exported as named constants from `src/core/detectors/patterns.ts`.

Each pattern entry below includes: the regex, what it matches, validation logic if any, known edge cases, and pass/fail test cases.

---

### US_SSN — Social Security Number

```typescript
export const SSN_FORMATTED =
  /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g

export const SSN_UNFORMATTED =
  /\b(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}\b/g
```

Negative lookaheads enforce SSA validity rules:
- Area (first 3): cannot be 000, 666, or 900–999
- Group (middle 2): cannot be 00
- Serial (last 4): cannot be 0000

Without these, phone numbers and account numbers generate false positives.

```
PASS    412-67-9823
PASS    123-45-6789
PASS    412679823         unformatted
FAIL    000-67-9823       invalid area
FAIL    412-00-9823       invalid group
FAIL    412-67-0000       invalid serial
FAIL    666-67-9823       invalid area
FAIL    900-67-9823       invalid area range
```

Confidence: 0.99 (formatted), 0.90 (unformatted — higher false positive risk)

---

### US_ITIN — Individual Taxpayer Identification Number

```typescript
export const ITIN =
  /\b9\d{2}-(?:5[0-9]|6[0-5]|7[0-9]|8[0-9]|9[0-3])-\d{4}\b/g
```

ITINs look like SSNs but always start with 9 and have specific middle-digit ranges (50–65, 70–88, 90–92, 94–99). Run this before the SSN pattern to avoid double-matching.

```
PASS    912-56-7890
PASS    978-90-1234
FAIL    412-56-7890       starts with 4, that's an SSN
FAIL    912-67-7890       invalid middle digit range
FAIL    912-94-7890       valid (94 is in range 94-99)
```

Confidence: 0.99

---

### US_EIN — Employer Identification Number

```typescript
export const EIN =
  /\b\d{2}-\d{7}\b/g
```

Format is always XX-XXXXXXX. Ambiguous against other 9-digit numbers without context. Promote to REDACT when preceded by "EIN", "Employer identification number", "Federal ID", or "Tax ID". Otherwise UNCERTAIN.

```
PASS    12-3456789
PASS    98-7654321
FAIL    1-23456789        wrong grouping
FAIL    12-345678         too short
FAIL    12-34567890       too long
```

Confidence: 0.90 (with label context), 0.65 (without context → UNCERTAIN)

---

### CREDIT_CARD — Credit Card Numbers

```typescript
export const CREDIT_CARD =
  /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2}|6(?:011|5[0-9]{2}))[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/g
```

Covers Visa (4xxx), Mastercard (51xx–55xx), Amex (34xx, 37xx), Discover (6011, 65xx). All regex matches must pass Luhn validation — failures are discarded.

```typescript
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
```

```
PASS    4532015112830366      valid Visa, passes Luhn
PASS    4532-0151-1283-0366   formatted with dashes
PASS    4532 0151 1283 0366   formatted with spaces
FAIL    4532015112830367      fails Luhn (last digit off)
FAIL    1234567890123456      fails Luhn + wrong prefix
FAIL    4532015112830         too short
```

Confidence: 0.99 (passes Luhn)

---

### PHONE_NUMBER — US Phone Numbers

```typescript
export const PHONE_US =
  /\b(?:\+1[-.\s]?)?\(?([2-9][0-9]{2})\)?[-.\s]?([2-9][0-9]{2})[-.\s]?([0-9]{4})\b/g
```

Area codes cannot start with 0 or 1. Exchange (middle three) cannot start with 0 or 1. Handles all common US formats including +1 prefix.

```
PASS    (202) 555-0147
PASS    202-555-0147
PASS    202.555.0147
PASS    2025550147
PASS    +1 202 555 0147
PASS    +1-202-555-0147
FAIL    (011) 555-0147    invalid area code prefix
FAIL    (202) 155-0147    invalid exchange prefix
FAIL    555-0147          missing area code
```

Confidence: 0.90

---

### EMAIL_ADDRESS

```typescript
export const EMAIL =
  /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g
```

Deliberately not RFC-5322 compliant — that regex is 6,000 characters. This pattern catches everything that appears in real documents without false positives.

```
PASS    john.martinez@gmail.com
PASS    j.martinez+tax2024@company.org
PASS    user@subdomain.example.com
FAIL    notanemail@
FAIL    @nodomain.com
FAIL    plaintext
```

Confidence: 0.99

---

### STREET_ADDRESS

```typescript
export const STREET_ADDRESS =
  /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Way|Place|Pl|Terrace|Ter|Highway|Hwy)\.?\b/gi
```

Matches street number + name + type. Run in conjunction with CITY_STATE_ZIP — a full address usually triggers both. Merge overlapping matches.

```
PASS    441 Birchwood Lane
PASS    1600 Pennsylvania Avenue NW
PASS    22 Baker Street
FAIL    Floor 4               no street number
FAIL    Main Street           no house number
```

Confidence: 0.90

---

### CITY_STATE_ZIP

```typescript
export const CITY_STATE_ZIP =
  /\b[A-Z][a-zA-Z\s]{2,20},?\s+(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}(?:-\d{4})?\b/g
```

All 50 state abbreviations included. Matches city name + state + ZIP. The presence of a two-letter state code + ZIP makes this high confidence.

```
PASS    Columbus, OH 43201
PASS    New York, NY 10001-1234
PASS    San Francisco CA 94103
FAIL    Ohio 43201              no city name
FAIL    Columbus 43201          no state abbreviation
```

Confidence: 0.95

---

### ZIP_CODE — Standalone

```typescript
export const ZIP_STANDALONE =
  /\b\d{5}(?:-\d{4})?\b/g
```

High false positive risk — 5-digit numbers appear everywhere in financial documents (form numbers, box numbers, dollar amounts without cents). Default decision is UNCERTAIN. Promote to REDACT only when adjacent to a state abbreviation or the label "ZIP."

```
PASS    43201
PASS    43201-1234
UNCERTAIN   43201               standalone, no context
REDACT      OH 43201            adjacent to state code
```

Confidence: 0.65 (standalone → UNCERTAIN), 0.90 (with state code context)

---

### DATE_OF_BIRTH

```typescript
export const DOB_NUMERIC =
  /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12][0-9]|3[01])[-\/](?:19|20)\d{2}\b/g

export const DOB_WRITTEN =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi
```

Tax year dates and pay period dates must be kept. Disambiguate:
- Date adjacent to "Date of Birth," "DOB," or "Born" → REDACT at 0.99
- Year before 2000 with no label context → UNCERTAIN (likely a birth year)
- Year 2020 or later with no label context → KEEP (likely a tax period)

```
PASS    03/15/1985         DOB format
PASS    March 15, 1985
KEEP    January 1, 2024    tax period context
UNCERTAIN   07/04/1976     no label context
```

---

### BANK_ACCOUNT

```typescript
export const BANK_ACCOUNT =
  /\b(?:account\s*(?:number|#|no\.?)?:?\s*)\d{8,17}\b/gi
```

Raw 8–17 digit numbers without context generate too many false positives. Anchored to context words. The context anchor is required for v1. Standalone long numbers are ignored.

```
PASS    Account Number: 123456789
PASS    Acct #: 9876543210
PASS    account no. 12345678901234
FAIL    123456789           no context label
FAIL    12345               too short
```

Confidence: 0.95

---

### ROUTING_NUMBER

```typescript
export const ROUTING_NUMBER =
  /\b(?:routing\s*(?:number|#|no\.?)?:?\s*)?(?:0[0-9]|1[0-2]|2[1-9]|3[0-2])\d{7}\b/gi
```

Routing numbers are exactly 9 digits. The first two digits encode the Federal Reserve district (valid ranges: 01–12, 21–32). This specificity reduces false positives significantly.

```
PASS    021000021           Chase routing, valid prefix
PASS    Routing: 021000021
PASS    routing number: 111000025
FAIL    00000000            invalid prefix
FAIL    99-999999           invalid prefix
```

Confidence: 0.95 (with label), 0.80 (without label but valid prefix)

---

### MONEY — Dollar Amounts (KEEP)

```typescript
export const MONEY_SYMBOL =
  /\$\s?[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?\b/g

export const MONEY_NO_SYMBOL =
  /\b[0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2}\b/g
```

Tagged `MONEY`, defaulted to KEEP in identity-only mode. These are the values a user shares a tax document to convey — wages, withholding, deductions.

```
KEEP    $84,200.00
KEEP    $1,234.56
KEEP    $500
KEEP    84,200.00       no dollar sign but unambiguous money format
SKIP    84200           ambiguous — not tagged
```

---

### PASSPORT

```typescript
export const PASSPORT_US =
  /\b[A-Z]\d{8}\b/g
```

Short pattern with high false positive risk. Default is UNCERTAIN. Promote to REDACT when the word "Passport" appears nearby (within 50 characters).

```
PASS        A12345678
UNCERTAIN   A12345678    without "Passport" context
REDACT      A12345678    with "Passport" context
```

Confidence: 0.65 (no context → UNCERTAIN), 0.99 (with "Passport" label)

---

### Out of Scope for V1

**Driver's license** — too variable by state (50 different formats). Add in v1.2 with state-specific patterns.

**International phone numbers** — US only for v1. Add ITU-T format in v1.2.

**International addresses** — US only for v1.

---

## Layer 2 — NER Model (V1.1)

### Model

**Primary:** `ab-ai/pii_model` — fine-tuned BERT-base, specifically trained to tag PII entities including names, addresses, financial details, SSNs, account numbers.

**Alternative:** DistilBERT fine-tuned on PII data — 40% smaller than BERT-base, ~97% accuracy retention on classification tasks. ~45MB quantized to ONNX.

Format: ONNX, dynamic quantization. Loaded via `@xenova/transformers` in a dedicated Web Worker.

### Entity Types Covered by NER (Not Covered by Regex)

```
PERSON      names in narrative text ("paid to John Martinez")
ORG         employer names in narrative text
```

Note: NER also detects SSNs, addresses, and emails — these are deduped against Layer 1 results. Layer 1 takes precedence for structured PII (higher confidence, no ambiguity).

### Loading Strategy

```
Page loads → app is functional with regex-only detection
User clicks "Enable name and address detection"
        ↓
Service Worker checks cache for model
        ↓
Cache hit:   load from cache, instant
Cache miss:  download (~45-80MB), show progress bar,
             cache for all future visits
        ↓
Web Worker initializes model
        ↓
NER detection runs on current document
        ↓
Results merged with existing regex results
Preview screen updates with new highlights
```

---

## Merger Logic

After both layers run, spans are merged. Rules:

```typescript
// src/core/detectors/merger.ts

// Rule 1: Deduplicate exact character ranges
// If two entities have identical start/end offsets, keep the one
// with higher confidence. Layer 1 wins ties.

// Rule 2: Resolve overlapping spans
// If span A contains span B (or vice versa), keep the longer span
// with higher confidence.

// Rule 3: Resolve adjacent spans of the same type
// "John" + " " + "Martinez" detected as separate PERSON entities
// → merge into one span "John Martinez"

// Rule 4: Conflicting type on same span
// SSN detected by regex as US_SSN
// NER also detects it as some other type
// → Layer 1 type wins, Layer 1 confidence used
```

---

## Presidio Compatibility Note

The entity types, confidence scoring, and recognizer pattern structure above are designed to be compatible with Microsoft Presidio's `RecognizerResult` format. When the desktop version (v3) uses Presidio as its backend, results map directly to `DetectedEntity` without schema translation.

```python
# Desktop v3 — Presidio produces results in this shape
# which maps directly to our DetectedEntity TypeScript interface
RecognizerResult(
    entity_type="US_SSN",
    start=10,
    end=21,
    score=0.99
)
```
