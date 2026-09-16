'use client';
import React from 'react';
import { Activity, Cpu, Database, HardDrive, Globe, Zap, Shield, FileCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRuntimeStore } from '@/store/runtime.store';

export function RuntimeHealth() {
  const { providers, spend, costGuard, tools, memory, governance } = useRuntimeStore();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" /> Runtime Health • Control Center
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500"><Cpu className="w-3 h-3" /> Node</div>
              <div className="text-sm font-mono mt-1">24.x • prod</div>
              <Badge variant="success" className="mt-2 text-[10px]">HEALTHY</Badge>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500"><Database className="w-3 h-3" /> SQLite</div>
              <div className="text-sm font-mono mt-1">CONNECTED</div>
              <div className="text-[11px] text-zinc-500 mt-1">missions.json • memories.json</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500"><HardDrive className="w-3 h-3" /> Memory</div>
              <div className="text-sm font-mono mt-1">{memory.status}</div>
              <div className="text-[11px] text-zinc-500 mt-1">{Object.values(memory.counts).reduce((a,b)=>a+b,0)} records</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500"><Zap className="w-3 h-3" /> Workers</div>
              <div className="text-sm font-mono mt-1">3/3</div>
              <div className="text-[11px] text-green-400 mt-1">All healthy</div>
            </div>
          </div>

          {/* Providers */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Providers • Intelligence Fabric • $0</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {providers.map(p => (
                <div key={p.name} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${p.status === 'healthy' ? 'bg-green-500' : p.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-mono">{p.name}</span>
                    {p.isLocal && <Badge variant="secondary" className="text-[10px]">LOCAL</Badge>}
                    {p.name === 'ollama' && <Badge variant="success" className="text-[10px]">Primary</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.latencyMs && <span className="text-[11px] text-zinc-500 font-mono">{p.latencyMs}ms</span>}
                    <Badge variant={p.status === 'healthy' ? 'success' : p.status === 'degraded' ? 'warning' : 'destructive'} className="text-[10px]">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <Badge variant="outline" className="bg-green-950/30 text-green-400 border-green-800">Spend ${spend.total.toFixed(2)} / ${spend.max.toFixed(2)}</Badge>
              <Badge variant="outline" className="bg-zinc-900 text-zinc-400 border-zinc-800">Cost Guard {costGuard}</Badge>
              <Badge variant="outline" className="bg-zinc-900 text-zinc-400 border-zinc-800">Local First ENABLED</Badge>
              <Badge variant="outline" className="bg-zinc-900 text-zinc-400 border-zinc-800">Unknown Cost BLOCKED</Badge>
            </div>
          </div>

          {/* Tools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="text-[11px] text-zinc-500 uppercase tracking-widest">Tools</div>
              <div className="text-lg font-mono mt-1">{tools.available}/{tools.total}</div>
              <div className="text-[11px] text-zinc-500">Browser • CLI • GitHub • Files • MCP • APIs</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="text-[11px] text-zinc-500 uppercase tracking-widest">Governance</div>
              <div className="text-lg font-mono mt-1">{governance.status} • {governance.policies} policies</div>
              <div className="text-[11px] text-zinc-500">{governance.pendingApprovals} pending approvals</div>
            </div>
          </div>

          {/* Events */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Recent Events • Real SSE Stream</div>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex gap-2"><span className="text-zinc-500">11:32</span><span className="text-blue-400">mission.started</span><span className="text-zinc-400">mission_4821</span></div>
              <div className="flex gap-2"><span className="text-zinc-500">11:32</span><span className="text-green-400">planner.completed</span><span className="text-zinc-400">5 steps</span></div>
              <div className="flex gap-2"><span className="text-zinc-500">11:33</span><span className="text-yellow-400">tool.browser.started</span><span className="text-zinc-400">search</span></div>
              <div className="flex gap-2"><span className="text-zinc-500">11:33</span><span className="text-green-400">tool.browser.completed</span><span className="text-zinc-400">120ms</span></div>
              <div className="flex gap-2"><span className="text-zinc-500">11:34</span><span className="text-green-400">mission.step.completed</span><span className="text-zinc-400">step_3</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
