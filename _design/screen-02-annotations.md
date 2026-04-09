# Screen 2 Behavioral Annotations
*Read alongside screen-02-corrected.html*

---

## What Changed From the Previous Version and Why

### 1. Nav — no exit button

**Previous:** "← Cancel" in top nav and "← Back" in action bar.
**Corrected:** Nothing in nav. "← Start over" in action bar only.

**Why:** Two buttons doing the same thing in two locations is a
navigation ambiguity. The user has to decide which one to use.
The action bar owns all terminal actions — start over, resolve,
download. The nav owns only wayfinding — where you are, what file.

---

### 2. Tooltip — hover only

**Previous:** Tooltip pinned to SSN field. Always visible.
**Corrected:** CSS `display: none` by default. Shown on hover.
One cell has class `.tip-demo` in the mockup to force visibility
for reference. This class does not exist in production.

**Hover behavior:**
```
User hovers a highlight
  → tooltip appears above the cell
  → shows entity type, matched text, and "Keep instead" action
User moves mouse away
  → tooltip disappears immediately
```

**Viewport edge handling:**
If the hovered cell is near the top of the viewport, the tooltip
will clip. In production: check `cell.getBoundingClientRect().top`
before positioning. If less than ~80px from top, position the
tooltip BELOW the cell instead and flip the arrow.

**Tooltip content:**
```
Entity type label  (e.g. "US_SSN" in mono, muted)
Matched text       (e.g. "412–67–9823" in bold)
Action button      ("Keep instead" — toggles to hl-g on click)
```

The action button inside the tooltip is a shortcut to toggle.
Clicking the highlight itself also toggles. Both work. Don't add
a "Confirm redact" button — the default is already redact.

---

### 3. Panel → Document Link

**Previous:** Clicking an entity row visually selected it in the
panel but nothing happened on the document side.

**Corrected:** `data-entity` attributes connect rows to highlights.

**Implementation:**
- Every `.entity` row has `data-entity="[id]"`
- Every `.hl` has `data-entity="[id]"` matching its entity
- On row click:
  1. Remove `.active` from all rows, add to clicked row
  2. Remove `.hl-focused` from all highlights
  3. Add `.hl-focused` to all highlights matching `data-entity`
  4. Scroll first matching highlight into view
- `.hl-focused` adds a `2px solid #1C1812` outline (dark, distinct)

**Visual result:** The user clicks "Employee name" in the panel
and the name field on the document gets a dark outline. The
connection is immediate and unmistakable.

**Multiple instances:** If an entity type appears multiple times
(e.g. name appears in two cells), all matching highlights get
focused simultaneously. Scroll to the first one.

---

### 4. Jump Button — navigation, not batch action

**Previous:** "Resolve 2 items" — implies batch resolution.
**Corrected:** "Go to next unresolved ↓" — implies navigation.

**Behavior:**
```
User clicks "Go to next unresolved ↓"
  → finds first .hl.hl-a in document order
  → adds .hl-focused to it
  → scrolls it into view (smooth, center)
  → selects matching entity row in panel
  → does NOT change the highlight state
```

The user must still click the highlight to set it to redact or keep.
The jump button only navigates — it puts the uncertain item in front
of the user and waits.

**Visibility:**
- Visible while `counts.a > 0`
- Hidden (display: none) when `counts.a === 0`
- Transition: no animation, instant show/hide is fine

---

### 5. Output Transformation Note

**Previous:** Absent. User had no mental model of what downloads.
**Corrected:** A thin bar between the toolbar and the document.

**Content:**
```
[tinted swatch] Preview  →  [black bar swatch] Downloaded PDF  ·
Text stays visible here so you can verify. The downloaded file has
permanent black bars — nothing recoverable.
```

**Placement:** Between `doc-bar` (zoom/page toolbar) and `viewport`.
Not inside the document. Not in the action bar. It belongs here
because it describes what the user is looking at, and its
relationship to what they'll receive.

**Do not remove this.** The delta between "I see colored text" and
"it downloads as a black bar" is the most important UX information
on this screen. Without it, users will be surprised by the output.

---

### 6. Reactive Count Chips

**Previous:** Static numbers (5 removing / 4 keeping / 2 review).
**Corrected:** Updated by `updateCounts()` on every highlight toggle.

**State object:**
```js
let counts = { r: 5, g: 4, a: 2 }
```

**On every highlight toggle:**
- Increment/decrement the appropriate counts
- Call `updateCounts()` which:
  - Updates DOM text in all three chips
  - Hides jump button when `counts.a === 0`
  - Enables download button when `counts.a === 0`
  - Hides/shows callout when `counts.a === 0`
  - Updates callout text to show current count

**Initial state:**
Derives from the actual detection output. In the real app,
initialize `counts` by tallying the initial decisions set by
the active mode (identity-only or full redaction).

---

### 7. Download Button State Machine

```
counts.a > 0
  → btn-download.disabled = true
  → opacity 0.28, cursor not-allowed
  → btn-jump visible

counts.a === 0
  → btn-download.disabled = false
  → full opacity, clickable
  → btn-jump hidden
```

The download button is **always visible** — never hidden.
A hidden button gives the user no information about what to do.
A dimmed button with a sibling "Go to next unresolved" button
communicates the exact state and the exact next action.

---

## Entity ID Reference

| Entity ID    | Highlight class | Cells it appears on              |
|---|---|---|
| `ssn`        | hl-r            | Employee SSN field               |
| `name`       | hl-r, hl-focused | Employee name field             |
| `address`    | hl-r            | Employee address field           |
| `phone`      | hl-r            | (not shown in this page)         |
| `money`      | hl-g            | All dollar amount fields (×4)    |
| `ein`        | hl-a            | Employer EIN field               |
| `employer`   | hl-a            | Employer name/address field      |

---

## Interaction Flow — Full Sequence

```
User arrives at this screen
  ← Detection has already run
  ← Mode was selected on screen 1
  ← All highlights are pre-assigned by mode defaults

User sees:
  - Left panel listing all entities by group
  - Document with color-coded highlights
  - Output note explaining preview vs. output
  - "Go to next unresolved ↓" button (2 uncertain items)
  - Download button (disabled)

User clicks "Go to next unresolved ↓"
  → EIN cell gets dark outline, panel selects "Employer EIN"
  → Scrolled into view

User clicks the EIN highlight on the document
  → hl-a becomes hl-r
  → Panel tag changes from "Review" to "Remove"
  → counts.a goes from 2 to 1
  → Callout updates to "1 item needs a decision"

User clicks "Go to next unresolved ↓"
  → Employer name cell focused

User clicks employer name highlight
  → hl-a becomes hl-r
  → counts.a goes from 1 to 0
  → Jump button disappears
  → Download button enables
  → Callout disappears

User clicks highlighted fields to review
  → SSN (hl-r) → clicks → becomes hl-g (keeping)
  → counts.r goes from 5 to 4, counts.g from 4 to 5

User satisfied, clicks "Download redacted PDF"
  → Redaction pipeline runs
  → Progress overlay appears
  → Browser download dialog triggers
  → Done screen appears
```

---

## Things That Must Not Change

- The `.tip-demo` class is ONLY for the mockup. Remove before shipping.
- The output note bar must stay. No exceptions.
- One exit button. Never add a second.
- The download button must always be visible, even when disabled.
- Count chips must always be live. Never display static numbers.
- `data-entity` attributes must be present on both rows and highlights
  for the panel-document link to work. Do not remove them.
