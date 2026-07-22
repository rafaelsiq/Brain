import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page } from '@/components/Page'
import { Sheet } from '@/components/Sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  createGroup,
  currentProfile,
  groupsForUser,
  joinGroupByCode,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'

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

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const g = await createGroup({ name, description, createdBy: profile.id })
      setShowCreate(false)
      setName('')
      setDescription('')
      navigate(`/groups/${g.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar grupo')
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    try {
      const g = await joinGroupByCode(code, profile.id)
      setShowJoin(false)
      setCode('')
      navigate(`/groups/${g.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <Page
      title="Brain"
      brandTitle
      showNav
      wide
      action={<ThemeToggle compact />}
    >
      <div>
        <p className="section-label">Biblioteca</p>
        <h2 className="section-title">Meus grupos</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Entre com um convite ou crie um grupo para começar a compor.
        </p>
      </div>

      <div className="list">
        {groups.length === 0 && (
          <div className="empty">Nenhum grupo ainda. Toque em + para criar o primeiro.</div>
        )}
        {groups.map((g) => {
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

      <div className="actions-block">
        <button type="button" className="btn secondary block" onClick={() => setShowJoin(true)}>
          Entrar com código
        </button>
      </div>

      <button
        type="button"
        className="fab above-nav"
        onClick={() => setShowCreate(true)}
        aria-label="Criar grupo"
      >
        +
      </button>

      <Sheet open={showCreate} title="Novo grupo" onClose={() => setShowCreate(false)}>
        <form className="stack" onSubmit={onCreate}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="gname">Nome</label>
            <input id="gname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="gdesc">Descrição</label>
            <textarea
              id="gdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button type="submit" className="btn block">
            Criar
          </button>
        </form>
      </Sheet>

      <Sheet open={showJoin} title="Entrar no grupo" onClose={() => setShowJoin(false)}>
        <form className="stack" onSubmit={onJoin}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="code">Código de convite</label>
            <input id="code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <button type="submit" className="btn block">
            Entrar
          </button>
        </form>
      </Sheet>
    </Page>
  )
}
