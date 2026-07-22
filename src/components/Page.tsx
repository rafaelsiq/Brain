import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BottomNav } from '@/components/BottomNav'

export function Page({
  title,
  backTo,
  action,
  children,
  footer,
  kicker,
  showNav = false,
  brandTitle = false,
  narrow = false,
  wide = false,
}: {
  title?: string
  backTo?: string
  action?: ReactNode
  children: ReactNode
  /** Pinned bottom bar (e.g. verse composer) */
  footer?: ReactNode
  kicker?: string
  /** Bottom nav (Grupos / Perfil) */
  showNav?: boolean
  /** Use display font for title (home wordmark) */
  brandTitle?: boolean
  narrow?: boolean
  wide?: boolean
}) {
  const shellClass = [
    'app-shell',
    showNav ? 'with-nav' : '',
    footer ? 'with-footer' : '',
    narrow ? 'narrow' : '',
    wide ? 'wide' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div className={shellClass}>
        {(title || backTo || action || kicker) && (
          <header className="page-header">
            <div className="row grow">
              {backTo && (
                <Link to={backTo} className="btn icon" aria-label="Voltar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M15 5 8 12l7 7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              )}
              <div className="grow">
                {kicker && <p className="page-kicker">{kicker}</p>}
                {title && <h1 className={brandTitle ? 'brand-mark' : undefined}>{title}</h1>}
              </div>
            </div>
            {action}
          </header>
        )}
        {children}
      </div>
      {footer}
      {showNav && <BottomNav />}
    </>
  )
}
