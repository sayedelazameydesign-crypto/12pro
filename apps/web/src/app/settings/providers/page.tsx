'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRuntimeStore } from '@/store/runtime.store';

export default function ProvidersSettings() {
  const { providers } = useRuntimeStore();
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Providers • Intelligence Fabric</h1>
      <div className="grid gap-3">
        {providers.map(p => (
          <Card key={p.name} className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2">{p.name} {p.isLocal && <Badge variant="secondary">LOCAL</Badge>} <Badge variant={p.status==='healthy'?'success':'secondary'}>{p.status}</Badge></CardTitle></CardHeader>
            <CardContent className="text-xs font-mono">Models: {p.models.join(', ')}<br/>Latency: {p.latencyMs||'—'}ms<br/>Cost: $0 • Free tier</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
