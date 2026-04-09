// src/components/App.tsx
// Root shell that renders screens based on appState signal.
// Routes: IDLE/ERROR → DropScreen, LOADING → ProcessingScreen,
// NEEDS_REVIEW → PreviewScreen, PROCESSING → ProcessingScreen,
// DONE → DoneScreen

import { appState } from '../app/state'
import { DropScreen } from './DropScreen'
import { ProcessingScreen } from './ProcessingScreen'
import { PreviewScreen } from './PreviewScreen'
import { DoneScreen } from './DoneScreen'

/**
 * Root application component.
 * Renders the appropriate screen based on the current app state.
 */
export function App() {
  const state = appState.value

  switch (state) {
    case 'IDLE':
    case 'ERROR':
      return <DropScreen />

    case 'LOADING':
      return <ProcessingScreen />

    case 'NEEDS_REVIEW':
      return <PreviewScreen />

    case 'PROCESSING':
      return <ProcessingScreen />

    case 'DONE':
      return <DoneScreen />

    default:
      return <DropScreen />
  }
}
