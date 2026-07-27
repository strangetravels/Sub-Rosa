import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { PlaceholderPage } from '@/components/PlaceholderPage'
import { RequireAuth, RequireRelationship } from '@/app/RequireAuth'
import { AuthPage } from '@/features/auth/AuthPage'
import { OnboardingPage } from '@/features/relationships/OnboardingPage'
import { PartnersSettingsPage } from '@/features/relationships/PartnersSettingsPage'
import { DashboardPage } from '@/features/relationships/DashboardPage'
import { HabitsPage } from '@/features/habits/HabitsPage'
import { RewardsPage } from '@/features/rewards/RewardsPage'
import { RulesPage } from '@/features/rules/RulesPage'
import { useAuth } from '@/features/auth/AuthProvider'

function AuthEntry() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-stone-400">
        Loading…
      </div>
    )
  }
  if (user) return <Navigate to="/" replace />
  return <AuthPage />
}

export function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthEntry />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<RequireRelationship />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="rewards" element={<RewardsPage />} />
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
            <Route path="settings" element={<PartnersSettingsPage />} />
            <Route
              path="*"
              element={
                <PlaceholderPage
                  title="Not found"
                  description="That screen isn’t part of this build yet."
                />
              }
            />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
