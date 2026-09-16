'use client';
import { Card, CardContent } from '@/components/ui/card';
export default function ApiPage() {
  return <div className="p-6 max-w-6xl mx-auto"><h1 className="text-xl font-bold mb-4">API Explorer</h1><Card className="bg-zinc-950 border-zinc-800"><CardContent className="p-4 font-mono text-[11px] space-y-1"><div>GET /api/v1/conversations</div><div>POST /api/v1/conversations/:id/messages</div><div>GET /api/v1/events/stream</div><div>POST /api/v1/missions</div><div>GET /api/v1/runtime/health</div></CardContent></Card></div>;
}
