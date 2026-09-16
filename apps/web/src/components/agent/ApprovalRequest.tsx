'use client';
import React from 'react';
import { ShieldAlert, Check, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { ApprovalRequest as ApprovalType } from '@/store/approval.store';

export function ApprovalRequest({ approval, onApprove, onReject }: { 
  approval: ApprovalType; 
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'SAFE': return 'bg-green-950 text-green-400 border-green-800';
      case 'READ': return 'bg-blue-950 text-blue-400 border-blue-800';
      case 'WRITE': return 'bg-yellow-950 text-yellow-400 border-yellow-800';
      case 'EXECUTE': return 'bg-orange-950 text-orange-400 border-orange-800';
      case 'EXTERNAL': return 'bg-red-950 text-red-400 border-red-800';
      case 'SECRET': return 'bg-red-950 text-red-400 border-red-800';
      default: return 'bg-zinc-900 text-zinc-400 border-zinc-800';
    }
  };

  return (
    <Card className="border-yellow-800/50 bg-yellow-950/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2">
            <ShieldAlert className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                Approval Required
                <Badge className={`text-[10px] border ${getRiskColor(approval.risk)}`}>{approval.risk}</Badge>
              </CardTitle>
              <div className="text-[11px] text-zinc-500 mt-1 font-mono">{approval.id} • Mission {approval.missionId}</div>
            </div>
          </div>
          <Badge variant={approval.status === 'pending' ? 'warning' : approval.status === 'approved' ? 'success' : 'destructive'} className="text-[10px]">
            {approval.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[11px] text-zinc-500">Action</div>
            <div className="font-mono font-medium">{approval.action}</div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Resource</div>
            <div className="font-mono">{approval.resource}</div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Policy</div>
            <div>{approval.policy}</div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Time</div>
            <div className="text-[11px]">{new Date(approval.requestedAt).toLocaleString('ar-EG')}</div>
          </div>
        </div>
        
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
          <div className="text-[11px] text-zinc-500 mb-1">Reason</div>
          <div className="text-[13px]">{approval.reason}</div>
        </div>

        {approval.status === 'pending' && (
          <div className="flex gap-2">
            <Button onClick={() => onApprove(approval.id)} size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white">
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button onClick={() => onReject(approval.id)} variant="destructive" size="sm" className="flex-1">
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-1" /> Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
