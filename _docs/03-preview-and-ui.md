# Preview Screen and UI

## Overview

The preview screen is the most important screen in the app. Everything before it is invisible infrastructure. This is where the user sees what's about to happen, corrects any mistakes, and decides to trust the tool.

Three screens total. The preview screen is where all the design thinking lives.

```
Drop screen       →   file input, drag and drop
Processing screen →   detection running, progress states
Preview screen    →   the main event
```

---

## State Machine

The entire app is driven by a single state machine in `src/ui/app.ts`.

```typescript
type AppState =
  | 'IDLE'          // drop screen showing, waiting for file
  | 'LOADING'       // file received, detection running
  | 'NEEDS_REVIEW'  // detection done, uncertain items exist
  | 'READY'         // all items resolved, download available
  | 'PROCESSING'    // redaction running, page by page
  | 'DONE'          // download triggered

type AppEvent =
  | { type: 'FILE_DROPPED'; file: File }
  | { type: 'DETECTION_COMPLETE'; entities: DetectedEntity[] }
  | { type: 'ENTITY_TOGGLED'; id: string }
  | { type: 'MODE_CHANGED'; mode: RedactionMode }
  | { type: 'REDACT_CLICKED' }
  | { type: 'REDACTION_COMPLETE'; blob: Blob }
  | { type: 'START_OVER' }
  | { type: 'PASSWORD_SUBMITTED'; password: string }
  | { type: 'ERROR'; message: string }

// Transitions
// IDLE          + FILE_DROPPED         → LOADING
// LOADING       + DETECTION_COMPLETE   → NEEDS_REVIEW (if uncertains > 0)
//                                      → READY (if uncertains = 0)
// NEEDS_REVIEW  + ENTITY_TOGGLED       → NEEDS_REVIEW or READY
// NEEDS_REVIEW  + MODE_CHANGED         → NEEDS_REVIEW or READY (recompute)
// READY         + ENTITY_TOGGLED       → NEEDS_REVIEW or READY
// READY         + MODE_CHANGED         → NEEDS_REVIEW or READY
// READY         + REDACT_CLICKED       → PROCESSING
// PROCESSING    + REDACTION_COMPLETE   → DONE
// DONE          + START_OVER           → IDLE
// ANY           + ERROR                → ERROR state (show message, offer retry)
```

---

## Drop Screen

Single element. File drop zone with two sentences of copy and a click-to-browse fallback.

```
┌────────────────────────────────────────────┐
│                                            │
│                                            │
│           Drop a PDF here                  │
│                                            │
│      or click to browse your files         │
│                                            │
│                                            │
└────────────────────────────────────────────┘

🔒 Your document never leaves this browser tab.
```

Accepted file types: `application/pdf` only for v1.
Max file size: 50MB. Show clear error if exceeded.

On file drop or selection, immediately transition to LOADING.

**Password-protected PDF handling:**
PDF.js throws `PasswordException` on encrypted files. Catch it, show a password input modal, pass the password to `pdfjsLib.getDocument({ password })`. Wrong password shows a clear inline error — do not crash.

---

## Processing Screen

Shown while detection runs. Simple and honest.

```
Analyzing your document...

[████████████░░░░░░░░░░] 47%

Checking for sensitive information.
Your document stays in this tab.
```

Progress is driven by page count — each page completing detection increments the bar.

For short documents this screen appears and disappears quickly. Do not add artificial delay.

---

## Preview Screen Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [AppName]                                        [?] Help  │
├──────────────────┬──────────────────────────────────────────┤
│                  │                                          │
│  REDACT          │                                          │
│  ──────          │         DOCUMENT PREVIEW                 │
│                  │                                          │
│  Mode            │   ┌──────────────────────────────┐      │
│  ○ Identity only │   │  W-2 Wage and Tax Statement  │      │
│  ● Everything    │   │  2024                        │      │
│                  │   │                              │      │
│  ──────          │   │  Employee: ████████████████  │      │
│                  │   │  SSN: ███-██-████            │      │
│  Found           │   │  Address: █████████████████  │      │
│  ──────          │   │           ████████████████   │      │
│  8  identity     │   │                              │      │
│     4 names      │   │  Wages:      $84,200.00  ✓   │      │
│     1 SSN        │   │  Fed tax:    $12,840.00  ✓   │      │
│     2 addresses  │   │  SS wages:   $84,200.00  ✓   │      │
│     1 phone      │   │                              │      │
│                  │   │  Employer: ████████████████  │      │
│  3  financial    │   │  EIN: ██-███████    [?]      │      │
│     kept         │   │                              │      │
│                  │   └──────────────────────────────┘      │
│  1  review ⚠    │                                          │
│     click here   │   Page 1 of 2      [‹ Prev]  [Next ›]  │
│                  │                                          │
│  ──────          │                                          │
│                  │                                          │
│  Legend          │                                          │
│  █ Will redact   │                                          │
│  ✓ Keeping       │                                          │
│  ? Needs review  │                                          │
│                  │                                          │
├──────────────────┴──────────────────────────────────────────┤
│  [Cancel]                       [Resolve 1 item to continue]│
└─────────────────────────────────────────────────────────────┘
```

---

## Document Rendering — Two Layer Approach

```
Layer 1 (bottom)  →  PDF.js canvas, the actual rendered page
Layer 2 (top)     →  SVG overlay, highlight rectangles only
```

The SVG overlay is positioned absolutely over the canvas, same dimensions. Each detected entity is a `<rect>` element in the SVG with:
- An `id` attribute tied to the entity's `id` field
- A `data-entity-type` attribute
- A `data-decision` attribute that drives the visual style via CSS
- A click handler that toggles the decision

Why SVG over canvas for the overlay: SVG elements are individually clickable and hoverable without hit-testing math. Changing a highlight's visual state is a CSS class swap, not a canvas redraw. Each rect is a real DOM element with accessible attributes.

```typescript
// Each highlight rect in the SVG overlay
// coords already transformed to canvas pixel space

<rect
  id={entity.id}
  x={entity.boundingBox.x}
  y={entity.boundingBox.y}
  width={entity.boundingBox.width}
  height={entity.boundingBox.height}
  data-entity-type={entity.type}
  data-decision={entity.decision}
  class="highlight-rect"
  onClick={() => toggleEntity(entity.id)}
  onMouseEnter={() => showTooltip(entity)}
  onMouseLeave={() => hideTooltip()}
/>
```

---

## Highlight Visual States

Three states, three visual treatments. Implemented via CSS `data-decision` attribute selector.

```css
/* Will be redacted — solid dark red, 70% opacity */
/* User can still read original text underneath to verify */
.highlight-rect[data-decision="REDACT"] {
  fill: #C0392B;
  fill-opacity: 0.70;
  stroke: none;
  cursor: pointer;
}

/* Will be kept — thin green outline, no fill */
/* Visible but does not obscure financial numbers */
.highlight-rect[data-decision="KEEP"] {
  fill: none;
  stroke: #27AE60;
  stroke-width: 2;
  cursor: pointer;
}

/* Needs review — yellow, dashed border, 50% opacity */
/* Pulsing animation draws attention */
.highlight-rect[data-decision="UNCERTAIN"] {
  fill: #F39C12;
  fill-opacity: 0.50;
  stroke: #E67E22;
  stroke-width: 2;
  stroke-dasharray: 4 2;
  cursor: pointer;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { fill-opacity: 0.50; }
  50%       { fill-opacity: 0.75; }
}
```

---

## Toggle Interaction

Single click cycles through states. No modal, no confirmation. Reversible until the final button is clicked.

```typescript
function toggleEntity(id: string): void {
  const entity = entities.find(e => e.id === id)
  if (!entity) return

  const next: Record<RedactionDecision, RedactionDecision> = {
    'REDACT':    'KEEP',
    'KEEP':      'REDACT',
    'UNCERTAIN': 'REDACT',  // first click on uncertain → redact
  }

  entity.decision = next[entity.decision]
  updateSummaryPanel()
  updateFooterButton()
}
```

---

## Tooltip on Hover

Small tooltip appears above the highlighted region on hover. Three data points only.

```
┌─────────────────┐
│ US_SSN          │   ← entity type, human-readable label
│ "412-67-9823"   │   ← the actual matched text
│ Click to keep   │   ← what clicking will do
└─────────────────┘
```

Human-readable label map:
```typescript
const ENTITY_LABELS: Record<EntityType, string> = {
  US_SSN:         'Social Security Number',
  US_ITIN:        'ITIN',
  US_EIN:         'Employer ID Number',
  CREDIT_CARD:    'Credit Card Number',
  PHONE_NUMBER:   'Phone Number',
  EMAIL_ADDRESS:  'Email Address',
  STREET_ADDRESS: 'Street Address',
  CITY_STATE_ZIP: 'City / State / ZIP',
  ZIP_CODE:       'ZIP Code',
  DATE_OF_BIRTH:  'Date of Birth',
  BANK_ACCOUNT:   'Bank Account Number',
  ROUTING_NUMBER: 'Routing Number',
  MONEY:          'Dollar Amount',
  PERSON:         'Person Name',
  ORG:            'Organization Name',
  PASSPORT:       'Passport Number',
}
```

Tooltip action text:
```typescript
const TOOLTIP_ACTION: Record<RedactionDecision, string> = {
  'REDACT':    'Click to keep',
  'KEEP':      'Click to redact',
  'UNCERTAIN': 'Click to redact',
}
```

---

## Summary Panel

Left panel. Updates live as user toggles entities. Clicking the "review" count jumps to the first uncertain item.

```typescript
interface SummaryState {
  identity: {
    total: number
    breakdown: Partial<Record<EntityType, number>>
  }
  financial: {
    total: number
  }
  uncertain: {
    total: number
    firstEntityId: string | null   // for jump-to behavior
  }
}
```

The breakdown under "identity" is the trust signal — users need to see "1 SSN" not just "8 identity items" to feel confident their SSN was caught.

Show only entity types that were actually found. Don't show zero-count rows.

---

## Page Navigation

```
Page 1 of 2    [‹ Prev]  [Next ›]

Thumbnail strip (for documents 3+ pages):
[pg1●] [pg2 ] [pg3●] [pg4 ]
  ^^^                        
red dot = uncertain items on this page
```

Each thumbnail is a miniature canvas render of the page at low resolution. A red dot indicator overlays pages that contain unresolved `UNCERTAIN` entities.

Thumbnails serve as navigation — clicking one jumps directly to that page.

---

## Keyboard Shortcuts

Show in a small hint near the uncertain count. Most users won't need them. Users with long documents will.

```
Tab   →  jump to next uncertain item (scrolls document, pulses highlight)
R     →  mark current/focused item as REDACT
K     →  mark current/focused item as KEEP
```

---

## Footer Button Logic

```typescript
function getFooterButton(state: AppState, uncertainCount: number): ButtonConfig {
  if (state === 'PROCESSING') {
    return { label: 'Redacting...', disabled: true }
  }
  if (uncertainCount > 0) {
    return {
      label: `Resolve ${uncertainCount} item${uncertainCount > 1 ? 's' : ''} to continue`,
      disabled: false,         // clickable — jumps to first uncertain item
      action: 'JUMP_TO_FIRST_UNCERTAIN'
    }
  }
  return {
    label: 'Redact and Download',
    disabled: false,
    action: 'REDACT'
  }
}
```

The button is never just "disabled" with no explanation. When uncertain items remain, clicking the button navigates to the first unresolved item rather than doing nothing.

---

## Processing State (During Redaction)

After the user clicks Redact and Download, a progress overlay appears over the preview:

```
Redacting page 1 of 2...
[████████████░░░░░░░░░░]

Do not close this tab.
```

Progress increments per page. The "do not close this tab" message prevents users from closing the browser during what might be a 10–30 second process on long documents.

---

## Done State

When redaction completes, the browser's native download dialog triggers automatically with the filename:

```
[original-filename]-redacted.pdf
```

Never just `download.pdf`. The user needs to identify this file in their Downloads folder later.

After the download triggers, show a confirmation screen:

```
✓ Done

[original-filename]-redacted.pdf has been saved.

🔒 No data was transmitted. Your document never left this tab.

[Redact another document]
```

The zero-data confirmation at the end reinforces trust at the moment they're most satisfied with the tool.

---

## Error States

| Situation | Message | Action |
|---|---|---|
| File too large (>50MB) | "This file is too large. Maximum size is 50MB." | Return to drop screen |
| Wrong file type | "Only PDF files are supported in v1." | Return to drop screen |
| Password protected | "This PDF is password protected." | Show password input |
| Wrong password | "Incorrect password. Try again." | Stay on password modal |
| No text found (blank PDF) | "No text was detected. This may be a scanned document. Image support is coming in v1.2." | Return to drop screen |
| Detection failure | "Something went wrong analyzing this document. Please try again." | Retry or return to drop screen |
| PDF.js render error | "This PDF could not be rendered. It may be corrupted or use an unsupported format." | Return to drop screen |

All error messages are in plain English. No error codes. No stack traces. No jargon.

---

## The Zero-Data Trust Signal

Visible on three screens:

1. **Drop screen** — below the drop zone, in small text
2. **Preview screen** — in the left panel, persistent
3. **Done screen** — in the confirmation message

```
🔒 Your document never left this browser tab.
```

Consistent wording across all three placements.
