import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const KEYBOARD_INSET_VAR = '--keyboard-inset'

function setKeyboardInset(px: number) {
  const value = `${Math.max(0, Math.round(px))}px`
  document.documentElement.style.setProperty(KEYBOARD_INSET_VAR, value)
}

function clearKeyboardInset() {
  document.documentElement.style.setProperty(KEYBOARD_INSET_VAR, '0px')
}

function syncInsetFromVisualViewport() {
  const vv = window.visualViewport
  if (!vv) {
    clearKeyboardInset()
    return
  }
  // When the layout viewport already resized (adjustResize / Keyboard body),
  // innerHeight shrinks with the keyboard and inset stays ~0 — avoids double offset.
  // When only the visual viewport shrinks (common on mobile web), inset lifts fixed UI.
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
  setKeyboardInset(inset > 40 ? inset : 0)
}

function isEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type
    return !['button', 'checkbox', 'radio', 'file', 'submit', 'reset', 'hidden', 'range', 'color'].includes(
      type,
    )
  }
  return false
}

function scrollFocusedIntoView(el: HTMLElement) {
  window.setTimeout(() => {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  }, 120)
}

/**
 * Keeps focused inputs visible above the soft keyboard and exposes
 * `--keyboard-inset` for fixed bottom UI (composer, sheet, nav).
 */
export function useKeyboardInset() {
  useEffect(() => {
    clearKeyboardInset()

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditableTarget(e.target)) return
      scrollFocusedIntoView(e.target)
    }
    document.addEventListener('focusin', onFocusIn)

    const vv = window.visualViewport
    const onViewportChange = () => syncInsetFromVisualViewport()
    if (vv) {
      vv.addEventListener('resize', onViewportChange)
      vv.addEventListener('scroll', onViewportChange)
    }
    window.addEventListener('resize', onViewportChange)

    const nativeHandles: { remove: () => Promise<void> }[] = []
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          nativeHandles.push(
            await Keyboard.addListener('keyboardDidShow', () => {
              syncInsetFromVisualViewport()
              const active = document.activeElement
              if (isEditableTarget(active)) scrollFocusedIntoView(active)
            }),
          )
          nativeHandles.push(
            await Keyboard.addListener('keyboardDidHide', () => {
              clearKeyboardInset()
            }),
          )
        } catch {
          // Plugin unavailable — visualViewport path still applies.
        }
      })()
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('resize', onViewportChange)
      if (vv) {
        vv.removeEventListener('resize', onViewportChange)
        vv.removeEventListener('scroll', onViewportChange)
      }
      for (const h of nativeHandles) void h.remove()
      clearKeyboardInset()
    }
  }, [])
}
