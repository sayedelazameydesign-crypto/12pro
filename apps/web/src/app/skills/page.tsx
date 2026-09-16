'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';
export default function SkillsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6" /> Skills</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { name: 'browser.search', desc: 'Search web', success: 0.92, usage: 142 },
          { name: 'filesystem.write', desc: 'Write files', success: 0.95, usage: 89 },
          { name: 'memory.search', desc: 'Vector memory search', success: 0.88, usage: 203 }
        ].map(skill => (
          <Card key={skill.name} className="bg-zinc-900 border-zinc-800"><CardContent className="p-4"><div className="font-mono text-sm">{skill.name}</div><div className="text-[12px] text-zinc-400">{skill.desc}</div><div className="flex gap-2 mt-2"><Badge variant="success" className="text-[10px]">{(skill.success*100).toFixed(0)}% success</Badge><Badge variant="secondary" className="text-[10px]">{skill.usage} uses</Badge></div></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
