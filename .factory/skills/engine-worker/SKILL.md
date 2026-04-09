---
name: engine-worker
description: Implements framework-agnostic TypeScript core modules (detection, PDF pipeline, utils) with TDD
---

# Engine Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving core detection logic, PDF processing pipeline, text indexing, coordinate transforms, type definitions, regex patterns, confidence scoring, merger logic, rasterization, burning, repackaging, and project bootstrap. All code in `src/core/` and `src/utils/`.

## Required Skills

None. Engine workers use only Vitest for verification — no browser testing needed.

## Work Procedure

1. **Read context**: Read `.factory/library/architecture.md` for system design, `.factory/library/environment.md` for dependency quirks, and the feature description for specific requirements.

2. **Read reference docs** (if needed): The `_docs/` directory contains detailed specifications. `00-architecture-revisions.md` is authoritative — read it first if you need detail beyond architecture.md. `_docs/02-detection-layer.md` has all regex patterns and entity type specs. `.factory/research/pdfjs-jspdf-research.md` has API details for pdfjs-dist 5.x and jsPDF 2.5.x.

3. **Write tests first (RED)**: Create test file(s) in `tests/unit/` or `tests/integration/`. Write comprehensive test cases covering:
   - Happy path for each function/behavior
   - Edge cases mentioned in the feature description
   - Error conditions
   - Boundary values
   Run tests — they must FAIL (proving they test something real).

4. **Implement (GREEN)**: Write the implementation to make tests pass. Follow existing patterns:
   - Types in `src/core/detectors/entities.ts`
   - Patterns in `src/core/detectors/patterns.ts`
   - Core logic in `src/core/`
   - Utils in `src/utils/`
   - Pipeline orchestration in `src/core/pipeline/`
   Run tests — they must PASS.

5. **Verify**: Run the full test suite (`npm test`), typecheck (`npx tsc --noEmit`), and build (`npx vite build`). Fix any failures.

6. **Review**: Check that:
   - No `any` types unless justified
   - No Preact imports in core/utils code
   - All exported functions have clear parameter and return types
   - Test coverage is meaningful (not just smoke tests)

## Example Handoff

```json
{
  "salientSummary": "Implemented all 16 regex patterns with context-sensitive value/label split in patterns.ts. Luhn validator passes 12 valid/invalid card tests. Context scoring uses 80-char lookbehind. SSN, ITIN, EIN, credit card (Amex+MC2), phone, email, DOB, address patterns all verified.",
  "whatWasImplemented": "src/core/detectors/patterns.ts with 16 named pattern exports, each having a value regex and optional context regex. Luhn validation function. Context scoring helper that checks for labels within 80 chars before match start. Credit card regex handles Visa, MC (including 2-series), Amex, Discover. ITIN validates middle digits 50-65, 70-88, 90-92, 94-99.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npx vitest run tests/unit/patterns.test.ts", "exitCode": 0, "observation": "47 tests passed — every entity type has PASS/FAIL cases" },
      { "command": "npx tsc --noEmit", "exitCode": 0, "observation": "No type errors" },
      { "command": "npx vite build", "exitCode": 0, "observation": "Build succeeds, 2 chunks" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "tests/unit/patterns.test.ts",
        "cases": [
          { "name": "SSN formatted — valid", "verifies": "412-67-9823 detected" },
          { "name": "SSN formatted — invalid", "verifies": "000-12-3456 rejected (000 prefix)" },
          { "name": "Credit card — Luhn valid", "verifies": "4532015112830366 passes Luhn and regex" },
          { "name": "Credit card — Luhn invalid", "verifies": "4532015112830367 fails Luhn, no match" },
          { "name": "ITIN — middle 94-99 valid", "verifies": "912-94-7890 detected as valid ITIN" },
          { "name": "Context scoring — labeled EIN", "verifies": "EIN: 12-3456789 gets confidence 0.95" },
          { "name": "Context scoring — unlabeled EIN", "verifies": "12-3456789 alone gets confidence 0.55, discarded" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature requires Preact components (wrong worker type)
- PDF.js API behaves differently than documented in research
- A dependency version conflict prevents installation
- Test fixtures require real PDF files that don't exist yet
