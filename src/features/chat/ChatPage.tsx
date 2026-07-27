import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  DECRYPT_FAILED_TEXT,
  deleteChatMessage,
  LOCKED_TEXT,
  sendChatMessage,
} from '@/features/chat/chatService'
import { useChatData } from '@/features/chat/useChatData'
import { useJournalData } from '@/features/journal/useJournalData'
import { useRelationship } from '@/features/relationships/RelationshipProvider'

function isLockedText(value: string): boolean {
  return value === LOCKED_TEXT || value === DECRYPT_FAILED_TEXT
}

function formatTime(iso: string): string {
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

export function ChatPage() {
  const { user } = useAuth()
  const { activeRelationship } = useRelationship()
  const relationshipId = activeRelationship?.id
  const { messages, loading } = useChatData(relationshipId, user?.id)
  const { entries: journalEntries } = useJournalData(relationshipId, user?.id)

  const [draft, setDraft] = useState('')
  const [attachId, setAttachId] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const sharedJournal = useMemo(
    () =>
      journalEntries
        .filter((e) => e.visibility === 'shared')
        .slice(0, 20),
    [journalEntries],
  )

  const selectedJournal = sharedJournal.find((e) => e.id === attachId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (!activeRelationship || !user) {
    return (
      <section className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Chat</h2>
        <p className="mt-2 text-stone-400">Select an active relationship first.</p>
      </section>
    )
  }

  async function handleSend() {
    if (sending) return
    setSending(true)
    setError(null)
    try {
      await sendChatMessage({
        relationshipId: activeRelationship!.id,
        senderUserId: user!.id,
        body: draft,
        journalEntry: selectedJournal
          ? { id: selectedJournal.id, title: selectedJournal.title }
          : null,
      })
      setDraft('')
      setAttachId('')
      setShowAttach(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col" style={{ minHeight: '70vh' }}>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Chat</h2>
        <p className="mt-2 text-stone-400">
          Encrypted messaging for {activeRelationship.name}. Attach a shared journal entry when
          useful.
        </p>
      </div>

      <div className="flex flex-1 flex-col rounded-lg border border-stone-700 bg-stone-900/50">
        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '55vh' }}>
          {loading ? (
            <p className="text-sm text-stone-500">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-stone-500">No messages yet. Say hello.</p>
          ) : (
            messages.map((msg) => {
              const mine = msg.senderUserId === user.id
              const sender = activeRelationship.members.find((m) => m.userId === msg.senderUserId)
              const locked = isLockedText(msg.body)
              const readByPartner = activeRelationship.members.some(
                (m) => m.userId !== user.id && Boolean(msg.readBy?.[m.userId]),
              )
              return (
                <div
                  key={msg.id}
                  className={['flex', mine ? 'justify-end' : 'justify-start'].join(' ')}
                >
                  <div
                    className={[
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      mine
                        ? 'bg-rose-950/50 border border-rose-900/60 text-stone-100'
                        : 'bg-stone-950/60 border border-stone-800 text-stone-200',
                    ].join(' ')}
                  >
                    <p className="text-[11px] text-stone-500">
                      {mine ? 'You' : (sender?.displayName ?? 'Unknown')} · {formatTime(msg.createdAt)}
                      {mine && readByPartner ? ' · Read' : ''}
                    </p>
                    {msg.journalEntryId ? (
                      <div className="mt-1 rounded border border-stone-700 bg-stone-900/60 px-2 py-1.5">
                        <p className="text-[11px] uppercase tracking-wide text-stone-500">
                          Journal
                        </p>
                        <p className="text-stone-200">{msg.journalEntryTitle ?? 'Attached entry'}</p>
                        <NavLink
                          to="/journal"
                          className="text-[11px] text-rose-400 hover:text-rose-300"
                        >
                          Open journal
                        </NavLink>
                      </div>
                    ) : null}
                    {locked ? (
                      <div className="mt-1">
                        <p className="text-stone-400">{msg.body}</p>
                        <NavLink
                          to="/settings"
                          className="mt-1 inline-block text-[11px] text-rose-400 hover:text-rose-300"
                        >
                          Unlock in Settings
                        </NavLink>
                      </div>
                    ) : msg.body ? (
                      <p className="mt-1 whitespace-pre-wrap">{msg.body}</p>
                    ) : null}
                    {mine ? (
                      <button
                        type="button"
                        className="mt-1 text-[11px] text-stone-500 hover:text-rose-300"
                        onClick={() => {
                          void deleteChatMessage(activeRelationship.id, msg.id, user.id).catch(
                            (err: unknown) =>
                              setError(err instanceof Error ? err.message : 'Delete failed.'),
                          )
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-stone-700 p-3 space-y-2">
          {showAttach ? (
            <label className="block text-xs text-stone-400">
              Attach shared journal entry
              <select
                className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-sm text-stone-50 outline-none focus:border-rose-500"
                value={attachId}
                onChange={(e) => setAttachId(e.target.value)}
              >
                <option value="">None</option>
                {sharedJournal.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
              {sharedJournal.length === 0 ? (
                <p className="mt-1 text-[11px] text-stone-500">
                  No shared entries yet.{' '}
                  <NavLink to="/journal" className="text-rose-400 hover:text-rose-300">
                    Write one
                  </NavLink>
                </p>
              ) : null}
            </label>
          ) : null}
          {selectedJournal ? (
            <p className="text-xs text-stone-400">
              Attaching: <span className="text-stone-200">{selectedJournal.title}</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            <textarea
              rows={2}
              className="flex-1 resize-none rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-sm text-stone-50 outline-none focus:border-rose-500"
              placeholder="Write a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="rounded-md border border-stone-600 px-2.5 py-1 text-xs text-stone-300 hover:border-stone-400"
                onClick={() => setShowAttach((v) => !v)}
              >
                Journal
              </button>
              <button
                type="button"
                disabled={sending}
                className="rounded-md border border-rose-700 bg-rose-950/40 px-2.5 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-40"
                onClick={() => void handleSend()}
              >
                Send
              </button>
            </div>
          </div>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
