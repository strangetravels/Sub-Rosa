import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  clearChatTyping,
  DECRYPT_FAILED_TEXT,
  deleteChatMessage,
  LOCKED_TEXT,
  sendChatMessage,
  setChatTyping,
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
  const { messages, typers, loading } = useChatData(relationshipId, user?.id, { markRead: true })
  const { entries: journalEntries } = useJournalData(relationshipId, user?.id)

  const [draft, setDraft] = useState('')
  const [attachId, setAttachId] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<number | null>(null)

  const alone = (activeRelationship?.members.length ?? 0) < 2

  const sharedJournal = useMemo(
    () => journalEntries.filter((e) => e.visibility === 'shared').slice(0, 20),
    [journalEntries],
  )

  const selectedJournal = sharedJournal.find((e) => e.id === attachId)

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return messages
    return messages.filter((m) => {
      if (m.body.toLowerCase().includes(q)) return true
      if (m.journalEntryTitle?.toLowerCase().includes(q)) return true
      return false
    })
  }, [messages, searchQuery])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredMessages.length, typers.length])

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current)
      if (relationshipId && user) {
        void clearChatTyping({ relationshipId, userId: user.id })
      }
    }
  }, [relationshipId, user])

  function bumpTyping(nextDraft: string) {
    if (!activeRelationship || !user) return
    if (!nextDraft.trim()) {
      void clearChatTyping({ relationshipId: activeRelationship.id, userId: user.id })
      return
    }
    void setChatTyping({
      relationshipId: activeRelationship.id,
      userId: user.id,
      displayName: user.displayName,
    })
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => {
      void clearChatTyping({ relationshipId: activeRelationship.id, userId: user.id })
    }, 2500)
  }

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
      await clearChatTyping({ relationshipId: activeRelationship!.id, userId: user!.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.')
    } finally {
      setSending(false)
    }
  }

  const typingLabel =
    typers.length === 0
      ? null
      : typers.length === 1
        ? `${typers[0].displayName} is typing…`
        : `${typers.map((t) => t.displayName).join(', ')} are typing…`

  return (
    <section className="mx-auto flex max-w-3xl flex-col" style={{ minHeight: '70vh' }}>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-50">Chat</h2>
        <p className="mt-2 text-stone-400">
          Encrypted messaging for {activeRelationship.name}. Attach a shared journal entry when
          useful.
        </p>
        {alone ? (
          <p className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
            You&apos;re the only member so far. Share invite code{' '}
            <code className="rounded bg-stone-800 px-1.5 py-0.5 tracking-widest text-rose-300">
              {activeRelationship.inviteCode}
            </code>{' '}
            so your partner can join the conversation.
          </p>
        ) : null}
      </div>

      <div className="mb-3">
        <label className="block text-xs text-stone-500">
          Search messages
          <input
            className="mt-1 w-full rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-sm text-stone-50 outline-none placeholder:text-stone-600 focus:border-rose-500"
            placeholder="Filter by text or journal title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-1 flex-col rounded-lg border border-stone-700 bg-stone-900/50">
        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '55vh' }}>
          {loading ? (
            <p className="text-sm text-stone-500">Loading…</p>
          ) : messages.length === 0 ? (
            <div className="space-y-2 text-sm text-stone-500">
              <p>No messages yet.</p>
              {alone ? (
                <p>Invite your partner, then say hello once they join.</p>
              ) : (
                <p>Say hello to start the thread.</p>
              )}
            </div>
          ) : filteredMessages.length === 0 ? (
            <p className="text-sm text-stone-500">No messages match your search.</p>
          ) : (
            filteredMessages.map((msg) => {
              const mine = msg.senderUserId === user.id
              const sender = activeRelationship.members.find((m) => m.userId === msg.senderUserId)
              const locked = Boolean(msg.bodyCiphertext) || isLockedText(msg.body)
              const showLocked =
                locked && (isLockedText(msg.body) || !msg.body.trim())
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
                      {mine ? 'You' : (sender?.displayName ?? 'Unknown')} ·{' '}
                      {formatTime(msg.createdAt)}
                      {mine && readByPartner ? ' · Read' : ''}
                    </p>
                    {msg.journalEntryId ? (
                      <div className="mt-1 rounded border border-stone-700 bg-stone-900/60 px-2 py-1.5">
                        <p className="text-[11px] uppercase tracking-wide text-stone-500">
                          Journal
                        </p>
                        <p className="text-stone-200">
                          {msg.journalEntryTitle ?? 'Attached entry'}
                        </p>
                        <NavLink
                          to="/journal"
                          className="text-[11px] text-rose-400 hover:text-rose-300"
                        >
                          Open journal
                        </NavLink>
                      </div>
                    ) : null}
                    {showLocked ? (
                      <div className="mt-1">
                        <p className="text-stone-400">
                          {isLockedText(msg.body) ? msg.body : LOCKED_TEXT}
                        </p>
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
          {typingLabel ? (
            <p className="text-xs italic text-stone-500">{typingLabel}</p>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="space-y-2 border-t border-stone-700 p-3">
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
              placeholder={alone ? 'Draft a message for when they join…' : 'Write a message…'}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                bumpTyping(e.target.value)
              }}
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
