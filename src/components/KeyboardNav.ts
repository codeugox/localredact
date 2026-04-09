// src/components/KeyboardNav.ts
// Keyboard shortcut logic for the preview screen.
// Tab = focus next UNCERTAIN entity (wrap around)
// R = set focused entity to REDACT
// K = set focused entity to KEEP

import {
  entities,
  focusedEntityId,
  currentPage,
  dispatch,
} from '../app/state'

/**
 * Focus the next UNCERTAIN entity in document order.
 * Wraps around from the last uncertain back to the first.
 * Navigates to the entity's page if needed.
 */
export function focusNextUncertain(): void {
  const allEntities = entities.value
  const uncertain = allEntities.filter((e) => e.decision === 'UNCERTAIN')

  if (uncertain.length === 0) return

  const currentId = focusedEntityId.value
  let nextEntity = uncertain[0] // default: first uncertain

  if (currentId) {
    // Find the current focused entity's index in the uncertain list
    const currentIdx = uncertain.findIndex((e) => e.id === currentId)
    if (currentIdx >= 0 && currentIdx < uncertain.length - 1) {
      nextEntity = uncertain[currentIdx + 1]
    } else {
      // Wrap around to first
      nextEntity = uncertain[0]
    }
  }

  // Focus the entity
  dispatch({ type: 'FOCUS_ENTITY_ID', entityId: nextEntity.id })

  // Navigate to its page if needed
  if (currentPage.value !== nextEntity.page) {
    dispatch({ type: 'SET_PAGE', page: nextEntity.page })
  }
}

/**
 * Handle a keyboard shortcut key press.
 * @param key - The key that was pressed ('Tab', 'r', 'k', 'R', 'K')
 */
export function handleKeyboardShortcut(key: string): void {
  switch (key) {
    case 'Tab': {
      focusNextUncertain()
      break
    }

    case 'r':
    case 'R': {
      const entityId = focusedEntityId.value
      if (!entityId) return
      dispatch({ type: 'SET_ENTITY_DECISION', entityId, decision: 'REDACT' })
      break
    }

    case 'k':
    case 'K': {
      const entityId = focusedEntityId.value
      if (!entityId) return
      dispatch({ type: 'SET_ENTITY_DECISION', entityId, decision: 'KEEP' })
      break
    }
  }
}
