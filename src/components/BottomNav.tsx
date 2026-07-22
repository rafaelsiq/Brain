import { NavLink } from 'react-router-dom'

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Principal">
      <NavLink to="/groups" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M3.5 19c.6-2.8 2.8-4.5 5-4.5s4.4 1.7 5 4.5M13.5 19c.3-1.6 1.2-3 2.8-3.6 1-.4 2.2-.4 3.2 0 .9.4 1.6 1.2 2 2.2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        Grupos
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : undefined)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M5.5 19c1.2-3 3.4-4.5 6.5-4.5s5.3 1.5 6.5 4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        Perfil
      </NavLink>
    </nav>
  )
}
