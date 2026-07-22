import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()

  if (compact) {
    const toLight = theme === 'dark'
    return (
      <button
        type="button"
        className="btn icon"
        onClick={() => setTheme(toLight ? 'light' : 'dark')}
        aria-label={toLight ? 'Ativar tema claro' : 'Ativar tema escuro'}
        title={toLight ? 'Tema claro' : 'Tema escuro'}
      >
        {toLight ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 2v2.2M12 19.8V22M4.2 12H2M22 12h-2.2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19 13.5A7.5 7.5 0 1 1 10.5 5 6 6 0 0 0 19 13.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    )
  }

  return (
    <div className="field">
      <label>Aparência</label>
      <div className="theme-switch" role="group" aria-label="Tema">
        <button
          type="button"
          className={theme === 'light' ? 'active' : ''}
          onClick={() => setTheme('light')}
        >
          Claro
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'active' : ''}
          onClick={() => setTheme('dark')}
        >
          Escuro
        </button>
      </div>
    </div>
  )
}
