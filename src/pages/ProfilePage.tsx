import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '@/components/Page'
import { Sheet } from '@/components/Sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { compressImageToDataUrl, profileInitials } from '@/lib/avatar'
import {
  changePassword,
  currentProfile,
  deleteAccount,
  logout,
  profileActivityStats,
  updateProfile,
  uploadAvatar,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'
import { useTour } from '@/components/Tour/TourProvider'

export function ProfilePage() {
  useBrainStore()
  const profile = currentProfile()
  const navigate = useNavigate()
  const { start: startTourUi } = useTour()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(profile?.name ?? '')
  const [saved, setSaved] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordOk, setPasswordOk] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  if (!profile) return null

  const stats = profileActivityStats(profile.id)
  const avatarSrc = previewUrl ?? profile.avatarUrl
  const initials = profileInitials(name || profile.name)

  async function onSave(e: FormEvent) {
    e.preventDefault()
    await updateProfile(profile!.id, { name: name.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function onAvatarChange(file: File | undefined) {
    if (!file) return
    setAvatarError('')
    setAvatarBusy(true)
    try {
      const dataUrl = await compressImageToDataUrl(file)
      setPreviewUrl(dataUrl)
      await uploadAvatar(profile!.id, dataUrl)
      setPreviewUrl(null)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Falha ao enviar foto')
      setPreviewUrl(null)
    } finally {
      setAvatarBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordOk(false)
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres')
      return
    }
    setPasswordBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordOk(true)
      setTimeout(() => {
        setShowPassword(false)
        setPasswordOk(false)
      }, 900)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Não foi possível alterar a senha')
    } finally {
      setPasswordBusy(false)
    }
  }

  async function onDelete(e: FormEvent) {
    e.preventDefault()
    setDeleteError('')
    setDeleteBusy(true)
    try {
      await deleteAccount(profile!.id, deletePassword)
      navigate('/welcome')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Não foi possível excluir a conta')
      setDeleteBusy(false)
    }
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
      <div className="stack">
        <header className="profile-hero">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onAvatarChange(e.target.files?.[0])}
          />
          <button
            type="button"
            className="avatar avatar-lg avatar-btn"
            disabled={avatarBusy}
            aria-label="Alterar foto de perfil"
            onClick={() => fileRef.current?.click()}
          >
            {avatarSrc ? <img src={avatarSrc} alt="" /> : initials}
          </button>
          <p className="avatar-hint">{avatarBusy ? 'Enviando…' : 'Toque para alterar a foto'}</p>
          {avatarError && <div className="error">{avatarError}</div>}
          <h2 className="profile-hero-name">{name.trim() || profile.name}</h2>
          <p className="muted profile-hero-email">{profile.email}</p>
        </header>

        <section className="profile-section" aria-labelledby="profile-activity">
          <div>
            <p className="section-label" id="profile-activity">
              Atividade
            </p>
            <h3 className="section-title">Sua conta</h3>
          </div>
          <div className="stat-row">
            <div className="stat-item">
              <span className="stat-value">{stats.groups}</span>
              <span className="stat-label">Grupos</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.songs}</span>
              <span className="stat-label">Músicas</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.takes}</span>
              <span className="stat-label">Takes</span>
            </div>
          </div>
        </section>

        <section className="profile-section" aria-labelledby="profile-account">
          <div>
            <p className="section-label" id="profile-account">
              Conta
            </p>
            <h3 className="section-title">Dados pessoais</h3>
          </div>
          <form className="stack" onSubmit={onSave}>
            <div className="field">
              <label>E-mail</label>
              <input value={profile.email} disabled placeholder="E-mail da conta" />
            </div>
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="done"
                placeholder="Seu nome"
                required
              />
            </div>
            <p className="muted">
              Sua cor no brainstorm é definida no vínculo com cada grupo, para evitar conflitos.
            </p>
            <button type="submit" className="btn block">
              {saved ? 'Salvo!' : 'Salvar'}
            </button>
          </form>
        </section>

        <section
          className="profile-section"
          aria-labelledby="profile-appearance"
          data-tour="profile-theme"
        >
          <div>
            <p className="section-label" id="profile-appearance">
              Aparência
            </p>
            <h3 className="section-title">Tema</h3>
          </div>
          <ThemeToggle />
        </section>

        <section className="profile-section" aria-labelledby="profile-security">
          <div>
            <p className="section-label" id="profile-security">
              Segurança
            </p>
            <h3 className="section-title">Acesso</h3>
          </div>
          <button
            type="button"
            className="btn secondary block"
            onClick={() => {
              setPasswordError('')
              setPasswordOk(false)
              setShowPassword(true)
            }}
          >
            Alterar senha
          </button>
        </section>

        <section className="profile-section" aria-labelledby="profile-onboarding">
          <div>
            <p className="section-label" id="profile-onboarding">
              Onboarding
            </p>
            <h3 className="section-title">Tour guiado</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              Destaca na tela onde criar grupo, música, verso, convite e tema.
            </p>
          </div>
          <button type="button" className="btn secondary block" onClick={() => startTourUi()}>
            Ativar onboarding
          </button>
        </section>

        <section className="danger-zone" aria-labelledby="profile-danger">
          <div>
            <p className="section-label" id="profile-danger">
              Zona de perigo
            </p>
            <p className="muted" style={{ marginTop: 4 }}>
              Excluir a conta remove seu perfil e vínculos. Grupos só seus também são apagados.
            </p>
          </div>
          <button type="button" className="danger-link" onClick={() => setShowDelete(true)}>
            Excluir conta
          </button>
        </section>
      </div>

      <Sheet
        open={showPassword}
        title="Alterar senha"
        onClose={() => {
          if (!passwordBusy) setShowPassword(false)
        }}
      >
        <form className="stack" onSubmit={onChangePassword}>
          {passwordError && <div className="error">{passwordError}</div>}
          {passwordOk && <div className="muted">Senha atualizada.</div>}
          <div className="field">
            <label htmlFor="cur-pass">Senha atual</label>
            <input
              id="cur-pass"
              type="password"
              autoComplete="current-password"
              enterKeyHint="next"
              placeholder="Senha atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-pass">Nova senha</label>
            <input
              id="new-pass"
              type="password"
              autoComplete="new-password"
              enterKeyHint="next"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-pass">Confirmar nova senha</label>
            <input
              id="confirm-pass"
              type="password"
              autoComplete="new-password"
              enterKeyHint="done"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn block" disabled={passwordBusy}>
            {passwordBusy ? 'Salvando…' : 'Atualizar senha'}
          </button>
        </form>
      </Sheet>

      <Sheet
        open={showDelete}
        title="Excluir conta"
        onClose={() => {
          if (!deleteBusy) setShowDelete(false)
        }}
      >
        <form className="stack" onSubmit={onDelete}>
          <p className="muted">
            Esta ação é permanente. Confirme com sua senha para apagar a conta no Firebase e os
            dados locais.
          </p>
          {deleteError && <div className="error">{deleteError}</div>}
          <div className="field">
            <label htmlFor="del-pass">Senha</label>
            <input
              id="del-pass"
              type="password"
              autoComplete="current-password"
              enterKeyHint="done"
              placeholder="Confirme com sua senha"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn danger block" disabled={deleteBusy}>
            {deleteBusy ? 'Excluindo…' : 'Excluir definitivamente'}
          </button>
        </form>
      </Sheet>
    </Page>
  )
}
