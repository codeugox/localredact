---
name: ui-worker
description: Implements Preact UI components, state management, styles, and app integration with TDD and browser verification
---

# UI Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving Preact components, state management (signals), CSS styles, screen flows, user interactions, and end-to-end app integration. All code in `src/components/`, `src/app/`, `src/styles/`, and `src/main.tsx`.

## Required Skills

- **agent-browser** — MUST be invoked for browser verification of every UI feature. After implementing, start the dev server and verify visually and interactively.

## Work Procedure

1. **Read context**: Read `.factory/library/architecture.md` for system design, `AGENTS.md` for design tokens and conventions. For the preview screen, read `_design/screen-02-annotations.md` for interaction specs and `_design/screen-02-corrected.html` for visual reference (guidance, not pixel-perfect). Read `_design/homepage.html` for drop screen visual reference.

2. **Write tests first (RED)**: Create test file(s) in `tests/unit/`. For UI components, test:
   - Rendering with expected props/signals
   - User interactions (click handlers, key events)
   - State transitions
   - Conditional rendering (show/hide based on state)
   Run tests — they must FAIL.

3. **Implement (GREEN)**: Build the component(s) and styles. Follow patterns:
   - Components in `src/components/` as `.tsx` files
   - State in `src/app/state.ts` using Preact Signals
   - All styles in `src/styles/app.css` using CSS custom properties
   - Design tokens from AGENTS.md (colors, fonts, spacing)
   - SVG overlay for highlights: `<g data-entity-id={id}>` with `<rect>` per quad
   Run tests — they must PASS.

4. **Browser verification (REQUIRED)**: Start the dev server and use agent-browser to verify:
   - Component renders correctly at http://localhost:5173
   - User interactions work (click, hover, keyboard)
   - State updates reflected in UI immediately
   - No console errors
   - Visual appearance matches design intent (not pixel-perfect, but correct layout/colors/states)
   Each verified flow = one `interactiveChecks` entry with exact actions and observations.

5. **Run validators**: `npm test`, `npx tsc --noEmit`, `npx vite build`. Fix all failures.

6. **Review**: Check that:
   - No `dangerouslySetInnerHTML`
   - All user-derived strings rendered via JSX (auto-escaped)
   - Signals used for reactive state (not useState)
   - CSS custom properties used for design tokens
   - Core imports are from `src/core/` (not duplicating logic)
   - No orphaned event listeners or timers

## Example Handoff

```json
{
  "salientSummary": "Built PreviewScreen with DocumentViewer (canvas + SVG overlay), HighlightGroup (multi-quad rects), and SummaryPanel (entity list grouped by decision). Click toggles work: REDACT↔KEEP, UNCERTAIN→REDACT. Verified via agent-browser: dropped a test PDF, highlights rendered in three colors, click toggled states, sidebar counts updated live.",
  "whatWasImplemented": "src/components/PreviewScreen.tsx assembles DocumentViewer + SummaryPanel + FooterBar. DocumentViewer renders PDF page on canvas via pdf.js, overlays SVG with HighlightGroup components. Each HighlightGroup renders <g data-entity-id> with <rect> per quad, colored by decision signal. SummaryPanel shows three groups (Removing/Keeping/Your decision) with live count chips from computed signals. Click handler dispatches toggleEntity action, signals update reactively.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npx vitest run", "exitCode": 0, "observation": "23 tests passed including component rendering and state transitions" },
      { "command": "npx tsc --noEmit", "exitCode": 0, "observation": "No type errors" },
      { "command": "npx vite build", "exitCode": 0, "observation": "Build succeeds" }
    ],
    "interactiveChecks": [
      { "action": "Navigated to http://localhost:5173, dropped test-pii.pdf", "observed": "Processing screen showed page progress 1/2, 2/2, then preview screen loaded with PDF rendered and highlights visible" },
      { "action": "Inspected SVG overlay — 8 highlight rects visible in 3 colors (red, green, amber)", "observed": "Red rects over SSN and name, green rects over dollar amounts, amber rects over EIN" },
      { "action": "Clicked red SSN highlight", "observed": "Turned green (KEEP), sidebar 'Removing' count decreased by 1, 'Keeping' increased by 1" },
      { "action": "Clicked amber EIN highlight", "observed": "Turned red (REDACT), 'Your decision' count decreased by 1, 'Removing' increased by 1" },
      { "action": "Checked console for errors", "observed": "No console errors or warnings" }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/unit/state.test.ts",
        "cases": [
          { "name": "toggleEntity REDACT→KEEP", "verifies": "dispatch toggleEntity changes decision to KEEP" },
          { "name": "toggleEntity UNCERTAIN→REDACT", "verifies": "first toggle of UNCERTAIN goes to REDACT" },
          { "name": "uncertainCount computed", "verifies": "computed signal returns correct count of UNCERTAIN entities" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Core module API doesn't match expected interface (detection pipeline returns wrong shape)
- PDF.js canvas rendering fails in browser (not just in tests)
- Design spec is ambiguous about a critical interaction
- Feature depends on a core module that doesn't exist yet
- Browser verification reveals a systematic issue across multiple components
