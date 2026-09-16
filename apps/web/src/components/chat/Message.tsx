'use client';
import React from 'react';
import { User, Bot, Wrench, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MessageProps {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  attachments?: any[];
  toolCalls?: any[];
}

export function Message({ role, content, timestamp, attachments, toolCalls }: MessageProps) {
  const isUser = role === 'user';
  const isTool = role === 'tool';

  return (
    <div className={`flex gap-3 px-4 py-4 ${isUser ? 'bg-zinc-900/50' : 'bg-transparent'} ${isTool ? 'bg-blue-950/20 border-l-2 border-blue-800' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? 'bg-white text-black' : isTool ? 'bg-blue-900 text-blue-200' : 'bg-zinc-800 text-zinc-300'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : isTool ? <Wrench className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{isUser ? 'أنت' : isTool ? 'Tool' : 'CeliaOS'}</span>
          <span className="text-[11px] text-zinc-500">{new Date(timestamp).toLocaleTimeString('ar-EG')}</span>
          {isTool && <Badge variant="outline" className="text-[10px]">Tool Activity</Badge>}
        </div>
        
        <div className="prose prose-invert prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-100 break-words" dir="auto">
            {content}
          </div>
        </div>

        {toolCalls && toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {toolCalls.map((tc, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="w-3 h-3 text-zinc-500" />
                  <span className="font-mono font-medium">{tc.tool}</span>
                  <Badge variant="secondary" className="text-[10px]">{tc.durationMs || 120}ms</Badge>
                </div>
                <pre className="text-[11px] text-zinc-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(tc.args, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}

        {attachments && attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {attachments.map((att, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                <span>{att.name}</span>
                <span className="text-zinc-500">{att.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3 px-4 py-4">
      <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">CeliaOS</span>
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            يكتب...
          </span>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-100 break-words" dir="auto">
          {content}
          <span className="inline-block w-2 h-4 bg-zinc-400 ml-1 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
