import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { TourStep } from '@/lib/tourSteps'

const PAD = 8
const MARGIN = 12
const BUBBLE_ESTIMATE_H = 170

type Rect = { top: number; left: number; width: number; height: number }

function isVisible(el: HTMLElement): boolean {
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }
  const r = el.getBoundingClientRect()
  return r.width >= 2 && r.height >= 2
}

function findAnchor(step: TourStep): HTMLElement | null {
  const ids = [step.anchor, ...(step.fallbackAnchors ?? [])]
  for (const id of ids) {
    const nodes = [...document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)]
    const visible = nodes.filter(isVisible)
    if (visible.length === 0) continue
    // Prefer FAB / fixed controls when multiple anchors share the same id
    const fab = visible.find((el) => el.classList.contains('fab'))
    if (fab) return fab
    return visible[0]!
  }
  return null
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
}

function bubbleStyleFor(rect: Rect | null): CSSProperties {
  const maxW = Math.min(320, window.innerWidth - MARGIN * 2)

  if (!rect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: maxW,
      maxWidth: maxW,
    }
  }

  const spaceBelow = window.innerHeight - (rect.top + rect.height) - MARGIN
  const spaceAbove = rect.top - MARGIN
  const placeAbove = spaceBelow < BUBBLE_ESTIMATE_H && spaceAbove >= spaceBelow

  const targetCenterX = rect.left + rect.width / 2
  let left = targetCenterX - maxW / 2
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - MARGIN - maxW))

  if (placeAbove) {
    return {
      top: 'auto',
      bottom: Math.max(MARGIN, window.innerHeight - rect.top + 12),
      left,
      transform: 'none',
      width: maxW,
      maxWidth: maxW,
    }
  }

  let top = rect.top + rect.height + 12
  const maxTop = window.innerHeight - MARGIN - BUBBLE_ESTIMATE_H
  top = Math.min(top, Math.max(MARGIN, maxTop))

  return {
    top,
    bottom: 'auto',
    left,
    transform: 'none',
    width: maxW,
    maxWidth: maxW,
  }
}

export function TourSpotlight({
  step,
  stepIndex,
  stepCount,
  missing,
  onNext,
  onSkip,
  contextual = false,
  /** Remeasure when route/content changes (e.g. songs hydrate). */
  remeasureKey = '',
}: {
  step: TourStep
  stepIndex: number
  stepCount: number
  missing: boolean
  onNext: () => void
  onBack?: () => void
  onSkip: () => void
  contextual?: boolean
  remeasureKey?: string
}) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [bubbleStyle, setBubbleStyle] = useState<CSSProperties>(() => bubbleStyleFor(null))

  useLayoutEffect(() => {
    let cancelled = false
    let tries = 0

    function update() {
      if (cancelled) return
      const el = findAnchor(step)
      if (!el) {
        setRect(null)
        setBubbleStyle(bubbleStyleFor(null))
        return false
      }
      const next = measure(el)
      setRect(next)
      setBubbleStyle(bubbleStyleFor(next))
      return true
    }

    update()

    // Retry briefly — anchors may appear after data hydrate / route paint
    const poll = window.setInterval(() => {
      tries += 1
      const ok = update()
      if (ok || tries > 20) window.clearInterval(poll)
    }, 100)

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step, remeasureKey])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onSkip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])

  const body = missing || !rect ? step.missingBody : step.body

  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-scrim" onClick={onSkip} />
      {rect && (
        <div
          className="tour-hole"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
      <div className="tour-bubble" style={bubbleStyle}>
        <p className="tour-step-count">
          {stepIndex + 1}/{stepCount}
        </p>
        <h2 id="tour-title" className="tour-title">
          {step.title}
        </h2>
        <p className="tour-body">{body}</p>
        <div className="tour-actions">
          <button type="button" className="btn ghost compact" onClick={onSkip}>
            Pular guia
          </button>
          <div className="tour-actions-nav">
            <button type="button" className="btn compact" onClick={onNext}>
              {contextual ? 'Entendi' : stepIndex >= stepCount - 1 ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
