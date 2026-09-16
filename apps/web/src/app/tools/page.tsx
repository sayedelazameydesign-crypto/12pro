'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench } from 'lucide-react';
export default function ToolsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="w-6 h-6" /> Tools • 14/16</h1>
      <div className="grid md:grid-cols-3 gap-3">
        {['browser', 'cli', 'powershell', 'linux', 'git', 'mcp', 'github', 'filesystem', 'memory', 'search', 'api', 'evidence', 'governance', 'providers'].map(tool => (
          <Card key={tool} className="bg-zinc-900 border-zinc-800"><CardContent className="p-3"><div className="font-mono text-sm">{tool}</div><Badge variant="success" className="mt-1 text-[10px]">available</Badge></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
