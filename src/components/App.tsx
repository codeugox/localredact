// src/components/App.tsx
// Root shell that renders screens based on appState signal.
// Routes: IDLE/ERROR → DropScreen, LOADING → ProcessingScreen,
// NEEDS_REVIEW → PreviewScreen, PROCESSING → ProcessingScreen,
// DONE → DoneScreen.
// NavBar is rendered above all screens for consistent navigation.
// PasswordModal is mounted at root level so it remains visible
// regardless of current screen state (e.g., during LOADING).
// MobileBanner shows a dismissible notice on narrow viewports.

import { signal } from '@preact/signals'
import { useCallback, useEffect } from 'preact/hooks'
import { appState, currentFile } from '../app/state'
import {
  showPasswordModal,
  passwordReason,
  submitPassword,
  cancelPassword,
} from '../app/password-prompt'
import { NavBar } from './NavBar'
import { DropScreen } from './DropScreen'
import { ProcessingScreen } from './ProcessingScreen'
import { PreviewScreen } from './PreviewScreen'
import { DoneScreen } from './DoneScreen'
import { PasswordModal } from './PasswordModal'

// ─── Mobile banner state ────────────────────────────────────────────

/** Whether the mobile banner has been dismissed this session */
const mobileBannerDismissed = signal(false)

/** Whether the viewport is narrow (< 768px) */
const isMobileViewport = signal(
  typeof window !== 'undefined' ? window.innerWidth < 768 : false
)

/**
 * Dismissible banner shown on mobile viewports.
 */
function MobileBanner() {
  const dismissed = mobileBannerDismissed.value
  const isMobile = isMobileViewport.value

  useEffect(() => {
    function handleResize() {
      isMobileViewport.value = window.innerWidth < 768
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleDismiss = useCallback(() => {
    mobileBannerDismissed.value = true
  }, [])

  if (dismissed || !isMobile) return null

  return (
    <div class="mobile-banner" role="status">
      <span class="mobile-banner-text">
        Local Redact works best on desktop. You can continue, but the interface
        is optimized for larger screens.
      </span>
      <button
        class="mobile-banner-close"
        onClick={handleDismiss}
        type="button"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

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
 * Renders the NavBar + appropriate screen based on the current app state,
 * plus the global PasswordModal overlay when needed.
 */
export function App() {
  const state = appState.value
  const file = currentFile.value
  const isPasswordModalVisible = showPasswordModal.value
  const passwordReasonValue = passwordReason.value

  // ─── beforeunload warning ───────────────────────────────────

  useEffect(() => {
    if (state === 'NEEDS_REVIEW' || state === 'PROCESSING') {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault()
      }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [state])

  // ─── document.title updates ─────────────────────────────────

  useEffect(() => {
    switch (state) {
      case 'IDLE':
      case 'ERROR':
        document.title = 'Local Redact'
        break
      case 'LOADING':
        document.title = 'Processing… — Local Redact'
        break
      case 'NEEDS_REVIEW':
        document.title = file
          ? `Review — ${file.name} — Local Redact`
          : 'Review — Local Redact'
        break
      case 'PROCESSING':
        document.title = 'Redacting… — Local Redact'
        break
      case 'DONE':
        document.title = 'Done — Local Redact'
        break
    }
  }, [state, file])

  return (
    <>
      <MobileBanner />
      <NavBar />
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
