// src/components/ErrorMessage.tsx
// Reusable error display component.
// Shows a styled error message with icon. Used on drop screen for file validation errors.

interface ErrorMessageProps {
  message: string
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div class="error-message" role="alert">
      <svg
        class="error-message-icon"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M8 4.5v4M8 10.5v1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <span class="error-message-text">{message}</span>
    </div>
  )
}
