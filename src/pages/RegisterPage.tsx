import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page } from '@/components/Page'
import { register } from '@/data/store'

const ERROR_TIMEOUT_MS = 4000

export function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), ERROR_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [error])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await register({ name, email, password })
      navigate('/groups')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar')
    }
  }

  return (
    <Page title="Criar conta" backTo="/welcome" narrow centerContent>
      <form className="stack" onSubmit={onSubmit}>
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <span className="error-progress-track" aria-hidden>
              <span
                className="error-progress"
                style={{ animationDuration: `${ERROR_TIMEOUT_MS}ms` }}
              />
            </span>
          </div>
        )}
        <div className="field">
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Seu nome"
            required
          />
        </div>
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
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            enterKeyHint="done"
            placeholder="Mínimo 4 caracteres"
            minLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <p className="muted">
          Sua cor no brainstorm é definida automaticamente ao entrar em cada grupo, sem
          conflito com outros membros.
        </p>
        <button type="submit" className="btn block">
          Cadastrar
        </button>
        <p className="muted" style={{ textAlign: 'center' }}>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </Page>
  )
}
