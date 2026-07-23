import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ColoredVerse } from '@/components/ColoredVerse'
import { Page } from '@/components/Page'
import { Sheet } from '@/components/Sheet'
import {
  createSong,
  currentProfile,
  deleteGroup,
  hydrateFirebaseUser,
  isGroupAdmin,
  isGroupCreator,
  leaveGroup,
  removeMember,
  setMemberColor,
  setMemberRole,
  songsForGroup,
  updateGroup,
  usingFirebase,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'
import { buildInviteUrl } from '@/lib/inviteUrl'
import { stanzaLabel } from '@/lib/stanza'
import { SESSION_COLORS, type GroupRole, type Song, type SongVisibility } from '@/types/domain'

type SongSort = 'updated_desc' | 'created_desc' | 'title_asc' | 'title_desc'
type SongVisibilityFilter = 'all' | 'public_in_group' | 'private'

function roleLabel(role: GroupRole): string {
  return role === 'admin' ? 'Administrador' : 'Músico'
}

export function GroupDetailPage() {
  const { groupId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useBrainStore()
  const profile = currentProfile()!
  const navigate = useNavigate()
  const group = state.groups.find((g) => g.id === groupId)
  const admin = isGroupAdmin(groupId, profile.id)
  const creator = isGroupCreator(groupId, profile.id)
  const initialTab = searchParams.get('tab') === 'members' ? 'members' : 'songs'
  const [tab, setTab] = useState<'songs' | 'members'>(initialTab)
  const [showSong, setShowSong] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<SongVisibility>('public_in_group')
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [songError, setSongError] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [creatingSong, setCreatingSong] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [songQuery, setSongQuery] = useState('')
  const [songSort, setSongSort] = useState<SongSort>('updated_desc')
  const [songVisibility, setSongVisibility] = useState<SongVisibilityFilter>('all')
  const [colorEditorId, setColorEditorId] = useState<string | null>(null)

  const songs = useMemo(
    () => (group ? songsForGroup(group.id, profile.id) : []),
    [group, profile.id, state.songs, state.participants, state.members],
  )

  const visibleSongs = useMemo(() => {
    const q = songQuery.trim().toLowerCase()
    let filtered = songs
    if (songVisibility !== 'all') {
      filtered = filtered.filter((s) => s.visibility === songVisibility)
    }
    if (q) {
      filtered = filtered.filter((s) => s.title.toLowerCase().includes(q))
    } else {
      filtered = [...filtered]
    }

    filtered.sort((a, b) => {
      switch (songSort) {
        case 'title_asc':
          return a.title.localeCompare(b.title, 'pt', { sensitivity: 'base' })
        case 'title_desc':
          return b.title.localeCompare(a.title, 'pt', { sensitivity: 'base' })
        case 'created_desc':
          return b.createdAt.localeCompare(a.createdAt)
        case 'updated_desc':
        default:
          return b.updatedAt.localeCompare(a.updatedAt)
      }
    })
    return filtered
  }, [songs, songQuery, songSort, songVisibility])

  const members = state.members.filter((m) => m.groupId === groupId)
  const usedColors = members.map((m) => m.color.toLowerCase())

  useEffect(() => {
    if (!group) return
    setName(group.name)
    setDescription(group.description)
  }, [group?.id, group?.name, group?.description])

  useEffect(() => {
    if (!usingFirebase) return
    void hydrateFirebaseUser(profile.id)
  }, [groupId, profile.id])

  useEffect(() => {
    if (searchParams.get('tab') === 'members') {
      setTab('members')
    }
  }, [searchParams])

  if (!group) {
    return (
      <Page title="Grupo" backTo="/groups">
        <div className="empty">Grupo não encontrado</div>
      </Page>
    )
  }

  function selectTab(next: 'songs' | 'members') {
    setTab(next)
    if (next === 'members') {
      setSearchParams({ tab: 'members' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
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
    setSettingsError('')
    try {
      await updateGroup(groupId, { name, description })
      setShowSettings(false)
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  async function onCopyInvite() {
    try {
      const url = buildInviteUrl(group!.inviteCode)
      await navigator.clipboard.writeText(url)
      setInviteCopied(true)
      window.setTimeout(() => setInviteCopied(false), 2000)
    } catch {
      setSettingsError('Não foi possível copiar o convite')
    }
  }

  async function onLeaveGroup() {
    if (!confirm('Sair deste grupo?')) return
    setSettingsError('')
    try {
      await leaveGroup(groupId, profile.id)
      navigate('/groups')
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Erro ao sair')
    }
  }

  async function onDeleteGroup() {
    if (!confirm('Excluir este grupo e todas as músicas? Esta ação não pode ser desfeita.')) return
    setSettingsError('')
    try {
      await deleteGroup(groupId, profile.id)
      navigate('/groups')
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
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
        <button
          type="button"
          className="btn secondary compact"
          data-tour="group-settings"
          onClick={() => {
            setSettingsError('')
            setShowSettings(true)
          }}
        >
          Configurar
        </button>
      }
    >
      <div className="stack gap-sm">
        <p className="muted">{group.description || 'Sem descrição'}</p>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'songs' ? 'active' : ''}`}
          onClick={() => selectTab('songs')}
        >
          Músicas
        </button>
        <button
          type="button"
          className={`tab ${tab === 'members' ? 'active' : ''}`}
          onClick={() => selectTab('members')}
        >
          Membros
        </button>
      </div>

      {tab === 'songs' && (
        <>
          {songs.length > 0 && (
            <div className="list-toolbar">
              <input
                id="song-filter"
                className="toolbar-search"
                type="search"
                value={songQuery}
                onChange={(e) => setSongQuery(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar músicas"
                autoComplete="off"
                enterKeyHint="search"
              />
              <select
                id="song-visibility"
                className="toolbar-tag"
                value={songVisibility}
                onChange={(e) => setSongVisibility(e.target.value as SongVisibilityFilter)}
                aria-label="Visibilidade"
              >
                <option value="all">Todas</option>
                <option value="public_in_group">Públicas</option>
                <option value="private">Privadas</option>
              </select>
              <select
                id="song-sort"
                className="toolbar-tag"
                value={songSort}
                onChange={(e) => setSongSort(e.target.value as SongSort)}
                aria-label="Ordenar"
              >
                <option value="updated_desc">Atualização</option>
                <option value="created_desc">Recentes</option>
                <option value="title_asc">A–Z</option>
                <option value="title_desc">Z–A</option>
              </select>
            </div>
          )}

          <div className="list">
            {songs.length === 0 && (
              <div className="activation-empty compact">
                <h2 className="section-title">Crie a primeira música</h2>
                <p className="muted">
                  Depois é só escrever o primeiro verso — sozinho ou com o grupo.
                </p>
                <button
                  type="button"
                  className="btn block"
                  onClick={() => setShowSong(true)}
                >
                  Criar primeira música
                </button>
              </div>
            )}
            {songs.length > 0 && admin && (
              <div className="invite-nudge row spread" data-tour="group-invite">
                <div>
                  <p className="muted" style={{ margin: 0 }}>
                    Convide alguém para compor junto
                  </p>
                  <strong className="invite-code">{group.inviteCode}</strong>
                </div>
                <button
                  type="button"
                  className="btn secondary compact"
                  onClick={() => void onCopyInvite()}
                >
                  {inviteCopied ? 'Link copiado' : 'Copiar link'}
                </button>
              </div>
            )}
            {songs.length > 0 && visibleSongs.length === 0 && (
              <div className="empty">Nenhuma música corresponde aos filtros.</div>
            )}
            {visibleSongs.map((s) => {
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
                      {complete}/{stanzas.length} estrofes ok · toque para{' '}
                      {expanded ? 'recolher' : 'ver a letra'}
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

                      <Link to={`/groups/${groupId}/songs/${s.id}`} className="btn block">
                        Ver música completa
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'members' && (
        <div className="list">
          {members.map((m) => {
            const p = state.profiles.find((x) => x.id === m.userId)
            const isCreatorMember = m.userId === group.createdBy
            const canEditColor = admin || m.userId === profile.id
            const canManage = admin && !isCreatorMember && m.userId !== profile.id

            return (
              <div key={m.id} className="list-item stack">
                <div className="row spread">
                  <div className="row">
                    <span className="dot" style={{ background: m.color }} />
                    <div>
                      <div className="title">{p?.name ?? '—'}</div>
                      {p?.email && <p className="muted">{p.email}</p>}
                    </div>
                  </div>
                  <div className="row gap-sm" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isCreatorMember && <span className="badge accent">Criador</span>}
                    <span className="badge">{roleLabel(m.role)}</span>
                  </div>
                </div>

                {canEditColor && (
                  <div className="member-color">
                    <button
                      type="button"
                      className="btn secondary compact"
                      aria-expanded={colorEditorId === m.id}
                      onClick={() =>
                        setColorEditorId((id) => (id === m.id ? null : m.id))
                      }
                    >
                      {colorEditorId === m.id ? 'Fechar cores' : 'Alterar cor'}
                    </button>
                    {colorEditorId === m.id && (
                      <div className="member-color-swatches" role="group" aria-label="Cor no grupo">
                        {SESSION_COLORS.map((c) => {
                          const taken =
                            usedColors.includes(c.toLowerCase()) &&
                            m.color.toLowerCase() !== c.toLowerCase()
                          const selected = m.color.toLowerCase() === c.toLowerCase()
                          return (
                            <button
                              key={c}
                              type="button"
                              className={`color-swatch ${selected ? 'selected' : ''}`}
                              disabled={taken}
                              style={{ background: c, opacity: taken ? 0.25 : 1 }}
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await setMemberColor(m.id, c)
                                    setColorEditorId(null)
                                  } catch (err) {
                                    alert(err instanceof Error ? err.message : 'Cor indisponível')
                                  }
                                })()
                              }}
                              aria-label={`Cor ${c}`}
                              aria-pressed={selected}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {canManage && (
                  <div className="row wrap">
                    <div className="field grow" style={{ marginBottom: 0 }}>
                      <label htmlFor={`role-${m.id}`}>Papel</label>
                      <select
                        id={`role-${m.id}`}
                        value={m.role}
                        onChange={(e) =>
                          void setMemberRole(m.id, e.target.value as GroupRole).catch((err) =>
                            alert(err instanceof Error ? err.message : 'Erro'),
                          )
                        }
                      >
                        <option value="admin">Administrador</option>
                        <option value="musician">Músico</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn danger compact"
                      onClick={() => {
                        if (!confirm(`Remover ${p?.name ?? 'este membro'} do grupo?`)) return
                        void removeMember(m.id).catch((err) =>
                          alert(err instanceof Error ? err.message : 'Erro ao remover'),
                        )
                      }}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'songs' && (
        <button
          type="button"
          className="fab"
          data-tour="group-create-song"
          onClick={() => setShowSong(true)}
          aria-label="Nova música"
        >
          +
        </button>
      )}

      <Sheet open={showSong} title="Nova música" onClose={() => setShowSong(false)}>
        <form className="stack" onSubmit={onCreateSong}>
          {songError && <div className="error">{songError}</div>}
          <div className="field">
            <label htmlFor="title">Título</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="next"
              placeholder="Título da música"
              required
            />
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

      <Sheet open={showSettings} title="Configurar grupo" onClose={() => setShowSettings(false)}>
        <div className="stack">
          {settingsError && <div className="error">{settingsError}</div>}

          {admin ? (
            <form className="stack" onSubmit={onSaveGroup}>
              <div className="field">
                <label htmlFor="name">Nome</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  placeholder="Nome do grupo"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="desc">Descrição</label>
                <textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoCapitalize="sentences"
                  spellCheck
                  enterKeyHint="done"
                  placeholder="Sobre o grupo (opcional)"
                />
              </div>
              <button type="submit" className="btn block">
                Salvar
              </button>
            </form>
          ) : (
            <div className="stack gap-sm">
              <p className="muted">Só administradores podem editar o nome e a descrição.</p>
            </div>
          )}

          <div className="field">
            <label>Convite</label>
            <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
              Compartilhe o link ou o código <strong className="invite-code">{group.inviteCode}</strong>
            </p>
            <button type="button" className="btn secondary block" onClick={() => void onCopyInvite()}>
              {inviteCopied ? 'Link copiado' : 'Copiar link de convite'}
            </button>
          </div>

          {!creator && (
            <button type="button" className="btn secondary block" onClick={() => void onLeaveGroup()}>
              Sair do grupo
            </button>
          )}

          {creator && (
            <button type="button" className="btn danger block" onClick={() => void onDeleteGroup()}>
              Excluir grupo
            </button>
          )}
        </div>
      </Sheet>
    </Page>
  )
}
