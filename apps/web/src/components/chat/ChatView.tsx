'use client';
import React, { useEffect, useRef } from 'react';
import { Message, StreamingMessage } from './Message';
import { Composer } from './Composer';
import { useChatStore } from '@/store/chat.store';
import { Badge } from '@/components/ui/badge';

interface ChatViewProps {
  conversationId: string;
  onSendMessage: (content: string) => void;
}

export function ChatView({ conversationId, onSendMessage }: ChatViewProps) {
  const { messages, isStreaming, streamingMessage, isLoading } = useChatStore();
  const conversationMessages = messages[conversationId] || [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationMessages, streamingMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {conversationMessages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg mb-4">C</div>
            <h2 className="text-lg font-semibold mb-2">مرحباً في CeliaOS</h2>
            <p className="text-sm text-zinc-400 max-w-md mb-6">
              واجهة Agent OS كاملة - ليست مجرد Chat. المحادثة، المهمات، الذاكرة، الأدوات، الحوكمة، كلها متصلة مباشرة بالـRuntime.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {[
                'ابحث عن أفضل طريقة لتنظيم المشروع',
                'أنشئ مهمة لبناء Skill جديدة',
                'اعرض حالة الـRuntime والـProviders',
                'ما هي الذاكرة المتعلقة بالمشروع؟'
              ].map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(prompt)}
                  className="text-left p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <Badge variant="success" className="text-[10px]">Local-First</Badge>
              <Badge variant="outline" className="text-[10px]">$0 Cost Guard</Badge>
              <Badge variant="secondary" className="text-[10px]">Ollama Primary</Badge>
              <Badge variant="secondary" className="text-[10px]">Gemini Fallback</Badge>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {conversationMessages.map(msg => (
              <Message key={msg.id} role={msg.role} content={msg.content} timestamp={msg.timestamp} toolCalls={msg.toolCalls} attachments={msg.attachments} />
            ))}
            {isStreaming && <StreamingMessage content={streamingMessage} />}
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer onSend={onSendMessage} isLoading={isLoading || isStreaming} />
    </div>
  );
}
