import { useCallback, useEffect, useState } from 'react'
import {
  listChatMessages,
  markChatMessagesRead,
  subscribeToChatMessages,
  subscribeToChatTyping,
} from '@/features/chat/chatService'
import type { ChatMessage, ChatTypingPresence } from '@/types/models'

export type ChatBundle = {
  messages: ChatMessage[]
  typers: ChatTypingPresence[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useChatData(
  relationshipId: string | undefined,
  userId: string | undefined,
  options?: { markRead?: boolean },
): ChatBundle {
  const markRead = options?.markRead ?? false
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typers, setTypers] = useState<ChatTypingPresence[]>([])
  const [loading, setLoading] = useState(Boolean(relationshipId))

  const refresh = useCallback(async () => {
    if (!relationshipId) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const next = await listChatMessages(relationshipId)
      setMessages(next)
    } finally {
      setLoading(false)
    }
  }, [relationshipId])

  useEffect(() => {
    if (!relationshipId) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeToChatMessages(relationshipId, (next) => {
      setMessages(next)
      setLoading(false)
    })
  }, [relationshipId])

  useEffect(() => {
    if (!relationshipId) {
      setTypers([])
      return
    }
    return subscribeToChatTyping(relationshipId, userId, setTypers)
  }, [relationshipId, userId])

  useEffect(() => {
    if (!markRead || !relationshipId || !userId || messages.length === 0) return
    const unreadIds = messages
      .filter((m) => m.senderUserId !== userId && !(m.readBy ?? {})[userId])
      .map((m) => m.id)
    if (unreadIds.length === 0) return
    void markChatMessagesRead({
      relationshipId,
      userId,
      messageIds: unreadIds,
    })
  }, [messages, relationshipId, userId, markRead])

  return { messages, typers, loading, refresh }
}
