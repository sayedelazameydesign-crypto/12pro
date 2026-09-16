'use client';
import React, { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { useApprovalStore } from '@/store/approval.store';
import { ApprovalRequest } from '@/components/agent/ApprovalRequest';

export default function ApprovalsPage() {
  const { approvals, pending, setApprovals, approve, reject } = useApprovalStore();

  useEffect(() => {
    if (approvals.length === 0) {
      setApprovals([
        { id: 'apr_001', missionId: 'mission_4821', action: 'git push origin feature/x', resource: 'repository', risk: 'EXTERNAL', policy: 'external-ask', reason: 'Push to remote requires approval', status: 'pending', requestedAt: new Date().toISOString(), metadata: { branch: 'feature/x' } },
        { id: 'apr_002', missionId: 'mission_4821', action: 'filesystem.write', resource: 'src/app/page.tsx', risk: 'WRITE', policy: 'write-ask', reason: 'Write to source file', status: 'pending', requestedAt: new Date(Date.now() - 60000).toISOString() },
        { id: 'apr_003', missionId: 'mission_4820', action: 'api.call', resource: 'gemini API', risk: 'EXTERNAL', policy: 'cost-zero', reason: 'Free tier check', status: 'approved', requestedAt: new Date(Date.now() - 120000).toISOString(), decidedAt: new Date().toISOString() }
      ]);
    }
  }, [approvals.length, setApprovals]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldCheck className="w-6 h-6" /> Approval Center
        <Badge variant="secondary">{pending.length} pending</Badge>
        <Badge variant="outline" className="text-[11px]">Governance</Badge>
      </h1>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-3 text-center"><div className="text-[11px] text-zinc-500">Pending</div><div className="text-xl font-mono">{pending.length}</div></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-3 text-center"><div className="text-[11px] text-zinc-500">Approved</div><div className="text-xl font-mono text-green-400">{approvals.filter(a => a.status === 'approved').length}</div></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-3 text-center"><div className="text-[11px] text-zinc-500">Rejected</div><div className="text-xl font-mono text-red-400">{approvals.filter(a => a.status === 'rejected').length}</div></CardContent></Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-sm">Risk Levels • Governance</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {[
              { level: 'SAFE', color: 'bg-green-950 text-green-400 border-green-800', action: 'ALLOW' },
              { level: 'READ', color: 'bg-blue-950 text-blue-400 border-blue-800', action: 'ALLOW' },
              { level: 'WRITE', color: 'bg-yellow-950 text-yellow-400 border-yellow-800', action: 'ASK' },
              { level: 'EXECUTE', color: 'bg-orange-950 text-orange-400 border-orange-800', action: 'ASK' },
              { level: 'EXTERNAL', color: 'bg-red-950 text-red-400 border-red-800', action: 'ASK' },
              { level: 'SECRET', color: 'bg-red-950 text-red-400 border-red-800', action: 'BLOCK' }
            ].map(r => (
              <div key={r.level} className={`px-2.5 py-1 rounded-full text-[11px] border ${r.color}`}>{r.level} → {r.action}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {approvals.map(apr => (
          <ApprovalRequest key={apr.id} approval={apr} onApprove={approve} onReject={reject} />
        ))}
      </div>
    </div>
  );
}
