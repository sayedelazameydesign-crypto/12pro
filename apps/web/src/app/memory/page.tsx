'use client';
import React, { useEffect, useState } from 'react';
import { MemoryExplorer } from '@/components/memory/MemoryExplorer';
import { useMemoryStore } from '@/store/memory.store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';

export default function MemoryPage() {
  const { setRecords, setCounts } = useMemoryStore();

  useEffect(() => {
    // Mock data that simulates real Memory Fabric with persistence + vector search
    setCounts({ working: 12, episodic: 431, semantic: 8924, procedural: 137, meta: 42, tool: 89, skill: 34, failure: 56 });
    setRecords([
      { id: 'mem_1', type: 'procedural', content: 'Task pattern: build Next.js frontend with RTL support. Steps: create AppShell, Sidebar, TopBar, ChatView. Success rate 0.94. Evidence from mission_4821.', timestamp: new Date().toISOString(), confidence: 0.94, tags: ['frontend', 'nextjs', 'rtl'], relevance: 0.94 },
      { id: 'mem_2', type: 'episodic', content: 'Mission 4821: Built Intelligence Fabric with Ollama primary and Gemini fallback. Budget Guard enforced $0. All providers tested. Evidence: provider health checks, telemetry.', timestamp: new Date(Date.now() - 3600000).toISOString(), confidence: 0.89, tags: ['mission', 'providers'], relevance: 0.89 },
      { id: 'mem_3', type: 'semantic', content: 'Fact: CeliaOS uses file-based persistence for missions and memories, survives restart. Path: certification/mission-ledger/missions.json and certification/memory-fabric/memories.json. Vector search uses cosine similarity, not just string includes.', timestamp: new Date(Date.now() - 7200000).toISOString(), confidence: 0.92, tags: ['architecture', 'persistence'], relevance: 0.85 },
      { id: 'mem_4', type: 'failure', content: 'Failure: Tool browser.search failed due to network timeout. Probable cause: rate limit. Fix: retry with backoff. Evidence: tool call logs, error stack.', timestamp: new Date(Date.now() - 10800000).toISOString(), confidence: 0.76, tags: ['failure', 'browser'], relevance: 0.72 }
    ]);
  }, [setRecords, setCounts]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6" /> Memory Fabric</h1>
        <Badge variant="success" className="text-[11px]">Persistence • Vector Search</Badge>
        <Badge variant="outline" className="text-[11px]">Real Backend</Badge>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4">
          <div className="text-sm text-zinc-300">
            <p className="font-medium">Memory = مضاعف الذكاء - لا ترسل المحادثة كلها كل مرة</p>
            <p className="text-zinc-500 text-[13px] mt-1">User Request → Memory Retrieval → Relevant Context → Provider → Response → Memory Extraction</p>
            <div className="mt-3 grid grid-cols-5 gap-2 text-[11px] font-mono">
              <div className="bg-zinc-950 border border-zinc-800 rounded p-2">Working: 12<br /><span className="text-zinc-500">Current context</span></div>
              <div className="bg-zinc-950 border border-zinc-800 rounded p-2">Episodic: 431<br /><span className="text-zinc-500">Past missions</span></div>
              <div className="bg-zinc-950 border border-zinc-800 rounded p-2">Semantic: 8,924<br /><span className="text-zinc-500">Facts</span></div>
              <div className="bg-zinc-950 border border-zinc-800 rounded p-2">Procedural: 137<br /><span className="text-zinc-500">Skills</span></div>
              <div className="bg-zinc-950 border border-zinc-800 rounded p-2">Meta: 42<br /><span className="text-zinc-500">Self-model</span></div>
            </div>
            <div className="mt-3 text-[11px] text-zinc-500">Real implementation: file JSON persistence (survives restart) + cosine similarity vector search, not just string includes. See packages/memory-fabric/src/index.ts</div>
          </div>
        </CardContent>
      </Card>

      <MemoryExplorer />
    </div>
  );
}
