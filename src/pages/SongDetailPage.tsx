import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ColoredVerse } from '@/components/ColoredVerse'
import { Page } from '@/components/Page'
import { ProposalCard, swipeHintVisible } from '@/components/ProposalCard'
import { Sheet } from '@/components/Sheet'
import { buildColoredSegments } from '@/lib/diff'
import {
  acceptProposal,
  appendVerse,
  canAccessSong,
  castVote,
  currentProfile,
  deleteSong,
  isGroupAdmin,
  joinSongSession,
  mergeSongRemote,
  proposeVerse,
  startNextStanza,
  updateSong,
  updateStanzaTitle,
  usingFirebase,
  voteCounts,
} from '@/data/store'
import { watchSongData } from '@/data/firebaseRepo'
import { useBrainStore } from '@/data/useBrainStore'
import { stanzaLabel } from '@/lib/stanza'
import { orderProposalThread } from '@/lib/proposalThread'
import type { SongVisibility, VerseProposal } from '@/types/domain'

export function SongDetailPage() {
  const { groupId = '', songId = '' } = useParams()
  const state = useBrainStore()
  const profile = currentProfile()!
  const navigate = useNavigate()
  const song = state.songs.find((s) => s.id === songId)
  const [showEdit, setShowEdit] = useState(false)
  const [selectedStanzaId, setSelectedStanzaId] = useState<string | null>(null)
  const [discussionStanzaId, setDiscussionStanzaId] = useState<string | null>(null)
  const [forkBase, setForkBase] = useState<VerseProposal | null>(null)
  const [forkDraft, setForkDraft] = useState('')
  const [forkError, setForkError] = useState('')
  const [renamingStanzaId, setRenamingStanzaId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const skipRenameBlur = useRef(false)
  const [showSwipeHint, setShowSwipeHint] = useState(() => swipeHintVisible())
  const [title, setTitle] = useState(song?.title ?? '')
  const [visibility, setVisibility] = useState<SongVisibility>(
    song?.visibility ?? 'public_in_group',
  )
  const [draft, setDraft] = useState('')
  const [sessionColor, setSessionColor] = useState('#E8A838')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [composeStanzaId, setComposeStanzaId] = useState<string | null>(null)
  const draftInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!song || !canAccessSong(songId, profile.id)) return
    let cancelled = false
    void joinSongSession(songId, profile.id).then((color) => {
      if (!cancelled) setSessionColor(color)
    })
    return () => {
      cancelled = true
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

  const composed = useMemo(() => {
    type ComposedLine = {
      slot: (typeof state.slots)[number]
      proposal: (typeof state.proposals)[number]
      status: 'definitive' | 'pending'
    }
    return stanzas
      .map((st) => {
        const slots = state.slots
          .filter((sl) => sl.stanzaId === st.id)
          .sort((a, b) => a.index - b.index)
        const lines = slots.flatMap((slot): ComposedLine[] => {
          const accepted = state.proposals.find((p) => p.id === slot.acceptedProposalId)
          if (accepted) {
            return [{ slot, proposal: accepted, status: 'definitive' }]
          }
          const drafts = state.proposals
            .filter((p) => p.slotId === slot.id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          return drafts.map((proposal) => ({
            slot,
            proposal,
            status: 'pending' as const,
          }))
        })
        return { stanza: st, lines }
      })
      .filter((block) => block.lines.length > 0)
  }, [stanzas, state.slots, state.proposals])

  const openStanza = stanzas[stanzas.length - 1]

  useEffect(() => {
    if (stanzas.length === 0) {
      setComposeStanzaId(null)
      return
    }
    setComposeStanzaId((current) => {
      if (current && stanzas.some((s) => s.id === current)) return current
      return stanzas[stanzas.length - 1].id
    })
  }, [stanzas])

  const composeStanza =
    stanzas.find((s) => s.id === composeStanzaId) ?? openStanza ?? null
  const composeSlots = composeStanza
    ? state.slots
        .filter((sl) => sl.stanzaId === composeStanza.id)
        .sort((a, b) => a.index - b.index)
    : []
  const composeLastSlot = composeSlots[composeSlots.length - 1]
  const composeOpenSlot =
    composeLastSlot && !composeLastSlot.acceptedProposalId ? composeLastSlot : undefined
  const pendingOnCompose = composeOpenSlot
    ? state.proposals.filter((p) => p.slotId === composeOpenSlot.id).length
    : 0

  const openSlots = openStanza
    ? state.slots
        .filter((sl) => sl.stanzaId === openStanza.id)
        .sort((a, b) => a.index - b.index)
    : []
  const openLineCount = openSlots.filter((sl) => Boolean(sl.acceptedProposalId)).length
  const canStartNext = openLineCount > 0
  const isCreator = song?.createdBy === profile.id
  const admin = song ? isGroupAdmin(song.groupId, profile.id) : false
  const canRenameStanza = Boolean(song && (admin || song.createdBy === profile.id))

  if (!song || !canAccessSong(songId, profile.id)) {
    return (
      <Page title="Música" backTo={`/groups/${groupId}`}>
        <div className="empty">Música não encontrada ou privada</div>
      </Page>
    )
  }

  const online = state.sessions.filter(
    (s) => s.songId === songId && Date.now() - new Date(s.lastSeenAt).getTime() < 5 * 60_000,
  )

  async function onSave(e: FormEvent) {
    e.preventDefault()
    await updateSong(songId, { title, visibility })
    setShowEdit(false)
  }

  function startRename(stanzaId: string, currentTitle: string | undefined) {
    setRenamingStanzaId(stanzaId)
    setRenameDraft(currentTitle?.trim() ?? '')
  }

  async function commitRename() {
    if (!renamingStanzaId) return
    const id = renamingStanzaId
    const value = renameDraft
    setRenamingStanzaId(null)
    try {
      await updateStanzaTitle(id, value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível renomear')
    }
  }

  function onRenameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitRename()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      skipRenameBlur.current = true
      setRenamingStanzaId(null)
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await appendVerse({
        songId,
        authorId: profile.id,
        text: draft,
        sessionColor,
        stanzaId: composeStanzaId ?? undefined,
      })
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar')
    } finally {
      setBusy(false)
    }
  }

  async function onNewStanza() {
    setError('')
    setBusy(true)
    try {
      const created = await startNextStanza(songId)
      setComposeStanzaId(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar estrofe')
    } finally {
      setBusy(false)
    }
  }

  function writeOnStanza(stanzaId: string) {
    setComposeStanzaId(stanzaId)
    setSelectedStanzaId(null)
    requestAnimationFrame(() => {
      draftInputRef.current?.focus()
      draftInputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  function openForkCompose(proposal: VerseProposal) {
    setForkBase(proposal)
    setForkDraft(proposal.text)
    setForkError('')
  }

  function closeForkCompose() {
    setForkBase(null)
    setForkDraft('')
    setForkError('')
  }

  async function onPublishFork(e: FormEvent) {
    e.preventDefault()
    if (!forkBase) return
    setForkError('')
    try {
      await proposeVerse({
        slotId: forkBase.slotId,
        authorId: profile.id,
        text: forkDraft,
        parentProposalId: forkBase.id,
        sessionColor,
      })
      closeForkCompose()
    } catch (err) {
      setForkError(err instanceof Error ? err.message : 'Não foi possível publicar')
    }
  }

  const forkSameAsBase =
    Boolean(forkBase) &&
    forkDraft.trim().replace(/\s+/g, ' ').toLowerCase() ===
      forkBase!.text.trim().replace(/\s+/g, ' ').toLowerCase()
  const forkPreview = buildColoredSegments(
    forkDraft || ' ',
    profile.id,
    sessionColor,
    forkBase?.segments,
  )

  return (
    <Page
      kicker="música"
      title={song.title}
      backTo={`/groups/${groupId}`}
      action={
        admin || song.createdBy === profile.id ? (
          <button
            type="button"
            className="btn icon"
            onClick={() => setShowEdit(true)}
            aria-label="Editar música"
          >
            ···
          </button>
        ) : undefined
      }
      footer={
        <form className="composer docked stack" onSubmit={onSend}>
          {error && <div className="error">{error}</div>}
          <div className="row spread">
            <div className="composer-target">
              <span className="muted">Escrevendo em</span>
              {stanzas.length > 0 ? (
                <select
                  className="composer-stanza-select"
                  value={composeStanzaId ?? ''}
                  onChange={(e) => setComposeStanzaId(e.target.value)}
                  aria-label="Estrofe para escrever"
                  disabled={busy}
                >
                  {stanzas.map((st) => (
                    <option key={st.id} value={st.id}>
                      {stanzaLabel(st)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="muted">Primeira estrofe</span>
              )}
            </div>
            <button
              type="button"
              className="btn ghost compact"
              disabled={busy || !canStartNext}
              onClick={() => void onNewStanza()}
            >
              Nova estrofe
            </button>
          </div>
          {pendingOnCompose > 0 && (
            <p className="muted text-xs">
              {isCreator
                ? `${pendingOnCompose} opção${pendingOnCompose === 1 ? '' : 'ões'} — toque em Em discussão`
                : 'Aguardando o criador escolher a definitiva'}
            </p>
          )}
          <div className="composer-row">
            <input
              ref={draftInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Digite um verso…"
              aria-label="Novo verso"
              disabled={busy}
            />
            <button type="submit" className="btn" disabled={busy || !draft.trim()}>
              Enviar
            </button>
          </div>
        </form>
      }
    >
      <div className="row wrap">
        <span className="badge">
          {song.visibility === 'private' ? 'privada' : 'pública no grupo'}
        </span>
        {song.key && <span className="badge">Tom {song.key}</span>}
        {song.bpm && <span className="badge">{song.bpm} BPM</span>}
        {online.map((s) => {
          const p = state.profiles.find((x) => x.id === s.userId)
          return (
            <span key={s.userId} className="badge">
              <span className="dot" style={{ background: s.color, marginRight: 6 }} />
              {p?.name}
            </span>
          )
        })}
      </div>

      <div className="list">
        {composed.length === 0 && (
          <div className="empty">Comece a escrever o primeiro verso.</div>
        )}
        {composed.map(({ stanza, lines }) => {
          const selected = selectedStanzaId === stanza.id
          const definitive = lines.filter((l) => l.status === 'definitive')
          const pending = lines.filter((l) => l.status === 'pending')
          return (
            <div
              key={stanza.id}
              className={`list-item song-card ${selected ? 'expanded' : ''}`}
            >
              <div className="song-card-toggle">
                <div className="row spread">
                  {renamingStanzaId === stanza.id ? (
                    <input
                      className="stanza-title-input"
                      value={renameDraft}
                      placeholder={stanzaLabel({ index: stanza.index })}
                      autoFocus
                      aria-label="Nome da estrofe"
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => {
                        if (skipRenameBlur.current) {
                          skipRenameBlur.current = false
                          return
                        }
                        void commitRename()
                      }}
                      onKeyDown={onRenameKeyDown}
                    />
                  ) : canRenameStanza ? (
                    <button
                      type="button"
                      className="title stanza-title-btn"
                      title="Renomear estrofe"
                      onClick={() => startRename(stanza.id, stanza.title)}
                    >
                      {stanzaLabel(stanza)}
                    </button>
                  ) : (
                    <div className="title">{stanzaLabel(stanza)}</div>
                  )}
                  <button
                    type="button"
                    className="song-chevron-btn"
                    aria-expanded={selected}
                    aria-label={selected ? 'Recolher estrofe' : 'Expandir estrofe'}
                    onClick={() => setSelectedStanzaId(selected ? null : stanza.id)}
                  >
                    <span className="song-chevron" aria-hidden="true">
                      {selected ? '▴' : '▾'}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  className="song-card-preview-btn"
                  aria-expanded={selected}
                  onClick={() => setSelectedStanzaId(selected ? null : stanza.id)}
                >
                  <p className="muted">
                    {definitive.length} definitivo{definitive.length === 1 ? '' : 's'}
                    {pending.length > 0 ? ` · ${pending.length} em discussão` : ''}
                  </p>
                  {definitive.length > 0 && (
                    <div className="song-stanza-preview">
                      <div className="song-letter">
                        {definitive.map(({ proposal }) => (
                          <ColoredVerse
                            key={proposal.id}
                            segments={proposal.segments}
                            mode="definitive"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              </div>

              {pending.length > 0 && (
                <button
                  type="button"
                  className="nested-sheet"
                  aria-label="Abrir discussão e escolher definitiva"
                  onClick={() => setDiscussionStanzaId(stanza.id)}
                >
                  <div className="nested-sheet-panel">
                    <p className="nested-sheet-title">Em discussão</p>
                    <div className="verse-thread">
                      {orderProposalThread(pending).map(({ item, depth }) => {
                        const { proposal } = item
                        const author = state.profiles.find((p) => p.id === proposal.authorId)
                        const color = proposal.segments[0]?.color ?? 'var(--accent)'
                        const parent = proposal.parentProposalId
                          ? state.proposals.find((p) => p.id === proposal.parentProposalId)
                          : undefined
                        const parentAuthor = parent
                          ? state.profiles.find((p) => p.id === parent.authorId)
                          : undefined
                        return (
                          <div
                            key={proposal.id}
                            className={`verse-thread-item ${depth > 0 ? 'reply' : ''}`}
                            style={depth > 0 ? { ['--thread-depth' as string]: depth } : undefined}
                          >
                            <span
                              className="verse-thread-rail"
                              style={{ background: color }}
                              aria-hidden="true"
                            />
                            <div className="verse-thread-body">
                              <div className="verse-thread-meta">
                                <span className="dot" style={{ background: color }} />
                                <span className="verse-thread-name">
                                  {author?.name ?? '—'}
                                  {proposal.authorId === profile.id ? ' (você)' : ''}
                                </span>
                              </div>
                              {depth > 0 && parentAuthor && (
                                <p className="verse-thread-reply-label">
                                  resposta a {parentAuthor.name}
                                </p>
                              )}
                              <ColoredVerse segments={proposal.segments} mode="author" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </button>
              )}

              {selected && (
                <div className="song-card-body">
                  <button
                    type="button"
                    className="btn block"
                    onClick={() => writeOnStanza(stanza.id)}
                  >
                    Incluir verso nesta estrofe
                  </button>
                  <Link
                    to={`/groups/${groupId}/songs/${songId}/edit?stanza=${stanza.index}`}
                    className="btn secondary block"
                  >
                    Editar versos existentes
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Sheet
        open={Boolean(discussionStanzaId) && !forkBase}
        title={
          discussionStanzaId
            ? `${stanzaLabel(
                stanzas.find((s) => s.id === discussionStanzaId) ?? {
                  index: 0,
                  title: undefined,
                },
              )} · escolher definitiva`
            : 'Escolher definitiva'
        }
        onClose={() => setDiscussionStanzaId(null)}
      >
        {(() => {
          const block = composed.find((c) => c.stanza.id === discussionStanzaId)
          const pending = block?.lines.filter((l) => l.status === 'pending') ?? []
          const threaded = orderProposalThread(pending, (a, b) => {
            const va = voteCounts(a.proposal.id)
            const vb = voteCounts(b.proposal.id)
            return vb.accept + vb.continue - (va.accept + va.continue)
          })
          if (threaded.length === 0) {
            return <div className="empty">Nenhuma sugestão em discussão.</div>
          }
          return (
            <>
              {showSwipeHint && (
                <p className="pool-swipe-hint muted">← Não · ↑ Seguir · Aceitar →</p>
              )}
              {!isCreator && (
                <p className="muted">Só o criador pode tornar um verso definitivo.</p>
              )}
              <div className="list proposal-thread">
                {threaded.map(({ item, depth }) => {
                  const { proposal } = item
                  const author = state.profiles.find((p) => p.id === proposal.authorId)
                  const counts = voteCounts(proposal.id)
                  const myVote = state.votes.find(
                    (v) => v.proposalId === proposal.id && v.userId === profile.id,
                  )
                  const parentAuthor = proposal.parentProposalId
                    ? state.profiles.find(
                        (p) =>
                          p.id ===
                          state.proposals.find((x) => x.id === proposal.parentProposalId)
                            ?.authorId,
                      )
                    : null
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
                        isDefinitive={false}
                        myVote={myVote?.kind}
                        counts={counts}
                        canMakeDefinitive={isCreator}
                        onVote={(kind) => {
                          setShowSwipeHint(false)
                          void castVote({ proposalId: proposal.id, userId: profile.id, kind })
                        }}
                        onUseAsBase={() => openForkCompose(proposal)}
                        onMakeDefinitive={() => {
                          void acceptProposal(proposal.id, profile.id).then(() => {
                            setDiscussionStanzaId(null)
                          })
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )
        })()}
      </Sheet>

      <Sheet open={Boolean(forkBase)} title="Ajustar verso" onClose={closeForkCompose}>
        <form className="stack" onSubmit={onPublishFork}>
          {forkError && <div className="error">{forkError}</div>}
          {forkBase && (
            <div>
              <p className="muted">Base</p>
              <ColoredVerse segments={forkBase.segments} />
            </div>
          )}
          <div className="field">
            <label htmlFor="fork-draft">Seu verso</label>
            <textarea
              id="fork-draft"
              value={forkDraft}
              onChange={(e) => {
                setForkDraft(e.target.value)
                setForkError('')
              }}
              required
              placeholder="Escreva o verso…"
            />
            {forkSameAsBase && (
              <p className="muted text-xs" style={{ color: 'var(--danger-text)' }}>
                Altere o texto — não pode ser igual à base.
              </p>
            )}
          </div>
          <div>
            <p className="muted">Preview</p>
            <ColoredVerse segments={forkPreview} />
          </div>
          <button
            type="submit"
            className="btn block"
            disabled={forkSameAsBase || !forkDraft.trim()}
          >
            Publicar
          </button>
        </form>
      </Sheet>

      <Sheet open={showEdit} title="Editar música" onClose={() => setShowEdit(false)}>
        <form className="stack" onSubmit={onSave}>
          <div className="field">
            <label htmlFor="title">Título</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="vis">Visibilidade</label>
            <select
              id="vis"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as SongVisibility)}
            >
              <option value="public_in_group">Pública no grupo</option>
              <option value="private">Privada</option>
            </select>
          </div>
          <button type="submit" className="btn block">
            Salvar
          </button>
          <button
            type="button"
            className="btn danger block"
            onClick={() => {
              if (confirm('Excluir música?')) {
                void deleteSong(songId).then(() => navigate(`/groups/${groupId}`))
              }
            }}
          >
            Excluir música
          </button>
        </form>
      </Sheet>
    </Page>
  )
}
