import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '@/components/Page'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  currentProfile,
  deleteAccount,
  logout,
  updateProfile,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'

export function ProfilePage() {
  useBrainStore()
  const profile = currentProfile()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.name ?? '')
  const [saved, setSaved] = useState(false)

  if (!profile) return null

  async function onSave(e: FormEvent) {
    e.preventDefault()
    await updateProfile(profile!.id, { name })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Page
      title="Perfil"
      showNav
      action={
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            void logout().then(() => navigate('/welcome'))
          }}
        >
          Sair
        </button>
      }
    >
      <form className="stack" onSubmit={onSave}>
        <ThemeToggle />
        <div className="field">
          <label>E-mail</label>
          <input value={profile.email} disabled />
        </div>
        <div className="field">
          <label htmlFor="name">Nome</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <p className="muted">
          Sua cor no brainstorm é definida no vínculo com cada grupo, para evitar conflitos.
        </p>
        <button type="submit" className="btn block">
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
        <button
          type="button"
          className="btn danger block"
          onClick={() => {
            if (confirm('Excluir conta e dados locais deste usuário?')) {
              deleteAccount(profile.id)
              navigate('/welcome')
            }
          }}
        >
          Excluir conta
        </button>
      </form>
    </Page>
  )
}
