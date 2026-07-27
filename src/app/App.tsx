import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { PlaceholderPage } from '@/components/PlaceholderPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <PlaceholderPage
              title="Dashboard"
              description="Today’s habits, points balance, and quick actions will live here."
            />
          }
        />
        <Route
          path="habits"
          element={
            <PlaceholderPage
              title="Habits & Tasks"
              description="Create, edit, and archive recurring habits for the active relationship."
            />
          }
        />
        <Route
          path="rules"
          element={
            <PlaceholderPage
              title="Rules"
              description="Versioned rule library with optional acknowledgment."
            />
          }
        />
        <Route
          path="rewards"
          element={
            <PlaceholderPage
              title="Rewards & Punishments"
              description="Catalogs, manual apply, and auto-triggers from habits."
            />
          }
        />
        <Route
          path="points"
          element={
            <PlaceholderPage
              title="Points"
              description="Ledger balance, history, and reward store."
            />
          }
        />
        <Route
          path="journal"
          element={
            <PlaceholderPage
              title="Journal"
              description="Private and shared encrypted entries, prompts, and streaks."
            />
          }
        />
        <Route
          path="chat"
          element={
            <PlaceholderPage
              title="Chat"
              description="Real-time encrypted messaging for the active relationship."
            />
          }
        />
        <Route
          path="stats"
          element={
            <PlaceholderPage
              title="Stats"
              description="Completion rates, points trends, and streak analytics."
            />
          }
        />
        <Route
          path="settings"
          element={
            <PlaceholderPage
              title="Settings"
              description="Theme, passcode, partner management, and notifications."
            />
          }
        />
        <Route
          path="*"
          element={
            <PlaceholderPage
              title="Not found"
              description="That screen isn’t part of the scaffold yet."
            />
          }
        />
      </Route>
    </Routes>
  )
}
