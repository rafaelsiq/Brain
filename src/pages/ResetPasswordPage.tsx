import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorPopup } from '@/components/ErrorPopup'
import { Page } from '@/components/Page'
import { requestPasswordReset, usingFirebase } from '@/data/store'

const FEEDBACK_TIMEOUT_MS = 4500

export function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), FEEDBACK_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [error])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(''), FEEDBACK_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [success])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      if (!usingFirebase && newPassword !== confirmPassword) {
        throw new Error('A confirmação de senha não confere')
      }
      await requestPasswordReset({
        email,
        newPassword: usingFirebase ? undefined : newPassword,
      })
      setSuccess(
        usingFirebase
          ? 'Se o e-mail existir, enviamos um link para redefinir a senha.'
          : 'Senha redefinida com sucesso. Você já pode entrar com a nova senha.',
      )
      if (!usingFirebase) {
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page title="Redefinir senha" backTo="/login" narrow centerContent>
      <ErrorPopup message={error} durationMs={FEEDBACK_TIMEOUT_MS} />
      <form className="stack" onSubmit={onSubmit}>
        {success && <div className="success">{success}</div>}
        <div className="field">
          <label htmlFor="reset-email">E-mail</label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nome@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </div>

        {!usingFirebase && (
          <>
            <div className="field">
              <label htmlFor="new-password">Nova senha</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={4}
                placeholder="Mínimo 4 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirmar nova senha</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={4}
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </>
        )}

        <button type="submit" className="btn block" disabled={submitting}>
          {submitting
            ? 'Enviando…'
            : usingFirebase
              ? 'Enviar link de redefinição'
              : 'Redefinir senha'}
        </button>
        <p className="muted" style={{ textAlign: 'center' }}>
          Lembrou a senha? <Link to="/login">Voltar para entrar</Link>
        </p>
      </form>
    </Page>
  )
}
