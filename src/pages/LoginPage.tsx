import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorPopup } from '@/components/ErrorPopup'
import { Page } from '@/components/Page'
import { login } from '@/data/store'

const ERROR_TIMEOUT_MS = 4000

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), ERROR_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [error])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/groups')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page title="Entrar" backTo="/welcome" narrow centerContent>
      <ErrorPopup message={error} durationMs={ERROR_TIMEOUT_MS} />
      <form className="stack" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            placeholder="nome@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            enterKeyHint="done"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <button type="submit" className="btn block" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted" style={{ textAlign: 'center' }}>
          <Link to="/reset-password">Esqueci minha senha</Link>
        </p>
        <p className="muted" style={{ textAlign: 'center' }}>
          Não tem conta? <Link to="/register">Cadastre-se</Link>
        </p>
      </form>
    </Page>
  )
}
