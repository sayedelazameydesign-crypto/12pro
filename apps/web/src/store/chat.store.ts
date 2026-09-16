/**
 * Chat Store - Zustand
 * REST -> API Client -> Store -> React UI
 * SSE -> Event Normalizer -> Store -> React UI
 */

import { create } from 'zustand';
import type { Conversation, Message } from '@/lib/api/client';

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessage: string;
  error: string | null;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (id: string | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, data: Partial<Message>) => void;
  
  setStreaming: (isStreaming: boolean, content?: string) => void;
  appendStreaming: (chunk: string) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: {},
  isLoading: false,
  isStreaming: false,
  streamingMessage: '',
  error: null,

  setConversations: (conversations) => set({ conversations }),
  
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations]
  })),
  
  updateConversation: (id, data) => set((state) => ({
    conversations: state.conversations.map(c => c.id === id ? { ...c, ...data } : c)
  })),
  
  deleteConversation: (id) => set((state) => ({
    conversations: state.conversations.filter(c => c.id !== id),
    currentConversationId: state.currentConversationId === id ? null : state.currentConversationId
  })),

  setMessages: (conversationId, messages) => set((state) => ({
    messages: { ...state.messages, [conversationId]: messages }
  })),

  addMessage: (message) => set((state) => {
    const convMessages = state.messages[message.conversationId] || [];
    return {
      messages: {
        ...state.messages,
        [message.conversationId]: [...convMessages, message]
      }
    };
  }),

  updateMessage: (id, data) => set((state) => {
    const newMessages = { ...state.messages };
    for (const convId of Object.keys(newMessages)) {
      newMessages[convId] = newMessages[convId].map(m => m.id === id ? { ...m, ...data } : m);
    }
    return { messages: newMessages };
  }),

  setStreaming: (isStreaming, content = '') => set({ isStreaming, streamingMessage: content }),
  
  appendStreaming: (chunk) => set((state) => ({
    streamingMessage: state.streamingMessage + chunk
  })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}));
