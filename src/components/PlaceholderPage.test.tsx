import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlaceholderPage } from '@/components/PlaceholderPage'

describe('PlaceholderPage', () => {
  it('renders title and description', () => {
    render(
      <PlaceholderPage title="Habits & Tasks" description="Manage recurring habits." />,
    )
    expect(screen.getByRole('heading', { name: 'Habits & Tasks' })).toBeInTheDocument()
    expect(screen.getByText('Manage recurring habits.')).toBeInTheDocument()
    expect(screen.getByText(/Placeholder route/)).toBeInTheDocument()
  })
})
