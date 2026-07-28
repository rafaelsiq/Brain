import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorPopup } from '@/components/ErrorPopup'
import { Page } from '@/components/Page'
import { requestPasswordReset, usingFirebase } from '@/data/store'

const FEEDBACK_TIMEOUT_MS = 4500

export function ResetPasswordPage() {
  const [email, setEmail] = useState('')
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
      await requestPasswordReset({ email })
      setSuccess('Se o e-mail existir, enviamos um link para redefinir a senha.')
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
        {!usingFirebase && (
          <div className="notice">
            Para segurança, a redefinição exige envio de link por e-mail. Configure o Firebase
            Auth para habilitar este fluxo.
          </div>
        )}
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

        <button type="submit" className="btn block" disabled={submitting || !usingFirebase}>
          {submitting ? 'Enviando…' : 'Enviar link de redefinição'}
        </button>
        <p className="muted" style={{ textAlign: 'center' }}>
          Lembrou a senha? <Link to="/login">Voltar para entrar</Link>
        </p>
      </form>
    </Page>
  )
}
