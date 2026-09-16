'use client';
import React from 'react';
import { Brain, Search, Clock, Tag, Star } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMemoryStore } from '@/store/memory.store';

export function MemoryExplorer() {
  const { records, counts, searchQuery, setSearchQuery, selectedType, setSelectedType } = useMemoryStore();

  const types = [
    { id: 'working', label: 'Working', count: counts.working || 0, color: 'bg-blue-950 text-blue-400 border-blue-800' },
    { id: 'episodic', label: 'Episodic', count: counts.episodic || 0, color: 'bg-purple-950 text-purple-400 border-purple-800' },
    { id: 'semantic', label: 'Semantic', count: counts.semantic || 0, color: 'bg-green-950 text-green-400 border-green-800' },
    { id: 'procedural', label: 'Procedural', count: counts.procedural || 0, color: 'bg-yellow-950 text-yellow-400 border-yellow-800' },
    { id: 'meta', label: 'Meta', count: counts.meta || 0, color: 'bg-zinc-800 text-zinc-300 border-zinc-700' }
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-5 h-5" /> Memory Fabric
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search memory... (vector similarity + persistence)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-zinc-700"
            />
          </div>

          {/* Type counts */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {types.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedType(selectedType === t.id ? null : t.id)}
                className={`p-3 rounded-lg border text-left transition-colors ${selectedType === t.id ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}
              >
                <div className="text-[11px] text-zinc-500 uppercase tracking-widest">{t.label}</div>
                <div className="text-xl font-mono font-bold mt-1">{t.count.toLocaleString()}</div>
                <Badge className={`mt-2 text-[10px] border ${t.color}`}>{t.id}</Badge>
              </button>
            ))}
          </div>

          {/* Records */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {records.length === 0 ? (
              <div className="text-center py-12 text-sm text-zinc-500">
                <Brain className="w-8 h-8 mx-auto mb-3 opacity-30" />
                لا توجد ذكريات - ابدأ محادثة لإنشاء ذاكرة<br />
                <span className="text-[11px]">Memory survives restart via file persistence + vector search</span>
              </div>
            ) : (
              records.map(record => (
                <div key={record.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] border bg-zinc-900 text-zinc-400 border-zinc-800">{record.type}</Badge>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <Clock className="w-3 h-3" /> {new Date(record.timestamp).toLocaleDateString('ar-EG')}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <Star className="w-3 h-3" /> {record.confidence.toFixed(2)}
                      </span>
                    </div>
                    {record.relevance && <Badge variant="secondary" className="text-[10px]">{(record.relevance * 100).toFixed(0)}% relevance</Badge>}
                  </div>
                  <div className="mt-2 text-[13px] text-zinc-300 line-clamp-3">{record.content.slice(0, 200)}</div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {record.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 text-[10px] bg-zinc-900 border border-zinc-800 rounded-full px-2 py-0.5">
                        <Tag className="w-3 h-3" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
