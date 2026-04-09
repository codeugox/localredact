// src/components/App.tsx
// Root shell that renders screens based on appState signal.
// Routes: IDLE/ERROR → DropScreen, LOADING → ProcessingScreen,
// NEEDS_REVIEW → PreviewScreen, PROCESSING → ProcessingScreen,
// DONE → DoneScreen.
// PasswordModal is mounted at root level so it remains visible
// regardless of current screen state (e.g., during LOADING).

import { appState } from '../app/state'
import {
  showPasswordModal,
  passwordReason,
  submitPassword,
  cancelPassword,
} from '../app/password-prompt'
import { DropScreen } from './DropScreen'
import { ProcessingScreen } from './ProcessingScreen'
import { PreviewScreen } from './PreviewScreen'
import { DoneScreen } from './DoneScreen'
import { PasswordModal } from './PasswordModal'

/**
 * Render the screen for the current app state.
 */
function CurrentScreen() {
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

/**
 * Root application component.
 * Renders the appropriate screen based on the current app state,
 * plus the global PasswordModal overlay when needed.
 */
export function App() {
  const isPasswordModalVisible = showPasswordModal.value
  const passwordReasonValue = passwordReason.value

  return (
    <>
      <CurrentScreen />
      {isPasswordModalVisible && (
        <PasswordModal
          reason={passwordReasonValue}
          onSubmit={submitPassword}
          onCancel={cancelPassword}
        />
      )}
    </>
  )
}
