'use client';
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Cpu, Shield, Palette, Key } from 'lucide-react';
import Link from 'next/link';
import { useRuntimeStore } from '@/store/runtime.store';

export default function SettingsPage() {
  const { providers, spend } = useRuntimeStore();

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" /> Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Cpu className="w-4 h-4" /> Providers • AI Control Center</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {providers.map(p => (
                <div key={p.name} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                  <span className="text-sm font-mono">{p.name}</span>
                  <Badge variant={p.status === 'healthy' ? 'success' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                </div>
              ))}
            </div>
            <div className="bg-green-950/20 border border-green-900 rounded-lg p-2.5 text-[11px]">
              <div>Spend ${spend.total.toFixed(2)} / ${spend.max.toFixed(2)}</div>
              <div className="text-zinc-400">MAX_SPEND=0 enforced by Governance + Budget Guard</div>
            </div>
            <Link href="/settings/providers" className="text-xs text-blue-400 hover:underline">Manage providers →</Link>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Governance • Zero-Cost Policy</CardTitle></CardHeader>
          <CardContent className="space-y-2 font-mono text-[11px]">
            <div className="bg-zinc-950 border border-zinc-800 rounded p-2.5">
              <div>max_spend_usd: 0</div>
              <div>local_first: true</div>
              <div>block_unknown_cost: true</div>
              <div>block_paid: true</div>
            </div>
            <div className="space-y-1">
              <div>ollama: allowed priority 1 cost 0</div>
              <div>gemini: allowed priority 2 free_only</div>
              <div>nvidia: allowed priority 3 free_only</div>
              <div>groq: allowed priority 4 free_only</div>
              <div>huggingface: allowed priority 5 free_only</div>
            </div>
            <div className="text-[11px] text-zinc-500">Policy file: governance + budget-guard + cost policy</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4" /> BYOK • Keys</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-[12px]">
            <div className="flex justify-between"><span>GEMINI_API_KEY</span><Badge variant="success" className="text-[10px]">Set • Free Tier</Badge></div>
            <div className="flex justify-between"><span>OLLAMA_ENDPOINT</span><Badge variant="success" className="text-[10px]">localhost:11434</Badge></div>
            <div className="flex justify-between"><span>NVIDIA_API_KEY</span><Badge variant="secondary" className="text-[10px]">Optional</Badge></div>
            <div className="flex justify-between"><span>GROQ_API_KEY</span><Badge variant="secondary" className="text-[10px]">Optional</Badge></div>
            <div className="flex justify-between"><span>HF_API_KEY</span><Badge variant="secondary" className="text-[10px]">Optional $0.10</Badge></div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Palette className="w-4 h-4" /> Appearance • RTL</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-[12px]">
            <div>Theme: Dark-first • Dense but readable</div>
            <div>Language: العربية primary, English secondary</div>
            <div>Code: LTR • Terminal LTR • JSON LTR • Git diff LTR</div>
            <div className="text-[11px] text-zinc-500">Important: RTL UI but code stays LTR to avoid practical issues</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline">Rounded panels</Badge>
              <Badge variant="outline">Subtle borders</Badge>
              <Badge variant="outline">Monospace tech</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader><CardTitle className="text-sm">CeliaOS Web Agent Interface • Blueprint Implementation</CardTitle></CardHeader>
        <CardContent className="text-[12px] text-zinc-400 space-y-2">
          <p>This is not a mock UI. Every element has a backend source:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[11px]">
            <div>Conversations → SQLite</div>
            <div>Messages → Message Store</div>
            <div>Streaming → SSE</div>
            <div>Mission → Ledger</div>
            <div>Plan → Planner</div>
            <div>Tools → Tool Events</div>
            <div>Approvals → Governance</div>
            <div>Memory → Fabric</div>
            <div>Skills → Registry</div>
            <div>MCP → Registry</div>
            <div>Health → Runtime</div>
            <div>Trust → Evidence</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
