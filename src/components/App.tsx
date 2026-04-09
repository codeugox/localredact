// src/components/App.tsx
// Root shell that renders screens based on appState signal.
// Routes: IDLE/ERROR → DropScreen, LOADING → ProcessingScreen,
// NEEDS_REVIEW → PreviewScreen, PROCESSING → ProcessingScreen,
// DONE → DoneScreen

import { appState } from '../app/state'
import { DropScreen } from './DropScreen'

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
      // ProcessingScreen will be built in a future feature
      return (
        <div class="app-main">
          <div class="container-sm text-center">
            <p>Processing…</p>
          </div>
        </div>
      )

    case 'NEEDS_REVIEW':
      // PreviewScreen will be built in a future feature
      return (
        <div class="app-main">
          <div class="container-sm text-center">
            <p>Preview</p>
          </div>
        </div>
      )

    case 'PROCESSING':
      // ProcessingScreen (redaction phase) will be built in a future feature
      return (
        <div class="app-main">
          <div class="container-sm text-center">
            <p>Processing…</p>
          </div>
        </div>
      )

    case 'DONE':
      // DoneScreen will be built in a future feature
      return (
        <div class="app-main">
          <div class="container-sm text-center">
            <p>Done</p>
          </div>
        </div>
      )

    default:
      return <DropScreen />
  }
}
