'use client';
import React from 'react';
import { Wrench, Globe, Terminal, FileCode, Github, Search, Brain, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ToolCall {
  tool: string;
  args: any;
  result: any;
  timestamp: string;
  durationMs: number;
}

export function ToolActivity({ toolCalls }: { toolCalls: ToolCall[] }) {
  const getIcon = (tool: string) => {
    if (tool.includes('browser')) return Globe;
    if (tool.includes('cli') || tool.includes('bash') || tool.includes('powershell')) return Terminal;
    if (tool.includes('file') || tool.includes('read') || tool.includes('write')) return FileCode;
    if (tool.includes('github') || tool.includes('git')) return Github;
    if (tool.includes('search')) return Search;
    if (tool.includes('memory')) return Brain;
    if (tool.includes('governance') || tool.includes('approval')) return Shield;
    return Wrench;
  };

  if (!toolCalls || toolCalls.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-zinc-500">
        <Wrench className="w-6 h-6 mx-auto mb-2 opacity-50" />
        لا يوجد نشاط أدوات بعد
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
        <Wrench className="w-3 h-3" />
        Tool Activity • {toolCalls.length} calls
      </div>
      
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {toolCalls.slice(-20).reverse().map((call, idx) => {
          const Icon = getIcon(call.tool);
          return (
            <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
              <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono font-medium">{call.tool}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{call.durationMs}ms</Badge>
                  <span className="text-[10px] text-zinc-500">{new Date(call.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1 truncate font-mono">
                  {typeof call.args === 'string' ? call.args : JSON.stringify(call.args).slice(0, 120)}
                </div>
                {call.result && (
                  <div className="text-[11px] text-zinc-400 mt-1 bg-zinc-950 rounded px-2 py-1 border border-zinc-900 truncate">
                    → {typeof call.result === 'string' ? call.result.slice(0, 100) : JSON.stringify(call.result).slice(0, 100)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5 flex-wrap pt-1">
        {['Browser', 'CLI', 'GitHub', 'Files', 'MCP', 'APIs'].map(t => (
          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
        ))}
      </div>
    </div>
  );
}

export function AgentStatus({ mode, autonomyLevel, runtimeStatus }: { mode: string; autonomyLevel: number; runtimeStatus: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Agent Status</span>
        <Badge variant={runtimeStatus === 'healthy' ? 'success' : 'warning'} className="text-[10px]">{runtimeStatus}</Badge>
      </div>
      
      <div className="space-y-2.5">
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-500">AUTONOMY</span>
            <span className="font-mono">{autonomyLevel}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${autonomyLevel}%` }} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2">
            <div className="text-zinc-500">Mode</div>
            <div className="font-medium capitalize">{mode}</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2">
            <div className="text-zinc-500">Runtime</div>
            <div className="font-medium text-green-400">HEALTHY</div>
          </div>
        </div>
      </div>
    </div>
  );
}
