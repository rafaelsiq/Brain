import { createPortal } from 'react-dom'

export function ErrorPopup({
  message,
  durationMs,
}: {
  message: string
  durationMs: number
}) {
  if (!message) return null

  return createPortal(
    <div className="error-popup" role="alert" aria-live="assertive">
      <div className="error error-popup-card">
        <span>{message}</span>
        <span className="error-progress-track" aria-hidden>
          <span className="error-progress" style={{ animationDuration: `${durationMs}ms` }} />
        </span>
      </div>
    </div>,
    document.body,
  )
}
