import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { InstallBanner } from '@/components/InstallBanner'
import { Page } from '@/components/Page'
import { Sheet } from '@/components/Sheet'
import {
  createGroup,
  currentProfile,
  groupsForUser,
  joinGroupByCode,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'

type GroupSort = 'updated_desc' | 'name_asc' | 'name_desc' | 'created_desc'

export function GroupsPage() {
  const state = useBrainStore()
  const profile = currentProfile()!
  const navigate = useNavigate()
  const groups = groupsForUser(profile.id)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<GroupSort>('updated_desc')

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? groups.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.description.toLowerCase().includes(q),
        )
      : [...groups]

    function lastActivity(groupId: string, fallback: string): string {
      let latest = fallback
      for (const s of state.songs) {
        if (s.groupId === groupId && s.updatedAt > latest) latest = s.updatedAt
      }
      return latest
    }

    filtered.sort((a, b) => {
      switch (sort) {
        case 'name_asc':
          return a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' })
        case 'name_desc':
          return b.name.localeCompare(a.name, 'pt', { sensitivity: 'base' })
        case 'created_desc':
          return b.createdAt.localeCompare(a.createdAt)
        case 'updated_desc':
        default:
          return lastActivity(b.id, b.updatedAt).localeCompare(lastActivity(a.id, a.updatedAt))
      }
    })
    return filtered
  }, [groups, query, sort, state.songs])

  function openCreate() {
    setError('')
    setName('')
    setDescription('')
    setShowCreate(true)
  }

  function openJoin() {
    setError('')
    setCode('')
    setShowJoin(true)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const g = await createGroup({ name, description, createdBy: profile.id })
      setShowCreate(false)
      setName('')
      setDescription('')
      navigate(`/groups/${g.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar grupo')
    } finally {
      setSubmitting(false)
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const g = await joinGroupByCode(code, profile.id)
      setShowJoin(false)
      setCode('')
      navigate(`/groups/${g.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page title="Collabrain" brandTitle showNav wide>
      <InstallBanner />

      <div>
        <p className="section-label">Biblioteca</p>
        <div className="row spread">
          <h2 className="section-title">Meus grupos</h2>
          <button
            type="button"
            className="btn secondary compact"
            data-tour="groups-join"
            onClick={openJoin}
          >
            Entrar com código
          </button>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          Entre com um convite ou crie um grupo para começar a compor.
        </p>
      </div>

      {groups.length > 0 && (
        <div className="list-toolbar">
          <input
            id="group-filter"
            className="toolbar-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar grupos"
            autoComplete="off"
            enterKeyHint="search"
          />
          <select
            id="group-sort"
            className="toolbar-tag"
            value={sort}
            onChange={(e) => setSort(e.target.value as GroupSort)}
            aria-label="Ordenar"
          >
            <option value="updated_desc">Atualização</option>
            <option value="created_desc">Recentes</option>
            <option value="name_asc">A–Z</option>
            <option value="name_desc">Z–A</option>
          </select>
        </div>
      )}

      <div className="list">
        {groups.length === 0 && (
          <div className="empty">Nenhum grupo ainda. Toque em + para criar o primeiro.</div>
        )}
        {groups.length > 0 && visibleGroups.length === 0 && (
          <div className="empty">Nenhum grupo corresponde à busca.</div>
        )}
        {visibleGroups.map((g) => {
          const memberCount = state.members.filter((m) => m.groupId === g.id).length
          const songCount = state.songs.filter((s) => s.groupId === g.id).length
          return (
            <Link key={g.id} to={`/groups/${g.id}`} className="list-item">
              <div className="row spread">
                <div className="title">{g.name}</div>
                <span className="badge">{memberCount} pessoas</span>
              </div>
              <p className="muted">
                {songCount} música{songCount === 1 ? '' : 's'}
                {g.description ? ` · ${g.description}` : ''}
              </p>
            </Link>
          )
        })}
      </div>

      <button
        type="button"
        className="fab above-nav"
        data-tour="groups-create"
        onClick={openCreate}
        aria-label="Criar grupo"
      >
        +
      </button>

      <Sheet open={showCreate} title="Novo grupo" onClose={() => setShowCreate(false)}>
        <form className="stack" onSubmit={onCreate}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="gname">Nome</label>
            <input
              id="gname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              placeholder="Nome do grupo"
              required
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="gdesc">Descrição</label>
            <textarea
              id="gdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoCapitalize="sentences"
              spellCheck
              enterKeyHint="done"
              placeholder="Sobre o grupo (opcional)"
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn block" disabled={submitting}>
            {submitting ? 'Criando…' : 'Criar'}
          </button>
        </form>
      </Sheet>

      <Sheet open={showJoin} title="Entrar no grupo" onClose={() => setShowJoin(false)}>
        <form className="stack" onSubmit={onJoin}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="code">Código de convite</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="done"
              placeholder="Código do convite"
              required
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn block" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </Sheet>
    </Page>
  )
}
