'use client';
import React, { useState, useRef } from 'react';
import { Send, Paperclip, Mic, Image as ImageIcon, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui.store';

interface ComposerProps {
  onSend: (content: string, attachments?: any[]) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function Composer({ onSend, isLoading, placeholder }: ComposerProps) {
  const [content, setContent] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { language } = useUIStore();

  const handleSend = () => {
    if (!content.trim() || isLoading) return;
    onSend(content);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-3">
      <div className="max-w-4xl mx-auto">
        <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700 transition-all">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => {
              setContent(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={placeholder || (language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...')}
            className="w-full bg-transparent outline-none resize-none min-h-[48px] max-h-[160px] px-4 py-3 pr-28 text-sm placeholder:text-zinc-500"
            rows={1}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
          
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-7 h-7 text-zinc-500 hover:text-zinc-300">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-zinc-500 hover:text-zinc-300">
              <ImageIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-zinc-500 hover:text-zinc-300">
              <Code className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-zinc-500 hover:text-zinc-300">
              <Mic className="w-4 h-4" />
            </Button>
            <Button onClick={handleSend} disabled={!content.trim() || isLoading} size="icon" className="w-7 h-7 bg-white text-black hover:bg-zinc-200 disabled:opacity-30">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[11px] text-zinc-500">
            {language === 'ar' ? 'الواجهة تتصل مباشرة بالـRuntime • $0 • Local-First' : 'Frontend → Runtime direct • $0 • Local-First'}
          </span>
          <span className="text-[10px] text-zinc-600">Enter to send • Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
}
