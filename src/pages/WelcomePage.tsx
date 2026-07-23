import { Link } from 'react-router-dom'
import { Page } from '@/components/Page'

export function WelcomePage() {
  return (
    <Page narrow>
      <div className="hero">
        <div>
          <p className="page-kicker">brainstorm musical</p>
          <h1 className="hero-brand">Collabrain</h1>
          <p className="hero-copy">
            Crie músicas em grupo: proponha versos, vote, refine e grave juntos.
          </p>
          <div className="hero-visual" aria-hidden="true" />
        </div>
        <div className="hero-actions">
          <Link to="/login" className="btn block">
            Entrar
          </Link>
          <Link to="/register" className="btn secondary block">
            Criar conta
          </Link>
        </div>
      </div>
    </Page>
  )
}
