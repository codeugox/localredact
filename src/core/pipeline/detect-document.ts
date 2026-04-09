// src/core/pipeline/detect-document.ts
// Detection pipeline orchestrator: load PDF → index pages → detect patterns →
// score with context → apply mode defaults → merge entities → return results.
// Framework-agnostic — no Preact imports.

import type {
  DetectedEntity,
  EntityType,
  Quad,
  RedactionMode,
  TextOffset,
} from '../detectors/entities'
import type { TextItem, IndexedPage } from '../text-index'
import { indexPage, resolveMatchToQuads } from '../text-index'
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
  ZIP_STATE_CONTEXT,
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
} from '../detectors/patterns'
import {
  BASE_CONFIDENCE,
  getDecisionFromConfidence,
} from '../detectors/confidence'
import { getDefaultDecision } from '../modes/index'
import { mergeEntities } from '../detectors/merger'

// ─── Types ──────────────────────────────────────────────────────────

/** Input page data for the detection pipeline (pre-loaded page content). */
export interface PageInput {
  items: TextItem[]
  viewport: { width: number; height: number }
}

/** Result from the detection pipeline. */
export interface DetectionResult {
  entities: DetectedEntity[]
  pages: IndexedPage[]
}

/** Progress callback: (currentPage, totalPages) */
export type OnProgressCallback = (page: number, total: number) => void

// ─── Pattern Definition ─────────────────────────────────────────────

interface PatternDef {
  type: EntityType
  regex: RegExp
  /** Optional context regex for confidence boosting via 80-char lookbehind */
  contextRegex?: RegExp
  /** Optional additional context regexes (any match triggers context boost) */
  contextRegexAlt?: RegExp[]
  /** Base confidence when matched without context */
  baseConfidence: number
  /** Confidence when context label is found nearby */
  contextConfidence: number
  /** Optional post-match validation (e.g., Luhn for credit cards) */
  validate?: (match: string) => boolean
  /**
   * If true, skip matches that span a synthetic newline.
   * Most patterns should not match across line boundaries in the normalized text.
   * Defaults to true when not specified.
   */
  singleLine?: boolean
}

/**
 * All regex pattern definitions used in the detection pipeline.
 * Order matters: more specific patterns should come first to avoid
 * the merger having to resolve unnecessary overlaps.
 */
const PATTERN_DEFS: PatternDef[] = [
  // ITIN before SSN — ITINs start with 9 and would also match SSN_FORMATTED
  {
    type: 'US_ITIN',
    regex: ITIN,
    baseConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // SSN formatted
  {
    type: 'US_SSN',
    regex: SSN_FORMATTED,
    baseConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // SSN unformatted (lower confidence — higher false positive risk)
  {
    type: 'US_SSN',
    regex: SSN_UNFORMATTED,
    baseConfidence: BASE_CONFIDENCE.UNFORMATTED_MATCH,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // Credit card — requires Luhn validation
  {
    type: 'CREDIT_CARD',
    regex: CREDIT_CARD,
    baseConfidence: BASE_CONFIDENCE.CHECKSUM_VALID,
    contextConfidence: BASE_CONFIDENCE.CHECKSUM_VALID,
    validate: luhn,
  },
  // Email
  {
    type: 'EMAIL_ADDRESS',
    regex: EMAIL,
    baseConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // Phone
  {
    type: 'PHONE_NUMBER',
    regex: PHONE_US,
    baseConfidence: BASE_CONFIDENCE.UNFORMATTED_MATCH,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // Street address
  {
    type: 'STREET_ADDRESS',
    regex: STREET_ADDRESS,
    baseConfidence: BASE_CONFIDENCE.UNFORMATTED_MATCH,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // City state zip
  {
    type: 'CITY_STATE_ZIP',
    regex: CITY_STATE_ZIP,
    baseConfidence: BASE_CONFIDENCE.WITH_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.WITH_CONTEXT,
  },
  // EIN — context-sensitive
  {
    type: 'US_EIN',
    regex: EIN_VALUE,
    contextRegex: EIN_CONTEXT,
    baseConfidence: BASE_CONFIDENCE.NO_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.WITH_CONTEXT,
  },
  // DOB numeric
  {
    type: 'DATE_OF_BIRTH',
    regex: DOB_NUMERIC,
    contextRegex: DOB_CONTEXT,
    baseConfidence: BASE_CONFIDENCE.NO_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // DOB written
  {
    type: 'DATE_OF_BIRTH',
    regex: DOB_WRITTEN,
    contextRegex: DOB_CONTEXT,
    baseConfidence: BASE_CONFIDENCE.MODERATE_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // Routing number before bank account — routing numbers are 9-digit
  // numbers with valid Federal Reserve district prefixes (more specific).
  // Must run before BANK_ACCOUNT_VALUE which matches any 8-17 digit number.
  {
    type: 'ROUTING_NUMBER',
    regex: ROUTING_NUMBER_VALUE,
    contextRegex: ROUTING_NUMBER_CONTEXT,
    baseConfidence: BASE_CONFIDENCE.NO_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.WITH_CONTEXT,
  },
  // Bank account — context-sensitive (broader: any 8-17 digit number)
  {
    type: 'BANK_ACCOUNT',
    regex: BANK_ACCOUNT_VALUE,
    contextRegex: BANK_ACCOUNT_CONTEXT,
    baseConfidence: BASE_CONFIDENCE.NO_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.WITH_CONTEXT,
  },
  // Money with $ symbol
  {
    type: 'MONEY',
    regex: MONEY_SYMBOL,
    baseConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // Money without $ symbol (comma-separated thousands + decimal)
  {
    type: 'MONEY',
    regex: MONEY_NO_SYMBOL,
    baseConfidence: BASE_CONFIDENCE.MODERATE_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
  // ZIP code — context-sensitive
  // ZIP_CONTEXT matches explicit ZIP labels (case-insensitive),
  // ZIP_STATE_CONTEXT matches uppercase two-letter state codes (case-sensitive)
  {
    type: 'ZIP_CODE',
    regex: ZIP_VALUE,
    contextRegex: ZIP_CONTEXT,
    contextRegexAlt: [ZIP_STATE_CONTEXT],
    baseConfidence: BASE_CONFIDENCE.NO_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.MODERATE_CONTEXT,
  },
  // Passport — context-sensitive
  {
    type: 'PASSPORT',
    regex: PASSPORT_VALUE,
    contextRegex: PASSPORT_CONTEXT,
    baseConfidence: BASE_CONFIDENCE.NO_CONTEXT,
    contextConfidence: BASE_CONFIDENCE.FORMAT_MATCH,
  },
]

// ─── ID Generation ──────────────────────────────────────────────────

let entityCounter = 0

/** Generate a unique entity ID. */
function generateEntityId(): string {
  return `entity-${++entityCounter}`
}

/** Reset the entity counter (for testing). */
export function resetEntityCounter(): void {
  entityCounter = 0
}

// ─── Pattern Runner ─────────────────────────────────────────────────

/**
 * Run all pattern definitions against a single indexed page.
 * Returns raw (unmerged) entities for the page.
 */
function runPatternsOnPage(
  page: IndexedPage,
  mode: RedactionMode
): DetectedEntity[] {
  const entities: DetectedEntity[] = []
  const { text } = page

  if (text.length === 0) return entities

  for (const def of PATTERN_DEFS) {
    // Create a fresh regex instance to reset lastIndex
    const regex = new RegExp(def.regex.source, def.regex.flags)

    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0]
      const matchStart = match.index
      const matchEnd = matchStart + matchedText.length

      // Single-line check: skip matches that span newlines unless explicitly allowed.
      // Reset lastIndex to matchStart + 1 so the regex can retry for a valid
      // non-crossing-line match starting later in the text.
      const isSingleLine = def.singleLine !== false
      if (isSingleLine && matchedText.includes('\n')) {
        regex.lastIndex = matchStart + 1
        continue
      }

      // Post-match validation (e.g., Luhn for credit cards)
      if (def.validate && !def.validate(matchedText)) {
        continue
      }

      // Context scoring: check for context label within 80 chars before match
      let confidence: number
      if (def.contextRegex) {
        let hasContext = scoreContext(text, matchStart, def.contextRegex)
        // Check alternative context regexes (e.g., case-sensitive state codes for ZIP)
        if (!hasContext && def.contextRegexAlt) {
          for (const altRegex of def.contextRegexAlt) {
            if (scoreContext(text, matchStart, altRegex)) {
              hasContext = true
              break
            }
          }
        }
        confidence = hasContext ? def.contextConfidence : def.baseConfidence
      } else {
        confidence = def.baseConfidence
      }

      // Get the default decision from mode + confidence
      const decision = getDefaultDecision(def.type, mode, confidence)

      // If decision is null, the entity is below discard threshold — skip it
      if (decision === null) {
        continue
      }

      // Resolve match offset to quads in PDF coordinate space
      const textOffset: TextOffset = { start: matchStart, end: matchEnd }
      const quads: Quad[] = resolveMatchToQuads(textOffset, page)

      // Skip entities with no geometry (e.g., synthetic whitespace only)
      if (quads.length === 0) {
        continue
      }

      entities.push({
        id: generateEntityId(),
        type: def.type,
        text: matchedText,
        layer: 'REGEX',
        confidence,
        decision,
        page: page.pageNum,
        textOffset,
        quads,
      })
    }
  }

  return entities
}

// ─── Pipeline Orchestrator (synchronous, for use with pre-loaded pages) ──

/**
 * Synchronous detection pipeline that processes pre-loaded page data.
 * Used by both the async detectDocument (which loads the PDF first)
 * and by integration tests (which supply TextItem arrays directly).
 *
 * Steps:
 * 1. For each page: index → run patterns → score → collect entities
 * 2. After all pages: merge entities via merger
 *
 * @param pageInputs - Array of page data (TextItem arrays + viewport)
 * @param mode - Redaction mode (IDENTITY_ONLY or FULL_REDACTION)
 * @param onProgress - Optional progress callback (page, total)
 * @returns DetectionResult with merged entities and indexed pages
 */
export function detectPipeline(
  pageInputs: PageInput[],
  mode: RedactionMode,
  onProgress?: OnProgressCallback
): DetectionResult {
  const total = pageInputs.length
  const indexedPages: IndexedPage[] = []
  const allEntities: DetectedEntity[] = []

  for (let i = 0; i < total; i++) {
    const { items, viewport } = pageInputs[i]
    const pageNum = i + 1

    // Step 1: Index the page — build normalized string + char-to-item mapping
    const indexedPage = indexPage(items, viewport, pageNum)
    indexedPages.push(indexedPage)

    // Step 2: Run all patterns against the indexed page
    const pageEntities = runPatternsOnPage(indexedPage, mode)
    allEntities.push(...pageEntities)

    // Step 3: Report progress
    onProgress?.(pageNum, total)
  }

  // Step 4: Merge entities (dedup, resolve overlaps, merge adjacent)
  // Build normalized text map so the merger can preserve separator characters
  const normalizedTexts = new Map<number, string>()
  for (const page of indexedPages) {
    normalizedTexts.set(page.pageNum, page.text)
  }
  const mergedEntities = mergeEntities(allEntities, normalizedTexts)

  return {
    entities: mergedEntities,
    pages: indexedPages,
  }
}

// ─── Async Pipeline (full document pipeline with PDF loading) ──────

/**
 * Full async detection pipeline: validate file → load PDF → extract text →
 * index pages → detect patterns → merge → return results.
 *
 * This is the primary entry point called by the UI layer.
 *
 * @param file - PDF file to process
 * @param mode - Redaction mode
 * @param onProgress - Progress callback (page, total) called after each page
 * @param onPassword - Optional callback for password-protected PDFs
 * @returns DetectionResult with merged entities and indexed pages
 */
export async function detectDocument(
  file: File,
  mode: RedactionMode,
  onProgress?: OnProgressCallback,
  onPassword?: (
    updatePassword: (password: string) => void,
    reason: number
  ) => void
): Promise<DetectionResult> {
  // Dynamic import to avoid pulling pdfjs-dist into unit test bundles
  const { loadPDF, destroyPDF } = await import('../pdf/loader')

  const { pdf, numPages } = await loadPDF(file, onPassword)

  try {
    const pageInputs: PageInput[] = []

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1 })

      // Get text content with disableNormalization: true to prevent offset drift
      const textContent = await page.getTextContent({
        disableNormalization: true,
      })

      // Filter to text items (exclude TextMarkedContent) and map to our TextItem shape.
      // pdfjs-dist's TextItem has additional fields (dir, fontName) we don't need.
      const items: TextItem[] = textContent.items
        .filter((item): item is { str: string; dir: string; transform: number[]; width: number; height: number; fontName: string; hasEOL: boolean } => 'str' in item)
        .map((item) => ({
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height,
          hasEOL: item.hasEOL,
        }))

      pageInputs.push({
        items,
        viewport: { width: viewport.width, height: viewport.height },
      })
    }

    // Run the synchronous detection pipeline on the pre-loaded pages
    const result = detectPipeline(pageInputs, mode, onProgress)

    return result
  } finally {
    await destroyPDF(pdf)
  }
}
