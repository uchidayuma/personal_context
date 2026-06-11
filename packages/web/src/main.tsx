import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import type { ComponentType, PropsWithChildren } from 'react'
import './index.css'
import './i18n/index.js'
import App from './App.js'
import { getDemoUserId } from './lib/userId.js'

type ClerkRootProviderProps = PropsWithChildren<{ afterSignOutUrl?: string }>

// publishableKey is read from VITE_CLERK_PUBLISHABLE_KEY at runtime by ClerkProvider.
const ClerkRootProvider = ClerkProvider as ComponentType<ClerkRootProviderProps>

if (import.meta.env.VITE_DEMO_MODE === 'true') {
  const userId = getDemoUserId()
  const originalFetch = window.fetch
  window.fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('X-User-Id', userId)
    return originalFetch(input, { ...init, headers })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkRootProvider afterSignOutUrl="/">
      <App />
    </ClerkRootProvider>
  </StrictMode>,
)
