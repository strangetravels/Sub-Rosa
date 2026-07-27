import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RelationshipProvider } from '@/features/relationships/RelationshipProvider'
import { ChatPage } from '@/features/chat/ChatPage'
import { signUp } from '@/features/auth/authService'
import { createRelationship } from '@/features/relationships/relationshipService'

function renderChat() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RelationshipProvider>
          <ChatPage />
        </RelationshipProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ChatPage', () => {
  it('sends a message and shows it in the thread', async () => {
    const u = userEvent.setup()
    const profile = await signUp('chatui@example.com', 'secret123', 'Chat UI')
    await createRelationship({
      user: profile,
      name: 'Chat Dynamic',
      role: 'dominant',
      passphrase: 'encrypt-me-please',
    })

    renderChat()

    const box = await screen.findByPlaceholderText(/message/i)
    await u.type(box, 'Hello partner')
    await u.click(screen.getByRole('button', { name: /^Send$/i }))

    await waitFor(() => {
      expect(screen.getByText('Hello partner')).toBeInTheDocument()
    })
  })
})
