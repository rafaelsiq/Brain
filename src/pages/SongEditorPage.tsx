import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ColoredVerse } from '@/components/ColoredVerse'
import { Page } from '@/components/Page'
import { ProposalCard, swipeHintVisible } from '@/components/ProposalCard'
import { Sheet } from '@/components/Sheet'
import { buildColoredSegments } from '@/lib/diff'
import { computeRhymeScheme } from '@/lib/rhyme'
import { stanzaLabel } from '@/lib/stanza'
import { orderProposalThread } from '@/lib/proposalThread'
import {
  acceptProposal,
  addStanza,
  appendVerse,
  canAccessSong,
  castVote,
  currentProfile,
  deleteStanza,
  joinSongSession,
  mergeSongRemote,
  proposeVerse,
  stanzaComplete,
  usingFirebase,
  voteCounts,
} from '@/data/store'
import { watchSongData } from '@/data/firebaseRepo'
import { useBrainStore } from '@/data/useBrainStore'
import type { VerseProposal } from '@/types/domain'

export function SongEditorPage() {
  const { groupId = '', songId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const state = useBrainStore()
  const profile = currentProfile()!
  const song = state.songs.find((s) => s.id === songId)

  const initialStanza = Number(searchParams.get('stanza') ?? '0')
  const [stanzaIndex, setStanzaIndex] = useState(
    Number.isFinite(initialStanza) && initialStanza >= 0 ? initialStanza : 0,
  )
  const [showRhymes, setShowRhymes] = useState(true)
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [addingNewVerse, setAddingNewVerse] = useState(false)
  const [parentId, setParentId] = useState<string | undefined>()
  const [draft, setDraft] = useState('')
  const [sessionColor, setSessionColor] = useState('#E8A838')
  const [showSwipeHint, setShowSwipeHint] = useState(() => swipeHintVisible())
  const [composeError, setComposeError] = useState('')

  useEffect(() => {
    if (!song || !canAccessSong(songId, profile.id)) return
    let cancelled = false
    void joinSongSession(songId, profile.id).then((color) => {
      if (!cancelled) setSessionColor(color)
    })
    const t = setInterval(() => {
      void joinSongSession(songId, profile.id)
    }, 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [songId, profile.id, song])

  useEffect(() => {
    if (!usingFirebase || !songId) return
    return watchSongData(songId, (partial) => mergeSongRemote(songId, partial))
  }, [songId])

  const stanzas = useMemo(
    () =>
      state.stanzas
        .filter((s) => s.songId === songId)
        .sort((a, b) => a.index - b.index),
    [state.stanzas, songId],
  )

  useEffect(() => {
    const raw = Number(searchParams.get('stanza') ?? '0')
    if (!Number.isFinite(raw) || stanzas.length === 0) return
    setStanzaIndex(Math.max(0, Math.min(raw, stanzas.length - 1)))
  }, [searchParams, stanzas.length])

  const stanza = stanzas[stanzaIndex]
  const slots = useMemo(
    () =>
      state.slots
        .filter((s) => s.stanzaId === stanza?.id)
        .sort((a, b) => a.index - b.index),
    [state.slots, stanza?.id],
  )

  const presence = state.sessions.filter(
    (s) => s.songId === songId && Date.now() - new Date(s.lastSeenAt).getTime() < 5 * 60_000,
  )

  const pool = orderProposalThread(
    state.proposals
      .filter((p) => p.slotId === activeSlotId)
      .map((proposal) => ({ proposal })),
    (a, b) => {
      const va = voteCounts(a.proposal.id)
      const vb = voteCounts(b.proposal.id)
      return vb.accept + vb.continue - (va.accept + va.continue)
    },
  )

  const parent = state.proposals.find((p) => p.id === parentId)
  const previewSegments = buildColoredSegments(
    draft || ' ',
    profile.id,
    sessionColor,
    parent?.segments,
  )

  if (!song || !canAccessSong(songId, profile.id)) {
    return (
      <Page title="Editor" backTo={`/groups/${groupId}`}>
        <div className="empty">Sem acesso a esta música</div>
      </Page>
    )
  }

  function openCompose(slotId: string, from?: VerseProposal) {
    setAddingNewVerse(false)
    setActiveSlotId(slotId)
    setParentId(from?.id)
    setDraft(from?.text ?? '')
    setComposeError('')
    setComposeOpen(true)
  }

  function openNewVerseCompose() {
    setAddingNewVerse(true)
    setActiveSlotId(null)
    setParentId(undefined)
    setDraft('')
    setComposeError('')
    setComposeOpen(true)
  }

  async function onPublish(e: FormEvent) {
    e.preventDefault()
    setComposeError('')
    try {
      if (addingNewVerse) {
        if (!stanza) return
        const proposal = await appendVerse({
          songId,
          authorId: profile.id,
          text: draft,
          sessionColor,
          stanzaId: stanza.id,
        })
        setAddingNewVerse(false)
        setComposeOpen(false)
        setDraft('')
        setActiveSlotId(proposal.slotId)
        return
      }
      if (!activeSlotId) return
      await proposeVerse({
        slotId: activeSlotId,
        authorId: profile.id,
        text: draft,
        parentProposalId: parentId,
        sessionColor,
      })
      setComposeOpen(false)
      setDraft('')
      setParentId(undefined)
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Não foi possível publicar')
    }
  }

  const sameAsBase =
    Boolean(parent) &&
    draft.trim().replace(/\s+/g, ' ').toLowerCase() ===
      parent!.text.trim().replace(/\s+/g, ' ').toLowerCase()

  const complete = stanza ? stanzaComplete(stanza.id) : false
  const creator = state.profiles.find((p) => p.id === song.createdBy)
  const creatorMember = state.members.find(
    (m) => m.groupId === song.groupId && m.userId === song.createdBy,
  )

  return (
    <Page kicker="edição" title={song.title} backTo={`/groups/${groupId}/songs/${songId}`} narrow>
      <div className="row wrap">
        <span className="badge accent" title="Quem pode definir versos definitivos">
          {creatorMember && (
            <span className="dot" style={{ background: creatorMember.color, marginRight: 6 }} />
          )}
          Criador: {creator?.name ?? '—'}
          {song.createdBy === profile.id ? ' (você)' : ''}
        </span>
      </div>

      <div className="presence">
        {presence.map((s) => {
          const p = state.profiles.find((x) => x.id === s.userId)
          return (
            <span key={s.userId} className="presence-chip">
              <span className="dot" style={{ background: s.color }} />
              {p?.name}
              {s.userId === profile.id ? ' (você)' : ''}
              {s.userId === song.createdBy ? ' · criador' : ''}
            </span>
          )
        })}
        {presence.length > 0 && <span className="badge accent">ao vivo</span>}
      </div>

      <div className="tabs">
        {stanzas.map((st, i) => (
          <button
            key={st.id}
            type="button"
            className={`tab ${i === stanzaIndex ? 'active' : ''}`}
            onClick={() => setStanzaIndex(i)}
          >
            {stanzaLabel(st)}
          </button>
        ))}
        <button
          type="button"
          className="tab"
          onClick={() => void addStanza(songId, 0)}
          aria-label="Nova estrofe"
        >
          +
        </button>
      </div>

      <div className="editor-toolbar">
        <p className="muted">Toque num verso para ver sugestões</p>
        <div className="row">
          <label className="row muted text-sm">
            <input
              type="checkbox"
              checked={showRhymes}
              onChange={(e) => setShowRhymes(e.target.checked)}
            />
            Rimas
          </label>
          {stanza && stanzas.length > 1 && (
            <button
              type="button"
              className="btn danger compact"
              onClick={() => {
                void (async () => {
                  if (
                    !confirm(
                      `Remover ${stanzaLabel(stanza)}? Versos, votos e áudios dela serão apagados.`,
                    )
                  ) {
                    return
                  }
                  try {
                    const removingIndex = stanzaIndex
                    await deleteStanza(stanza.id)
                    setActiveSlotId(null)
                    setComposeOpen(false)
                    setStanzaIndex(Math.max(0, Math.min(removingIndex, stanzas.length - 2)))
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Não foi possível remover')
                  }
                })()
              }}
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <div className="lyrics-sheet">
        {(() => {
          const visibleSlots = slots.filter((slot) => {
            if (slot.acceptedProposalId) return true
            return state.proposals.some((p) => p.slotId === slot.id)
          })

          if (visibleSlots.length === 0) {
            return (
              <p className="muted lyrics-sheet-empty">
                Ainda sem versos nesta estrofe. Escreva na tela da música ou proponha abaixo.
              </p>
            )
          }

          const acceptedTexts = visibleSlots
            .map((s) => state.proposals.find((p) => p.id === s.acceptedProposalId)?.text ?? '')
            .filter(Boolean)
          const scheme = computeRhymeScheme(acceptedTexts)

          return visibleSlots.map((slot, idx) => {
            const accepted = state.proposals.find((p) => p.id === slot.acceptedProposalId)
            const poolSize = state.proposals.filter((p) => p.slotId === slot.id).length
            const acceptedBefore = visibleSlots
              .slice(0, idx + 1)
              .filter((s) => s.acceptedProposalId).length
            const rhymeMark =
              accepted && showRhymes && acceptedBefore > 0 ? scheme[acceptedBefore - 1] : null
            const selected = activeSlotId === slot.id

            return (
              <button
                key={slot.id}
                type="button"
                className={`lyric-line ${selected ? 'selected' : ''} ${accepted ? '' : 'pending'}`}
                onClick={() => {
                  setActiveSlotId(slot.id)
                  setComposeOpen(false)
                }}
              >
                <span className="lyric-index" aria-hidden="true">
                  {idx + 1}
                </span>
                <span className="lyric-body">
                  {accepted ? (
                    <ColoredVerse segments={accepted.segments} mode="definitive" />
                  ) : (
                    <span className="lyric-pending">
                      verso em discussão
                      {poolSize > 0 ? ` · ${poolSize}` : ''}
                    </span>
                  )}
                  {rhymeMark && (
                    <span
                      className="lyric-rhyme"
                      style={{ color: rhymeMark.color }}
                      title={`Rima ${rhymeMark.label} (-${rhymeMark.ending})`}
                    >
                      {rhymeMark.label}
                    </span>
                  )}
                </span>
              </button>
            )
          })
        })()}
      </div>

      {stanza && (
        <button type="button" className="btn secondary block" onClick={openNewVerseCompose}>
          Incluir novo verso
        </button>
      )}

      {stanza && (
        <Link
          to={`/groups/${groupId}/songs/${songId}/stanzas/${stanza.id}/record`}
          className={`btn block ${complete ? '' : 'secondary'}`}
          style={{ pointerEvents: complete ? 'auto' : 'none', opacity: complete ? 1 : 0.45 }}
          aria-disabled={!complete}
        >
          {complete ? 'Gravar estrofe' : 'Gravar estrofe (bloqueado)'}
        </Link>
      )}

      <Sheet
        open={Boolean(activeSlotId) && !composeOpen}
        title={`Verso ${(slots.find((s) => s.id === activeSlotId)?.index ?? 0) + 1} · pool`}
        onClose={() => setActiveSlotId(null)}
      >
        {showSwipeHint && pool.length > 0 && (
          <p className="pool-swipe-hint muted">← Não · ↑ Seguir · Aceitar →</p>
        )}
        <div className="list proposal-thread">
          {pool.length === 0 && <div className="empty">Nenhuma proposta ainda.</div>}
          {pool.map(({ item, depth }) => {
            const proposal = item.proposal
            const author = state.profiles.find((p) => p.id === proposal.authorId)
            const counts = voteCounts(proposal.id)
            const myVote = state.votes.find(
              (v) => v.proposalId === proposal.id && v.userId === profile.id,
            )
            const parentAuthor = proposal.parentProposalId
              ? state.profiles.find(
                  (p) =>
                    p.id ===
                    state.proposals.find((x) => x.id === proposal.parentProposalId)?.authorId,
                )
              : null
            const isDefinitive =
              proposal.id === slots.find((s) => s.id === activeSlotId)?.acceptedProposalId

            return (
              <div
                key={proposal.id}
                className={`proposal-thread-node ${depth > 0 ? 'reply' : ''}`}
                style={depth > 0 ? { ['--thread-depth' as string]: depth } : undefined}
              >
                {depth > 0 && (
                  <p className="verse-thread-reply-label">
                    resposta a {parentAuthor?.name ?? 'proposta anterior'}
                  </p>
                )}
                <ProposalCard
                  authorName={author?.name ?? '—'}
                  parentAuthorName={parentAuthor?.name}
                  segments={proposal.segments}
                  authorColor={proposal.segments[0]?.color ?? sessionColor}
                  isDefinitive={Boolean(isDefinitive)}
                  myVote={myVote?.kind}
                  counts={counts}
                  canMakeDefinitive={profile.id === song.createdBy}
                  onVote={(kind) => {
                    setShowSwipeHint(false)
                    void castVote({ proposalId: proposal.id, userId: profile.id, kind })
                  }}
                  onUseAsBase={() => openCompose(activeSlotId!, proposal)}
                  onMakeDefinitive={() => void acceptProposal(proposal.id, profile.id)}
                />
              </div>
            )
          })}
        </div>
        <button
          type="button"
          className="btn block"
          onClick={() => activeSlotId && openCompose(activeSlotId)}
        >
          Propor novo verso
        </button>
      </Sheet>

      <Sheet
        open={composeOpen}
        title={addingNewVerse ? 'Incluir novo verso' : parent ? 'Ajustar verso' : 'Propor verso'}
        onClose={() => {
          setComposeOpen(false)
          setAddingNewVerse(false)
        }}
      >
        <form className="stack" onSubmit={onPublish}>
          {composeError && <div className="error">{composeError}</div>}
          {parent && (
            <div>
              <p className="muted">Base</p>
              <ColoredVerse segments={parent.segments} />
            </div>
          )}
          <div className="field">
            <label htmlFor="draft">Seu verso</label>
            <textarea
              id="draft"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setComposeError('')
              }}
              required
              placeholder="Escreva o verso…"
            />
            {sameAsBase && (
              <p className="muted text-xs" style={{ color: 'var(--danger-text)' }}>
                Altere o texto — não pode ser igual à base.
              </p>
            )}
          </div>
          <div>
            <p className="muted">Preview</p>
            <ColoredVerse segments={previewSegments} />
          </div>
          <button type="submit" className="btn block" disabled={sameAsBase || !draft.trim()}>
            Publicar
          </button>
        </form>
      </Sheet>
    </Page>
  )
}
