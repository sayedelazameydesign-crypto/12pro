'use client';
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Plus, Clock, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { useMissionStore } from '@/store/mission.store';
import { useUIStore } from '@/store/ui.store';

export default function MissionsPage() {
  const { missions } = useMissionStore();
  const { language } = useUIStore();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = missions.filter(m => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (search && !m.goal.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Mock missions if none
  const displayMissions = filtered.length > 0 ? filtered : [
    { id: 'mission_4821', goal: 'بناء واجهة CeliaOS الكاملة بمستوى Claude/Manus', status: 'running', steps: [{ id: '1', task: 'فهم المتطلبات', status: 'completed' }, { id: '2', task: 'تصميم البنية', status: 'completed' }, { id: '3', task: 'بناء Intelligence Fabric', status: 'running' }], toolCalls: [], decisions: [], artifacts: [], errors: [], approvals: [], cost: { tokens: 3421, spend: 0, durationMs: 123000 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'mission_4820', goal: 'إضافة Budget Guard و Provider Router', status: 'completed', steps: [{ id: '1', task: 'Ollama provider', status: 'completed' }, { id: '2', task: 'Gemini fallback', status: 'completed' }], toolCalls: [], decisions: [], artifacts: [], errors: [], approvals: [], cost: { tokens: 1234, spend: 0, durationMs: 45000 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ] as any;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6" /> {language === 'ar' ? 'المهمات' : 'Missions'}
          <Badge variant="secondary">{displayMissions.length}</Badge>
        </h1>
        <Button><Plus className="w-4 h-4 mr-2" />{language === 'ar' ? 'مهمة جديدة' : 'New Mission'}</Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={language === 'ar' ? 'بحث في المهمات...' : 'Search missions...'} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-zinc-700" />
        </div>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {['all', 'running', 'completed', 'failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-md text-xs capitalize ${filter === f ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {displayMissions.map((mission: any) => (
          <Link key={mission.id} href={`/missions/${mission.id}`}>
            <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{mission.goal}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={mission.status === 'completed' ? 'success' : mission.status === 'running' ? 'secondary' : 'outline'} className="text-[10px]">{mission.status}</Badge>
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(mission.createdAt).toLocaleDateString('ar-EG')}</span>
                      <span className="text-[11px] text-zinc-500 font-mono">{mission.id}</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex gap-1">
                        {mission.steps.map((s: any, idx: number) => (
                          <div key={s.id} className={`h-1.5 flex-1 rounded-full ${s.status === 'completed' ? 'bg-green-600' : s.status === 'running' ? 'bg-blue-600 animate-pulse' : 'bg-zinc-800'}`} />
                        ))}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">{mission.steps.filter((s: any) => s.status === 'completed').length}/{mission.steps.length} steps • {mission.cost.tokens} tokens • ${mission.cost.spend}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
