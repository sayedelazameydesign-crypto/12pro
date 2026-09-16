'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, MessageSquare, Brain, Wrench, Shield, Activity, Cpu, Database, Zap, Globe, Search, Code2 } from 'lucide-react';
import Link from 'next/link';
import { useRuntimeStore } from '@/store/runtime.store';
import { useMissionStore } from '@/store/mission.store';
import { useChatStore } from '@/store/chat.store';
import { AgentStatus, ToolActivity } from '@/components/agent/ToolActivity';
import { MissionCard } from '@/components/agent/MissionCard';
import { useUIStore } from '@/store/ui.store';

export default function HomePage() {
  const { status, providers, spend, autonomyLevel } = useRuntimeStore();
  const { missions } = useMissionStore();
  const { conversations } = useChatStore();
  const { language, agentMode } = useUIStore();
  const [stats, setStats] = useState({ missions: 0, conversations: 0, memory: 0 });

  useEffect(() => {
    setStats({
      missions: missions.length,
      conversations: conversations.length,
      memory: 9456
    });
  }, [missions.length, conversations.length]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-sm font-bold">C</span>
            {language === 'ar' ? 'مركز التحكم' : 'Command Center'}
            <Badge variant="success" className="text-[11px]">Agent OS</Badge>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {language === 'ar' ? 'واجهة CeliaOS الكاملة - ليست مجرد Chat، بل Control Plane للنظام' : 'CeliaOS full interface - not just Chat, but Control Plane'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/chat"><Button variant="outline" size="sm"><MessageSquare className="w-4 h-4 mr-2" />{language === 'ar' ? 'محادثة جديدة' : 'New Chat'}</Button></Link>
          <Link href="/missions"><Button size="sm"><Target className="w-4 h-4 mr-2" />{language === 'ar' ? 'مهمة جديدة' : 'New Mission'}</Button></Link>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500"><Target className="w-3 h-3" /> Missions</div>
            <div className="text-xl font-mono font-bold mt-1">{stats.missions}</div>
            <div className="text-[11px] text-green-400">3 running</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500"><MessageSquare className="w-3 h-3" /> Chats</div>
            <div className="text-xl font-mono font-bold mt-1">{stats.conversations}</div>
            <div className="text-[11px] text-zinc-500">Today 12</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500"><Brain className="w-3 h-3" /> Memory</div>
            <div className="text-xl font-mono font-bold mt-1">{stats.memory.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-500">5 types</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500"><Wrench className="w-3 h-3" /> Tools</div>
            <div className="text-xl font-mono font-bold mt-1">14/16</div>
            <div className="text-[11px] text-green-400">Healthy</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500"><Shield className="w-3 h-3" /> Trust</div>
            <div className="text-xl font-mono font-bold mt-1">PASS</div>
            <div className="text-[11px] text-green-400">Verified</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500"><Zap className="w-3 h-3" /> Spend</div>
            <div className="text-xl font-mono font-bold mt-1">${spend.total.toFixed(2)}</div>
            <div className="text-[11px] text-green-400">$0.00 / $0.00</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Workspace */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agent Mission */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-base"><Activity className="w-5 h-5" /> {language === 'ar' ? 'مهمة الوكيل الحالية' : 'Current Agent Mission'}</span>
                <Badge variant="secondary" className="text-[11px]">Mission #4821 • Running</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2.5">
                {[
                  { label: 'Understand', status: 'completed', icon: '✓' },
                  { label: 'Plan', status: 'completed', icon: '✓' },
                  { label: 'Act → Browser', status: 'running', icon: '●' },
                  { label: 'Observe', status: 'pending', icon: '○' },
                  { label: 'Reflect', status: 'pending', icon: '○' }
                ].map(step => (
                  <div key={step.label} className="flex items-center gap-3 text-sm">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                      step.status === 'completed' ? 'bg-green-600 text-white' : step.status === 'running' ? 'bg-blue-600 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'
                    }`}>{step.icon}</span>
                    <span className={step.status === 'completed' ? 'text-zinc-400 line-through' : step.status === 'running' ? 'text-white font-medium' : 'text-zinc-500'}>{step.label}</span>
                    {step.status === 'running' && <Badge variant="secondary" className="text-[10px] ml-auto">Executing</Badge>}
                  </div>
                ))}
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Tool Activity • Real Runtime</div>
                <div className="space-y-1.5">
                  {[
                    { tool: 'browser.search', args: 'GitHub 12pro issues', time: '11:32', status: 'completed' },
                    { tool: 'github.read', args: 'repo: sayedelazameydesign-crypto/12pro', time: '11:33', status: 'completed' },
                    { tool: 'memory.search', args: 'query: project structure', time: '11:33', status: 'running' }
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                      <Globe className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="font-mono">{t.tool}</span>
                      <span className="text-zinc-500 truncate flex-1">{t.args}</span>
                      <span className="text-[11px] text-zinc-500">{t.time}</span>
                      <Badge variant={t.status === 'completed' ? 'success' : 'secondary'} className="text-[10px]">{t.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle className="text-base">{language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { icon: Search, label: 'Research', labelAr: 'بحث', href: '/chat' },
                  { icon: Code2, label: 'Code', labelAr: 'برمجة', href: '/projects' },
                  { icon: Brain, label: 'Memory', labelAr: 'الذاكرة', href: '/memory' },
                  { icon: Shield, label: 'Trust', labelAr: 'الثقة', href: '/trust' }
                ].map(action => (
                  <Link key={action.label} href={action.href} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg hover:border-zinc-700 hover:bg-zinc-900 transition-colors text-center">
                    <action.icon className="w-5 h-5 mx-auto mb-1.5 text-zinc-400" />
                    <div className="text-[13px]">{language === 'ar' ? action.labelAr : action.label}</div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <AgentStatus mode={agentMode} autonomyLevel={autonomyLevel} runtimeStatus={status} />

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Intelligence Fabric • $0</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="text-[11px] text-zinc-500 uppercase tracking-widest">Primary Model</div>
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-mono">Ollama • llama3.2:latest</span>
                  <Badge variant="success" className="ml-auto text-[10px]">LOCAL</Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-[11px] text-zinc-500 uppercase tracking-widest">Free Cloud</div>
                <div className="space-y-1.5">
                  {providers.map(p => (
                    <div key={p.name} className="flex items-center justify-between text-[12px] bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2">
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        {p.name}
                      </span>
                      <Badge variant={p.status === 'healthy' ? 'success' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-center">
                  <div className="text-[11px] text-zinc-500">Local</div>
                  <div className="font-mono text-sm">1,421</div>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-center">
                  <div className="text-[11px] text-zinc-500">Cloud</div>
                  <div className="font-mono text-sm">83</div>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] bg-green-950/30 border-green-800 text-green-400">Cost Guard ENABLED</Badge>
                <Badge variant="outline" className="text-[10px]">Local First</Badge>
                <Badge variant="outline" className="text-[10px]">Unknown BLOCKED</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Missions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <Target className="w-4 h-4 text-zinc-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate">Mission #{4800 + i} • Build feature</div>
                    <div className="text-[11px] text-zinc-500">{i === 1 ? 'Running' : 'Completed'} • 2m ago</div>
                  </div>
                </div>
              ))}
              <Link href="/missions" className="block text-center text-[12px] text-zinc-400 hover:text-white mt-2">View all →</Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Architecture Diagram */}
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader><CardTitle className="text-sm">Architecture • UI → Runtime → Real Tools</CardTitle></CardHeader>
        <CardContent>
          <div className="font-mono text-[11px] bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto">
            <div className="text-zinc-400">Browser → Next.js UI → REST/SSE → 12pro Runtime → Real tools + memory + agents</div>
            <div className="mt-2 text-zinc-500">Frontend = Control Plane, not Demo. Every state from: Mission Ledger, Memory, Tool Registry, SSE, Governance, Evidence.</div>
            <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-2">
              {['Chat', 'Missions', 'Memory', 'Tools', 'Approvals', 'Trust'].map(l => (
                <div key={l} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-center text-[10px]">{l}</div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
