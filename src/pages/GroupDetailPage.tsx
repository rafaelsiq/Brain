import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ColoredVerse } from '@/components/ColoredVerse'
import { Page } from '@/components/Page'
import { Sheet } from '@/components/Sheet'
import {
  createSong,
  currentProfile,
  deleteGroup,
  isGroupAdmin,
  songsForGroup,
  updateGroup,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'
import { stanzaLabel } from '@/lib/stanza'
import type { Song, SongVisibility } from '@/types/domain'

export function GroupDetailPage() {
  const { groupId = '' } = useParams()
  const state = useBrainStore()
  const profile = currentProfile()!
  const navigate = useNavigate()
  const group = state.groups.find((g) => g.id === groupId)
  const admin = isGroupAdmin(groupId, profile.id)
  const [tab, setTab] = useState<'songs' | 'members'>('songs')
  const [showSong, setShowSong] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<SongVisibility>('public_in_group')
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [songError, setSongError] = useState('')
  const [creatingSong, setCreatingSong] = useState(false)

  const songs = useMemo(
    () => (group ? songsForGroup(group.id, profile.id) : []),
    [group, profile.id, state.songs, state.participants, state.members],
  )
  const members = state.members.filter((m) => m.groupId === groupId)

  if (!group) {
    return (
      <Page title="Grupo" backTo="/groups">
        <div className="empty">Grupo não encontrado</div>
      </Page>
    )
  }

  async function onCreateSong(e: FormEvent) {
    e.preventDefault()
    setSongError('')
    setCreatingSong(true)
    try {
      const song = await createSong({
        groupId,
        title,
        visibility,
        createdBy: profile.id,
        participantIds: visibility === 'private' ? [profile.id] : undefined,
      })
      setShowSong(false)
      setTitle('')
      navigate(`/groups/${groupId}/songs/${song.id}`)
    } catch (err) {
      console.error(err)
      const raw = err instanceof Error ? err.message : String(err)
      const msg = /permission|insufficient/i.test(raw)
        ? 'Sem permissão no Firestore. Faça deploy das regras: firebase deploy --only firestore:rules,storage'
        : raw || 'Não foi possível criar a música'
      setSongError(msg)
    } finally {
      setCreatingSong(false)
    }
  }

  async function onSaveGroup(e: FormEvent) {
    e.preventDefault()
    await updateGroup(groupId, { name, description })
    setShowEdit(false)
  }

  function songPreview(song: Song) {
    const stanzas = state.stanzas
      .filter((st) => st.songId === song.id)
      .sort((a, b) => a.index - b.index)

    return stanzas
      .map((st) => {
        const slots = state.slots
          .filter((sl) => sl.stanzaId === st.id)
          .sort((a, b) => a.index - b.index)
        const lines = slots.flatMap((slot) => {
          const accepted = state.proposals.find((p) => p.id === slot.acceptedProposalId)
          return accepted ? [{ proposal: accepted }] : []
        })
        return { stanza: st, lines }
      })
      .filter((block) => block.lines.length > 0)
  }

  return (
    <Page
      kicker="grupo"
      title={group.name}
      backTo="/groups"
      wide
      action={
        admin ? (
          <button
            type="button"
            className="btn icon"
            onClick={() => setShowEdit(true)}
            aria-label="Editar grupo"
          >
            ···
          </button>
        ) : undefined
      }
    >
      <div className="stack gap-sm">
        <p className="muted">{group.description || 'Sem descrição'}</p>
        <p className="muted">
          Convite:{' '}
          <strong className="invite-code">{group.inviteCode}</strong>
        </p>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'songs' ? 'active' : ''}`}
          onClick={() => setTab('songs')}
        >
          Músicas
        </button>
        <button
          type="button"
          className={`tab ${tab === 'members' ? 'active' : ''}`}
          onClick={() => setTab('members')}
        >
          Membros
        </button>
      </div>

      {tab === 'songs' && (
        <div className="list">
          {songs.length === 0 && <div className="empty">Nenhuma música neste grupo.</div>}
          {songs.map((s) => {
            const stanzas = state.stanzas.filter((st) => st.songId === s.id)
            const complete = stanzas.filter((st) => {
              const slots = state.slots.filter((sl) => sl.stanzaId === st.id)
              return slots.length > 0 && slots.every((sl) => sl.acceptedProposalId)
            }).length
            const expanded = expandedSongId === s.id
            const preview = expanded ? songPreview(s) : []

            return (
              <div
                key={s.id}
                className={`list-item song-card ${expanded ? 'expanded' : ''}`}
              >
                <button
                  type="button"
                  className="song-card-toggle"
                  aria-expanded={expanded}
                  onClick={() => setExpandedSongId(expanded ? null : s.id)}
                >
                  <div className="row spread">
                    <div className="title">{s.title}</div>
                    <div className="row">
                      <span className="badge">
                        {s.visibility === 'private' ? 'privada' : 'no grupo'}
                      </span>
                      <span className="song-chevron" aria-hidden="true">
                        {expanded ? '▴' : '▾'}
                      </span>
                    </div>
                  </div>
                  <p className="muted">
                    {complete}/{stanzas.length} estrofes ok · toque para {expanded ? 'recolher' : 'ver a letra'}
                  </p>
                </button>

                {expanded && (
                  <div className="song-card-body">
                    {preview.length === 0 ? (
                      <p className="muted">Nenhuma estrofe concluída ainda.</p>
                    ) : (
                      preview.map(({ stanza, lines }) => (
                        <div key={stanza.id} className="song-stanza-preview">
                          <p className="section-label">{stanzaLabel(stanza)}</p>
                          <div className="stack gap-sm">
                            {lines.map((line) => (
                              <ColoredVerse
                                key={line.proposal.id}
                                segments={line.proposal.segments}
                                mode="definitive"
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    )}

                    <Link
                      to={`/groups/${groupId}/songs/${s.id}`}
                      className="btn block"
                    >
                      Ver música completa
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'members' && (
        <div className="list">
          {members.map((m) => {
            const p = state.profiles.find((x) => x.id === m.userId)
            return (
              <div key={m.id} className="list-item">
                <div className="row spread">
                  <div className="row">
                    <span className="dot" style={{ background: m.color }} />
                    <div className="title">{p?.name ?? '—'}</div>
                  </div>
                  <span className="badge accent">{m.role}</span>
                </div>
              </div>
            )
          })}
          <Link to={`/groups/${groupId}/members`} className="btn secondary block">
            Gerenciar membros
          </Link>
        </div>
      )}

      {tab === 'songs' && (
        <button type="button" className="fab" onClick={() => setShowSong(true)} aria-label="Nova música">
          +
        </button>
      )}

      <Sheet open={showSong} title="Nova música" onClose={() => setShowSong(false)}>
        <form className="stack" onSubmit={onCreateSong}>
          {songError && <div className="error">{songError}</div>}
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
              <option value="private">Privada (só participantes)</option>
            </select>
          </div>
          <button type="submit" className="btn block" disabled={creatingSong}>
            {creatingSong ? 'Criando…' : 'Criar e editar'}
          </button>
        </form>
      </Sheet>

      <Sheet open={showEdit} title="Editar grupo" onClose={() => setShowEdit(false)}>
        <form className="stack" onSubmit={onSaveGroup}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="desc">Descrição</label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button type="submit" className="btn block">
            Salvar
          </button>
          <button
            type="button"
            className="btn danger block"
            onClick={() => {
              if (confirm('Excluir este grupo e todas as músicas?')) {
                void deleteGroup(groupId).then(() => navigate('/groups'))
              }
            }}
          >
            Excluir grupo
          </button>
        </form>
      </Sheet>
    </Page>
  )
}
