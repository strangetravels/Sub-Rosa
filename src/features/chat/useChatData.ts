import { useCallback, useEffect, useState } from 'react'
import {
  listChatMessages,
  markChatMessagesRead,
  subscribeToChatMessages,
} from '@/features/chat/chatService'
import type { ChatMessage } from '@/types/models'

export type ChatBundle = {
  messages: ChatMessage[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useChatData(
  relationshipId: string | undefined,
  userId: string | undefined,
): ChatBundle {
  const [messages, setMessages] = useState<ChatMessage[]>([])
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
    if (!relationshipId || !userId || messages.length === 0) return
    const unreadIds = messages
      .filter((m) => m.senderUserId !== userId && !(m.readBy ?? {})[userId])
      .map((m) => m.id)
    if (unreadIds.length === 0) return
    void markChatMessagesRead({
      relationshipId,
      userId,
      messageIds: unreadIds,
    })
  }, [messages, relationshipId, userId])

  return { messages, loading, refresh }
}
