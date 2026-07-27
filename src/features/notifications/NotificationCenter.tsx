import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  disablePushNotifications,
  displayNotificationText,
  enablePushNotifications,
  filterNotificationsByGroup,
  notificationKindLabel,
  sendTestNotification,
  type NotificationFilterGroup,
} from '@/features/notifications/notificationService'
import { useNotifications } from '@/features/notifications/useNotifications'
import type { NotificationPreferences } from '@/types/models'

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const INBOX_FILTERS: Array<{ group: NotificationFilterGroup; label: string }> = [
  { group: 'habit', label: 'Habits' },
  { group: 'journal', label: 'Journal' },
  { group: 'chat', label: 'Chat' },
  { group: 'daily_prompt', label: 'Daily prompt' },
]

export function NotificationBell(props: {
  relationshipId: string | undefined
  userId: string | undefined
}) {
  const { notifications, preferences, unread, markRead, markAllRead } = useNotifications(
    props.relationshipId,
    props.userId,
  )
  const [open, setOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<NotificationFilterGroup[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  const discreetMode = preferences?.discreetMode ?? false
  const filtered = useMemo(
    () => filterNotificationsByGroup(notifications, activeFilters),
    [notifications, activeFilters],
  )

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function toggleFilter(group: NotificationFilterGroup) {
    setActiveFilters((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    )
  }

  if (!props.relationshipId || !props.userId) return null

  return (
    <div ref={rootRef} className="relative px-3 pb-2">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-stone-300 hover:bg-stone-800/70 hover:text-stone-50"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <span>Notifications</span>
        {unread > 0 ? (
          <span className="rounded-md bg-rose-900/80 px-1.5 py-0.5 text-[10px] font-medium text-rose-100">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-2 right-2 z-20 mt-1 max-h-96 overflow-y-auto rounded-md border border-stone-700 bg-stone-950 shadow-lg">
          <div className="flex items-center justify-between border-b border-stone-800 px-3 py-2">
            <p className="text-xs font-medium text-stone-300">Inbox</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-[11px] text-rose-400 hover:text-rose-300"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1 border-b border-stone-800 px-3 py-2">
            {INBOX_FILTERS.map((filter) => {
              const active = activeFilters.includes(filter.group)
              return (
                <button
                  key={filter.group}
                  type="button"
                  className={[
                    'rounded-full px-2 py-0.5 text-[10px]',
                    active
                      ? 'bg-rose-900/60 text-rose-100'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200',
                  ].join(' ')}
                  onClick={() => toggleFilter(filter.group)}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-stone-500">
              {notifications.length === 0 ? 'No notifications yet.' : 'No matches for this filter.'}
            </p>
          ) : (
            <ul className="divide-y divide-stone-800">
              {filtered.slice(0, 20).map((n) => {
                const text = displayNotificationText(n, discreetMode)
                return (
                  <li key={n.id}>
                    <NavLink
                      to={n.href || '/'}
                      className="block px-3 py-2 hover:bg-stone-900"
                      onClick={() => {
                        void markRead(n.id)
                        setOpen(false)
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-wide text-stone-500">
                        {notificationKindLabel(n.kind)}
                      </p>
                      <p
                        className={[
                          'mt-0.5 text-xs',
                          n.readAt ? 'text-stone-400' : 'font-medium text-stone-100',
                        ].join(' ')}
                      >
                        {text.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-500">{text.body}</p>
                      <p className="mt-0.5 text-[10px] text-stone-600">{formatWhen(n.createdAt)}</p>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="border-t border-stone-800 px-3 py-2">
            <NavLink
              to="/settings"
              className="text-[11px] text-rose-400 hover:text-rose-300"
              onClick={() => setOpen(false)}
            >
              Notification settings
            </NavLink>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const PREF_ROWS: Array<{
  key: keyof Pick<
    NotificationPreferences,
    | 'habitReminders'
    | 'habitCompleted'
    | 'habitMissed'
    | 'sharedJournal'
    | 'chatMessage'
    | 'dailyPrompt'
  >
  label: string
  hint: string
}> = [
  {
    key: 'habitReminders',
    label: 'Habit reminders',
    hint: 'Local time alarms you schedule on habits',
  },
  {
    key: 'habitCompleted',
    label: 'Habit completed',
    hint: 'When a partner completes a habit (for Dominant / Switch)',
  },
  {
    key: 'habitMissed',
    label: 'Habit missed',
    hint: 'When a partner marks a habit missed',
  },
  {
    key: 'sharedJournal',
    label: 'Shared journal',
    hint: 'When a partner posts a shared entry',
  },
  {
    key: 'chatMessage',
    label: 'Chat messages',
    hint: 'When a partner sends a chat message',
  },
  {
    key: 'dailyPrompt',
    label: 'Daily prompt',
    hint: 'Once per day with today’s journal prompt',
  },
]

export function NotificationSettingsPanel(props: {
  relationshipId: string
  userId: string
}) {
  const { preferences, savePreferences, loading, refresh } = useNotifications(
    props.relationshipId,
    props.userId,
    { runScheduler: false },
  )
  const [pushMessage, setPushMessage] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading && !preferences) {
    return <p className="text-sm text-stone-500">Loading notification settings…</p>
  }
  if (!preferences) return null

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {PREF_ROWS.map((row) => (
          <li key={row.key} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-stone-200">{row.label}</p>
              <p className="text-xs text-stone-500">{row.hint}</p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(preferences[row.key])}
              onChange={(e) => {
                void savePreferences({ [row.key]: e.target.checked })
              }}
            />
          </li>
        ))}
      </ul>

      <div className="border-t border-stone-800 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-stone-200">Discreet mode</p>
            <p className="text-xs text-stone-500">
              Show generic text in the inbox and push (e.g. “New activity”) instead of habit titles
              or message previews.
            </p>
          </div>
          <input
            type="checkbox"
            checked={Boolean(preferences.discreetMode)}
            onChange={(e) => {
              void savePreferences({ discreetMode: e.target.checked })
            }}
          />
        </div>
      </div>

      <div className="border-t border-stone-800 pt-4">
        <p className="text-sm text-stone-200">Daily prompt time</p>
        <p className="mt-1 text-xs text-stone-500">
          Local time when today’s journal prompt is delivered (checked every minute).
        </p>
        <input
          type="time"
          className="mt-2 rounded border border-stone-700 bg-stone-900 px-2 py-1 text-sm text-stone-200"
          value={preferences.dailyPromptTimeLocal}
          onChange={(e) => {
            const dailyPromptTimeLocal = e.target.value
            if (!dailyPromptTimeLocal) return
            void savePreferences({ dailyPromptTimeLocal })
          }}
        />
      </div>

      <div className="border-t border-stone-800 pt-4">
        <p className="text-sm text-stone-200">Browser / push delivery</p>
        <p className="mt-1 text-xs text-stone-500">
          Uses the Notification API in demo mode. With Firebase + VITE_FIREBASE_VAPID_KEY, an FCM
          token is stored for remote push.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || preferences.pushEnabled}
            className="rounded-md border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-200 hover:border-rose-500 disabled:opacity-40"
            onClick={() => {
              setBusy(true)
              void enablePushNotifications({
                relationshipId: props.relationshipId,
                userId: props.userId,
              })
                .then((result) => {
                  setPushMessage(result.message)
                  return savePreferences({ pushEnabled: result.ok })
                })
                .finally(() => setBusy(false))
            }}
          >
            {preferences.pushEnabled ? 'Push enabled' : 'Enable push'}
          </button>
          {preferences.pushEnabled ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400"
              onClick={() => {
                setBusy(true)
                void disablePushNotifications({
                  relationshipId: props.relationshipId,
                  userId: props.userId,
                })
                  .then(() => {
                    setPushMessage('Push notifications disabled.')
                    return savePreferences({ pushEnabled: false, fcmToken: null })
                  })
                  .finally(() => setBusy(false))
              }}
            >
              Disable
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400"
            onClick={() => {
              setBusy(true)
              setTestMessage(null)
              void sendTestNotification({
                relationshipId: props.relationshipId,
                userId: props.userId,
              })
                .then(() => {
                  setTestMessage('Test notification sent. Check the inbox (and push if enabled).')
                  return refresh()
                })
                .catch((err: unknown) => {
                  setTestMessage(err instanceof Error ? err.message : 'Could not send test.')
                })
                .finally(() => setBusy(false))
            }}
          >
            Send test notification
          </button>
        </div>
        {pushMessage ? <p className="mt-2 text-xs text-stone-400">{pushMessage}</p> : null}
        {testMessage ? <p className="mt-2 text-xs text-stone-400">{testMessage}</p> : null}
      </div>
    </div>
  )
}

export function NotificationDashboardWidget(props: {
  relationshipId: string
  userId: string
}) {
  const { notifications, preferences, unread, loading } = useNotifications(
    props.relationshipId,
    props.userId,
    { runScheduler: false },
  )
  const latest = notifications[0]
  const text = latest
    ? displayNotificationText(latest, preferences?.discreetMode ?? false)
    : null

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Notifications</p>
          <p className="mt-1 text-2xl font-semibold text-stone-50">
            {loading ? '…' : unread}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">unread</p>
        </div>
        <NavLink to="/settings" className="text-xs text-rose-400 hover:text-rose-300">
          Settings
        </NavLink>
      </div>
      {text ? (
        <p className="mt-3 border-t border-stone-800 pt-3 text-sm text-stone-300">
          <span className="text-stone-500">Latest: </span>
          {latest ? (
            <>
              <span className="text-[10px] uppercase tracking-wide text-stone-500">
                {notificationKindLabel(latest.kind)}
              </span>
              {' · '}
              {text.title}
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-xs text-stone-500">No alerts yet.</p>
      )}
    </div>
  )
}
