// src/components/HighlightGroup.tsx
// SVG <g> group containing one <rect> per quad for a single detected entity.
// Styled via CSS classes: .hl-r (red/REDACT), .hl-g (green/KEEP),
// .hl-a (amber/UNCERTAIN with pulse animation).
// Click handler dispatches TOGGLE_ENTITY to cycle decision state.
// Focus state: .hl-focused applied when entity type matches focusedEntity signal.

import type { Quad, RedactionDecision, EntityType } from '../core/detectors/entities'
import type { Viewport } from '../utils/coords'
import { quadToCanvas, quadToRect } from '../utils/coords'
import { dispatch, focusedEntity } from '../app/state'

// ─── Props ──────────────────────────────────────────────────────────

export interface HighlightGroupProps {
  /** Unique entity ID for data attribute and dispatch */
  entityId: string
  /** Entity type for focus matching */
  entityType: EntityType
  /** Current redaction decision */
  decision: RedactionDecision
  /** One or more quads in PDF coordinate space */
  quads: Quad[]
  /** PDF.js viewport for coordinate transformation */
  viewport: Viewport
}

// ─── Decision → CSS class mapping ───────────────────────────────────

const DECISION_CLASS: Record<RedactionDecision, string> = {
  REDACT: 'hl-r',
  KEEP: 'hl-g',
  UNCERTAIN: 'hl-a',
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Renders an SVG <g> group with one <rect> per quad for a detected entity.
 *
 * - Transforms quads from PDF space to canvas space via viewport
 * - Converts canvas-space quads to axis-aligned bounding rects
 * - Applies highlight class based on decision state
 * - Applies .hl-focused when entity type matches focusedEntity signal
 * - Dispatches TOGGLE_ENTITY on click
 */
export function HighlightGroup({
  entityId,
  entityType,
  decision,
  quads,
  viewport,
}: HighlightGroupProps) {
  const decisionClass = DECISION_CLASS[decision]
  const isFocused = focusedEntity.value === entityType
  const cssClass = isFocused ? `${decisionClass} hl-focused` : decisionClass

  const handleClick = () => {
    dispatch({ type: 'TOGGLE_ENTITY', entityId })
  }

  return (
    <g
      class={cssClass}
      data-entity-id={entityId}
      data-decision={decision}
      onClick={handleClick}
    >
      {quads.map((quad, i) => {
        const canvasQuad = quadToCanvas(quad, viewport)
        const rect = quadToRect(canvasQuad)
        return (
          <rect
            key={i}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
          />
        )
      })}
    </g>
  )
}
