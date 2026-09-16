'use client';
import React from 'react';
import { RuntimeHealth } from '@/components/developer/RuntimeHealth';
import { Badge } from '@/components/ui/badge';
import { Code2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DeveloperPage() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Code2 className="w-6 h-6" /> Developer Console
        <Badge variant="outline">Control Center</Badge>
      </h1>

      <div className="flex gap-2">
        <Link href="/developer/logs"><Button variant="outline" size="sm">Logs</Button></Link>
        <Link href="/developer/events"><Button variant="outline" size="sm">Events</Button></Link>
        <Link href="/developer/api"><Button variant="outline" size="sm">API Explorer</Button></Link>
      </div>

      <RuntimeHealth />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-sm">REST Contract • Real API</CardTitle></CardHeader>
          <CardContent className="font-mono text-[11px] space-y-1">
            <div>POST /api/v1/conversations</div>
            <div>GET /api/v1/conversations/:id</div>
            <div>POST /api/v1/messages</div>
            <div>GET /api/v1/events/stream (SSE)</div>
            <div>POST /api/v1/missions</div>
            <div>GET /api/v1/missions/:id</div>
            <div>POST /api/v1/missions/:id/approve</div>
            <div>GET /api/v1/memory/search</div>
            <div>GET /api/v1/providers • health</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-sm">E2E Gate • Real Flow</CardTitle></CardHeader>
          <CardContent className="font-mono text-[11px] space-y-1">
            <div>Create conversation ↓</div>
            <div>Send message ↓</div>
            <div>Receive streamed event ↓</div>
            <div>Create mission ↓</div>
            <div>Planner creates steps ↓</div>
            <div>Tool executes ↓</div>
            <div>Approval appears ↓</div>
            <div>Approve ↓</div>
            <div>Mission resumes ↓</div>
            <div>Memory written ↓</div>
            <div>Artifact created ↓</div>
            <div>Evidence recorded ↓</div>
            <div>Conversation reloads after restart</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
