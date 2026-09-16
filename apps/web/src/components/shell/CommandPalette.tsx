'use client';
import React, { useEffect, useState } from 'react';
import { Search, MessageSquare, Target, Brain, Settings } from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import { useRouter } from 'next/navigation';

const commands = [
  { id: 'new-chat', label: 'محادثة جديدة', labelEn: 'New Chat', icon: MessageSquare, action: '/chat' },
  { id: 'missions', label: 'المهمات', labelEn: 'Missions', icon: Target, action: '/missions' },
  { id: 'memory', label: 'بحث في الذاكرة', labelEn: 'Search Memory', icon: Brain, action: '/memory' },
  { id: 'settings', label: 'الإعدادات', labelEn: 'Settings', icon: Settings, action: '/settings' }
];

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPalette, language } = useUIStore();
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPalette(!commandPaletteOpen);
      }
      if (e.key === 'Escape') setCommandPalette(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPalette]);

  if (!commandPaletteOpen) return null;

  const filtered = commands.filter(c => 
    c.label.includes(query) || c.labelEn.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={() => setCommandPalette(false)}>
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={language === 'ar' ? 'ابحث أو اكتب أمر...' : 'Search or type a command...'}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-500"
          />
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          {filtered.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => {
                router.push(cmd.action);
                setCommandPalette(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-sm text-left transition-colors"
            >
              <cmd.icon className="w-4 h-4 text-zinc-400" />
              <span>{language === 'ar' ? cmd.label : cmd.labelEn}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-zinc-500">
              {language === 'ar' ? 'لا نتائج' : 'No results'}
            </div>
          )}
        </div>
        <div className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-500 flex justify-between">
          <span>⌘K to toggle • ESC to close</span>
          <span>CeliaOS</span>
        </div>
      </div>
    </div>
  );
}
