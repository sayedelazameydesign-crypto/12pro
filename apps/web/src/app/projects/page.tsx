'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban } from 'lucide-react';
export default function ProjectsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><FolderKanban className="w-6 h-6" /> Projects</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {['12pro / CeliaOS', 'Memory Fabric', 'Intelligence Fabric'].map(name => (
          <Card key={name} className="bg-zinc-900 border-zinc-800"><CardContent className="p-4"><div className="font-medium text-sm">{name}</div><div className="text-[11px] text-zinc-500 mt-1">Real project from GitHub • missions + artifacts + memory</div><Badge variant="outline" className="mt-2 text-[10px]">Active</Badge></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
