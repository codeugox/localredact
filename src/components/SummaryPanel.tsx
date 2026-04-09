// src/components/SummaryPanel.tsx
// Left sidebar panel: mode tabs, entity list grouped by decision,
// callout for uncertain items, legend, panel-to-document linking.

import { useCallback } from 'preact/hooks'
import {
  entities,
  currentMode,
  currentFile,
  currentPage,
  redactCount,
  keepCount,
  uncertainCount,
  focusedEntity,
  dispatch,
} from '../app/state'
import type { EntityType, RedactionDecision, RedactionMode } from '../core/detectors/entities'

// ─── Entity type display names ──────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  US_SSN: 'Social security no.',
  US_ITIN: 'Individual TIN',
  US_EIN: 'Employer EIN',
  CREDIT_CARD: 'Credit card',
  PHONE_NUMBER: 'Phone number',
  EMAIL_ADDRESS: 'Email address',
  STREET_ADDRESS: 'Street address',
  CITY_STATE_ZIP: 'City, state & ZIP',
  ADDRESS: 'Address',
  ZIP_CODE: 'ZIP code',
  DATE_OF_BIRTH: 'Date of birth',
  BANK_ACCOUNT: 'Bank account',
  ROUTING_NUMBER: 'Routing number',
  MONEY: 'Dollar amounts',
  PERSON: 'Person name',
  ORG: 'Organization',
  PASSPORT: 'Passport number',
}

// No internal state needed — focusedEntity signal from state.ts is the source of truth

// ─── Grouping helper ────────────────────────────────────────────────

interface EntityGroup {
  type: EntityType
  decision: RedactionDecision
  count: number
  /** IDs of all entities in this group */
  entityIds: string[]
}

/**
 * Group entities by (decision, type) and count them.
 */
function groupEntities(
  entityList: typeof entities.value
): {
  removing: EntityGroup[]
  keeping: EntityGroup[]
  uncertain: EntityGroup[]
} {
  const groups = new Map<string, EntityGroup>()

  for (const entity of entityList) {
    const key = `${entity.decision}:${entity.type}`
    const existing = groups.get(key)
    if (existing) {
      existing.count++
      existing.entityIds.push(entity.id)
    } else {
      groups.set(key, {
        type: entity.type,
        decision: entity.decision,
        count: 1,
        entityIds: [entity.id],
      })
    }
  }

  const removing: EntityGroup[] = []
  const keeping: EntityGroup[] = []
  const uncertain: EntityGroup[] = []

  for (const group of groups.values()) {
    switch (group.decision) {
      case 'REDACT':
        removing.push(group)
        break
      case 'KEEP':
        keeping.push(group)
        break
      case 'UNCERTAIN':
        uncertain.push(group)
        break
    }
  }

  return { removing, keeping, uncertain }
}

// ─── Re-run detection on mode switch ─────────────────────────────────

/**
 * Re-run the detection pipeline with a new mode.
 * This is triggered when the user switches mode tabs during review.
 */
async function rerunDetection(file: File, mode: RedactionMode): Promise<void> {
  dispatch({ type: 'DETECTION_START' })

  try {
    const { detectDocument } = await import('../core/pipeline/detect-document')
    const result = await detectDocument(
      file,
      mode,
      (page, total) => {
        dispatch({ type: 'DETECTION_PROGRESS', page, total })
      }
    )
    dispatch({
      type: 'DETECTION_COMPLETE',
      entities: result.entities,
      pages: result.pages,
      totalPages: result.pages.length,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    dispatch({ type: 'ERROR', message })
  }
}

// ─── Scroll helper ──────────────────────────────────────────────────

/**
 * Scroll the document viewport to the first SVG rect with the given entity ID.
 */
function scrollToEntity(entityId: string): void {
  const group = document.querySelector(`[data-entity-id="${entityId}"]`)
  if (!group) return
  const rect = group.querySelector('rect')
  if (!rect) return
  rect.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// ─── Component ──────────────────────────────────────────────────────

export function SummaryPanel() {
  const mode = currentMode.value
  const entityList = entities.value
  const uncertain = uncertainCount.value
  const active = focusedEntity.value

  const { removing, keeping, uncertain: uncertainGroups } = groupEntities(entityList)
  const removingTotal = redactCount.value
  const keepingTotal = keepCount.value
  const uncertainTotal = uncertainCount.value

  // ─── Mode tab handler ──────────────────────────────────────────

  const handleModeSwitch = useCallback((newMode: RedactionMode) => {
    if (newMode === currentMode.value) return
    dispatch({ type: 'SET_MODE', mode: newMode })

    // Re-run detection with the new mode
    const file = currentFile.value
    if (file) {
      rerunDetection(file, newMode)
    }
  }, [])

  // ─── Entity row click handler ──────────────────────────────────

  const handleEntityClick = useCallback((entityType: EntityType) => {
    dispatch({ type: 'FOCUS_ENTITY', entityType })

    // Find the first entity of this type to scroll to
    const entityList = entities.value
    const target = entityList.find((e) => e.type === entityType)
    if (!target) return

    // Navigate to the entity's page if needed
    if (currentPage.value !== target.page) {
      dispatch({ type: 'SET_PAGE', page: target.page })
      // After page change, scroll after a short delay to allow render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToEntity(target.id)
        })
      })
    } else {
      scrollToEntity(target.id)
    }
  }, [])

  return (
    <>
      {/* Mode section */}
      <div class="pb">
        <div class="sec-label">Mode</div>
        <div class="tabs">
          <button
            class={`tab ${mode === 'IDENTITY_ONLY' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('IDENTITY_ONLY')}
            type="button"
          >
            Identity only
          </button>
          <button
            class={`tab ${mode === 'FULL_REDACTION' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('FULL_REDACTION')}
            type="button"
          >
            Full redact
          </button>
        </div>
      </div>

      {/* Entity list */}
      <div class="entity-scroll">
        {/* Removing group */}
        {removing.length > 0 && (
          <>
            <div class="group-label">
              Removing
              <span class="group-count count-chip count-chip--redact">
                <span class="count-chip-dot count-chip-dot--redact" />
                {removingTotal}
              </span>
            </div>
            {removing.map((group) => (
              <div
                key={`r-${group.type}`}
                class={`entity ${active === group.type ? 'active' : ''}`}
                data-entity={group.type}
                onClick={() => handleEntityClick(group.type)}
              >
                <div class="pip pip-r" />
                <span class="entity-name">{ENTITY_TYPE_LABELS[group.type]}</span>
                <span class="entity-count">×{group.count}</span>
              </div>
            ))}
          </>
        )}

        {/* Separator between removing and keeping */}
        {removing.length > 0 && keeping.length > 0 && (
          <div class="entity-sep" />
        )}

        {/* Keeping group */}
        {keeping.length > 0 && (
          <>
            <div class="group-label">
              Keeping
              <span class="group-count count-chip count-chip--keep">
                <span class="count-chip-dot count-chip-dot--keep" />
                {keepingTotal}
              </span>
            </div>
            {keeping.map((group) => (
              <div
                key={`k-${group.type}`}
                class={`entity ${active === group.type ? 'active' : ''}`}
                data-entity={group.type}
                onClick={() => handleEntityClick(group.type)}
              >
                <div class="pip pip-g" />
                <span class="entity-name">{ENTITY_TYPE_LABELS[group.type]}</span>
                <span class="entity-count">×{group.count}</span>
              </div>
            ))}
          </>
        )}

        {/* Separator before uncertain */}
        {(removing.length > 0 || keeping.length > 0) && uncertainGroups.length > 0 && (
          <div class="entity-sep" />
        )}

        {/* Your decision group */}
        {uncertainGroups.length > 0 && (
          <>
            <div class="group-label">
              Your decision
              <span class="group-count count-chip count-chip--uncertain">
                <span class="count-chip-dot count-chip-dot--uncertain" />
                {uncertainTotal}
              </span>
            </div>
            {uncertainGroups.map((group) => (
              <div
                key={`u-${group.type}`}
                class={`entity ${active === group.type ? 'active' : ''}`}
                data-entity={group.type}
                onClick={() => handleEntityClick(group.type)}
              >
                <div class="pip pip-a" />
                <span class="entity-name">{ENTITY_TYPE_LABELS[group.type]}</span>
                <span class="tag tag-review">Review</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Callout — visible when uncertain > 0 */}
      {uncertain > 0 ? (
        <div class="callout">
          <div class="callout-row">
            <svg class="callout-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1.5 L12.5 11.5 H1.5 L7 1.5Z"
                stroke="#A86E00"
                stroke-width="1.2"
                stroke-linejoin="round"
              />
              <line
                x1="7" y1="5.5" x2="7" y2="8.5"
                stroke="#A86E00"
                stroke-width="1.2"
                stroke-linecap="round"
              />
              <circle cx="7" cy="10.5" r="0.6" fill="#A86E00" />
            </svg>
            <span class="callout-head">
              {uncertain} item{uncertain !== 1 ? 's' : ''} need a decision
            </span>
          </div>
          <div class="callout-sub">Click each highlight on the document</div>
        </div>
      ) : (
        <div class="callout hidden" />
      )}

      {/* Legend */}
      <div class="legend">
        <div class="sec-label" style={{ marginBottom: '8px' }}>Legend</div>
        <div class="legend-row">
          <div class="swatch sw-r" />
          <span class="legend-text">Will be removed</span>
          <span class="legend-hint">click to keep</span>
        </div>
        <div class="legend-row">
          <div class="swatch sw-g" />
          <span class="legend-text">Keeping</span>
          <span class="legend-hint">click to remove</span>
        </div>
        <div class="legend-row">
          <div class="swatch sw-a" />
          <span class="legend-text">Needs decision</span>
          <span class="legend-hint">click to decide</span>
        </div>
      </div>
    </>
  )
}
