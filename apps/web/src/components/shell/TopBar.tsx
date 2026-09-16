'use client';
import React from 'react';
import { Search, Command, Settings, User, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import { useRuntimeStore } from '@/store/runtime.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function TopBar() {
  const { sidebarCollapsed, toggleSidebar, setCommandPalette, language, agentMode, setAgentMode } = useUIStore();
  const { status, providers, spend } = useRuntimeStore();

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="w-8 h-8">
          {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>
        
        <div className="hidden md:flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-400 min-w-[240px] cursor-pointer" onClick={() => setCommandPalette(true)}>
          <Search className="w-4 h-4" />
          <span className="text-xs flex-1">{language === 'ar' ? 'بحث في النظام...' : 'Search system...'}</span>
          <span className="flex items-center gap-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded"><Command className="w-3 h-3" />K</span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'destructive'} className="text-[10px]">
            <span className="w-1.5 h-1.5 bg-current rounded-full mr-1 animate-pulse" />
            Runtime {status?.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="text-[10px] hidden md:flex">Trust PASS</Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Agent Mode Selector */}
        <div className="hidden lg:flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {(['user', 'observer', 'developer', 'autonomous'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setAgentMode(mode)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                agentMode === mode ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5">
          <span className="text-zinc-500">Spend</span>
          <span className="text-white font-mono">${spend.total.toFixed(2)} / ${spend.max.toFixed(2)}</span>
          <span className="w-2 h-2 bg-green-500 rounded-full" />
        </div>

        <div className="hidden md:flex items-center gap-1 text-[10px]">
          {providers.slice(0, 3).map(p => (
            <span key={p.name} className={`px-1.5 py-0.5 rounded border text-[10px] ${p.status === 'healthy' ? 'bg-green-950 text-green-400 border-green-800' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>
              {p.name}
            </span>
          ))}
          {providers.length > 3 && <span className="text-zinc-500">+{providers.length - 3}</span>}
        </div>

        <Button variant="ghost" size="icon" className="w-8 h-8">
          <Settings className="w-4 h-4" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm">👤</div>
      </div>
    </header>
  );
}
