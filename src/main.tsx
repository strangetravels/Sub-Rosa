import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { App } from '@/app/App'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { SecurityProvider } from '@/features/security/SecurityProvider'
import './index.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SecurityProvider>
          <RelationshipProvider>
            <App />
          </RelationshipProvider>
        </SecurityProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
