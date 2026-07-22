import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import App from '@/App'
import { applyTheme, getStoredTheme } from '@/lib/theme'
import '@/styles/global.css'

applyTheme(getStoredTheme())

async function bootNative() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await SplashScreen.hide()
  } catch {
    // ignore
  }
}

void bootNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
