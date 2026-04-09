// src/components/EntityTooltip.tsx
// Tooltip shown on hover over a highlight.
// Dark bg (#1C1812), 6px radius. Content: entity type label (mono, muted),
// matched text (bold), action button ('Keep instead' for REDACT, 'Remove instead' for KEEP).
// Clicking action button toggles entity decision.
// Positioned above highlight; if <80px from viewport top, flip below.

import type { DetectedEntity, EntityType } from '../core/detectors/entities'
import { dispatch } from '../app/state'

// ─── Entity type display names ──────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  US_SSN: 'US_SSN',
  US_ITIN: 'US_ITIN',
  US_EIN: 'US_EIN',
  CREDIT_CARD: 'CREDIT_CARD',
  PHONE_NUMBER: 'PHONE_NUMBER',
  EMAIL_ADDRESS: 'EMAIL_ADDRESS',
  STREET_ADDRESS: 'STREET_ADDRESS',
  CITY_STATE_ZIP: 'CITY_STATE_ZIP',
  ADDRESS: 'ADDRESS',
  ZIP_CODE: 'ZIP_CODE',
  DATE_OF_BIRTH: 'DATE_OF_BIRTH',
  BANK_ACCOUNT: 'BANK_ACCOUNT',
  ROUTING_NUMBER: 'ROUTING_NUMBER',
  MONEY: 'MONEY',
  PERSON: 'PERSON',
  ORG: 'ORG',
  PASSPORT: 'PASSPORT',
}

// ─── Props ──────────────────────────────────────────────────────────

export interface EntityTooltipProps {
  /** The entity to display info for */
  entity: DetectedEntity
  /** X position for tooltip center (CSS pixels relative to viewport container) */
  x: number
  /** Y position for tooltip (CSS pixels, top of highlight rect) */
  y: number
  /** Whether tooltip is flipped below the highlight (<80px from top) */
  flipped: boolean
  /** Called when mouse enters the tooltip container */
  onMouseEnter?: () => void
  /** Called when mouse leaves the tooltip container */
  onMouseLeave?: () => void
}

// ─── Action text helper ─────────────────────────────────────────────

function getActionText(decision: DetectedEntity['decision']): string {
  switch (decision) {
    case 'REDACT':
      return 'Keep instead'
    case 'KEEP':
      return 'Remove instead'
    case 'UNCERTAIN':
      return 'Redact'
  }
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Entity tooltip shown on hover over a highlight rect.
 * Dark background, entity type label, matched text, action button.
 */
export function EntityTooltip({ entity, x, y, flipped, onMouseEnter, onMouseLeave }: EntityTooltipProps) {
  const handleAction = (e: Event) => {
    e.stopPropagation()
    dispatch({ type: 'TOGGLE_ENTITY', entityId: entity.id })
  }

  return (
    <div
      class={`entity-tooltip${flipped ? ' tooltip-flipped' : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div class="tooltip-type">{ENTITY_TYPE_LABELS[entity.type]}</div>
      <div class="tooltip-text">{entity.text}</div>
      <button class="tooltip-action" onClick={handleAction} type="button">
        {getActionText(entity.decision)}
      </button>
      <div class="tooltip-arrow" />
    </div>
  )
}
