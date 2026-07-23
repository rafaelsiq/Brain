import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Page } from '@/components/Page'
import { useAuth } from '@/contexts/AuthContext'
import { currentProfile, joinGroupByCode } from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'
import { setPendingInvite } from '@/lib/pendingInvite'

export function JoinPage() {
  useBrainStore()
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { ready } = useAuth()
  const profile = currentProfile()
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'working' | 'need-auth' | 'error'>('working')

  useEffect(() => {
    if (!ready) return
    const invite = decodeURIComponent(code).trim()
    if (!invite) {
      setError('Convite inválido')
      setStatus('error')
      return
    }

    if (!profile) {
      setPendingInvite(invite)
      setStatus('need-auth')
      return
    }

    let cancelled = false
    setStatus('working')
    void (async () => {
      try {
        const group = await joinGroupByCode(invite, profile.id)
        if (!cancelled) navigate(`/groups/${group.id}`, { replace: true })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível entrar no grupo')
          setStatus('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ready, profile?.id, code, navigate, profile])

  if (!ready || status === 'working') {
    return (
      <Page title="Entrar no grupo" narrow centerContent>
        <p className="muted" style={{ textAlign: 'center' }}>
          Entrando no grupo…
        </p>
      </Page>
    )
  }

  if (status === 'need-auth') {
    return (
      <Page title="Convite" backTo="/welcome" narrow centerContent>
        <div className="stack activation-panel">
          <h2 className="section-title">Você foi convidado</h2>
          <p className="muted">
            Crie uma conta ou entre para participar deste grupo.
          </p>
          <Link to="/register" className="btn block">
            Criar conta
          </Link>
          <Link to="/login" className="btn secondary block">
            Entrar
          </Link>
        </div>
      </Page>
    )
  }

  return (
    <Page title="Convite" backTo={profile ? '/groups' : '/welcome'} narrow centerContent>
      <div className="stack">
        <div className="error">{error || 'Convite inválido'}</div>
        <Link to={profile ? '/groups' : '/welcome'} className="btn block">
          Continuar
        </Link>
      </div>
    </Page>
  )
}
