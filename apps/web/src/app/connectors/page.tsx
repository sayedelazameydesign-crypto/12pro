'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plug } from 'lucide-react';
export default function ConnectorsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="w-6 h-6" /> Connectors</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { name: 'GitHub', status: 'connected', perms: 'read, write, repo' },
          { name: 'Gmail', status: 'disconnected', perms: '' },
          { name: 'Drive', status: 'disconnected', perms: '' },
          { name: 'Calendar', status: 'connected', perms: 'read' }
        ].map(c => (
          <Card key={c.name} className="bg-zinc-900 border-zinc-800"><CardContent className="p-4"><div className="flex justify-between"><span className="font-medium text-sm">{c.name}</span><Badge variant={c.status==='connected'?'success':'secondary'} className="text-[10px]">{c.status}</Badge></div><div className="text-[11px] text-zinc-500 mt-1">{c.perms || 'No permissions'}</div></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
