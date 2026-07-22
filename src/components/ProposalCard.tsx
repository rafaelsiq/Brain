import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ColoredVerse } from '@/components/ColoredVerse'
import type { TextSegment, VoteKind } from '@/types/domain'

const THRESHOLD = 56
const HINT_KEY = 'brain.pool.swipeHintSeen'

const VOTE_LABEL: Record<VoteKind, string> = {
  dislike: 'Não',
  continue: 'Seguir',
  accept: 'Aceitar',
}

type Counts = Record<VoteKind, number>

export function markSwipeHintSeen(): void {
  try {
    sessionStorage.setItem(HINT_KEY, '1')
  } catch {
    // ignore
  }
}

export function swipeHintVisible(): boolean {
  try {
    return sessionStorage.getItem(HINT_KEY) !== '1'
  } catch {
    return true
  }
}

export function ProposalCard({
  authorName,
  parentAuthorName,
  segments,
  authorColor,
  isDefinitive,
  myVote,
  counts,
  canMakeDefinitive,
  onVote,
  onUseAsBase,
  onMakeDefinitive,
}: {
  authorName: string
  parentAuthorName?: string
  segments: TextSegment[]
  authorColor: string
  isDefinitive: boolean
  myVote?: VoteKind
  counts: Counts
  canMakeDefinitive: boolean
  onVote: (kind: VoteKind) => void
  onUseAsBase: () => void
  onMakeDefinitive?: () => void
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moved = useRef(false)

  function clearLongPress() {
    if (longPress.current) {
      clearTimeout(longPress.current)
      longPress.current = null
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button, a')) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    moved.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    clearLongPress()
    longPress.current = setTimeout(() => {
      if (!moved.current) {
        setMenuOpen(true)
        setDragging(false)
        setOffset({ x: 0, y: 0 })
        start.current = null
      }
    }, 480)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.id !== e.pointerId) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      moved.current = true
      clearLongPress()
    }
    // Prefer dominant axis; allow slight upward bias for continue
    if (Math.abs(dx) > Math.abs(dy) || dy > 0) {
      setOffset({ x: dx, y: 0 })
    } else {
      setOffset({ x: 0, y: Math.min(0, dy) })
    }
  }

  function resolveGesture(dx: number, dy: number): VoteKind | null {
    if (dy < -THRESHOLD && Math.abs(dy) >= Math.abs(dx)) return 'continue'
    if (dx <= -THRESHOLD) return 'dislike'
    if (dx >= THRESHOLD) return 'accept'
    return null
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    clearLongPress()
    if (!start.current || start.current.id !== e.pointerId) return
    const kind = resolveGesture(offset.x, offset.y)
    start.current = null
    setDragging(false)
    setOffset({ x: 0, y: 0 })
    if (kind) {
      markSwipeHintSeen()
      onVote(kind)
    }
  }

  const hint: VoteKind | null = dragging ? resolveGesture(offset.x * 1.2, offset.y * 1.2) : null
  const hintClass =
    hint === 'dislike' ? 'hint-dislike' : hint === 'accept' ? 'hint-accept' : hint === 'continue' ? 'hint-continue' : ''

  return (
    <div className={`proposal-card-track ${hintClass}`}>
      <div className="proposal-card-hints" aria-hidden="true">
        <span className="proposal-hint left">Não</span>
        <span className="proposal-hint up">Seguir</span>
        <span className="proposal-hint right">Aceitar</span>
      </div>
      <div
        className={`proposal-card ${dragging ? 'dragging' : ''}`}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="row spread start">
          <div className="row grow">
            <span className="dot" style={{ background: authorColor }} />
            <div className="grow">
              <strong className="proposal-card-author">{authorName}</strong>
              {parentAuthorName && (
                <span className="muted proposal-card-from">(de {parentAuthorName})</span>
              )}
            </div>
          </div>
          <div className="row gap-sm">
            {isDefinitive && <span className="badge accent">definitiva</span>}
            {myVote && !isDefinitive && (
              <span className="proposal-vote-chip">{VOTE_LABEL[myVote]}</span>
            )}
            <button
              type="button"
              className="btn icon proposal-icon-btn"
              title="Usar como base"
              aria-label="Usar como base"
              onClick={(e) => {
                e.stopPropagation()
                onUseAsBase()
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 5v8a4 4 0 0 0 4 4h3M7 9h4a4 4 0 0 1 4 4v4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="7" cy="5" r="2" fill="currentColor" />
                <circle cx="18" cy="17" r="2" fill="currentColor" />
              </svg>
            </button>
            {canMakeDefinitive && onMakeDefinitive && !isDefinitive && (
              <button
                type="button"
                className="btn icon proposal-icon-btn accent"
                title="Definir como definitiva"
                aria-label="Definir como definitiva"
                onClick={(e) => {
                  e.stopPropagation()
                  onMakeDefinitive()
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5 9.5 17 19 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="btn icon proposal-icon-btn"
              title="Mais ações"
              aria-label="Mais ações"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
            >
              ···
            </button>
          </div>
        </div>

        <ColoredVerse segments={segments} />

        <p className="proposal-counts muted" aria-label="Contagem de votos">
          <span title="Não">Não {counts.dislike}</span>
          <span aria-hidden="true">·</span>
          <span title="Seguir">Seguir {counts.continue}</span>
          <span aria-hidden="true">·</span>
          <span title="Aceitar">Aceitar {counts.accept}</span>
        </p>

        {menuOpen && (
          <div className="proposal-menu" role="menu">
            {(
              [
                ['dislike', 'Não gosto'],
                ['continue', 'Seguir / continuar'],
                ['accept', 'Gostei (voto)'],
              ] as [VoteKind, string][]
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className={myVote === kind ? 'active' : ''}
                onClick={() => {
                  setMenuOpen(false)
                  markSwipeHintSeen()
                  onVote(kind)
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onUseAsBase()
              }}
            >
              Usar como base
            </button>
            {canMakeDefinitive && onMakeDefinitive && !isDefinitive && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onMakeDefinitive()
                }}
              >
                Definir definitiva
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
