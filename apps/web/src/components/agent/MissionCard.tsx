'use client';
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Loader2, AlertCircle, Clock, Target } from 'lucide-react';
import type { Mission } from '@/lib/api/client';

interface MissionCardProps {
  mission: Mission;
  compact?: boolean;
}

export function MissionCard({ mission, compact }: MissionCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Circle className="w-4 h-4 text-zinc-600" />;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
        <Target className="w-4 h-4 text-zinc-500" />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{mission.goal}</div>
          <div className="text-[11px] text-zinc-500">{mission.id} • {mission.steps.filter(s => s.status === 'completed').length}/{mission.steps.length}</div>
        </div>
        <Badge variant={mission.status === 'completed' ? 'success' : mission.status === 'running' ? 'secondary' : 'outline'} className="text-[10px]">
          {mission.status}
        </Badge>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2">
            <Target className="w-5 h-5 text-zinc-400 mt-0.5" />
            <div>
              <CardTitle className="text-sm leading-5">{mission.goal}</CardTitle>
              <div className="text-[11px] text-zinc-500 mt-1 font-mono">{mission.id}</div>
            </div>
          </div>
          <Badge variant={mission.status === 'completed' ? 'success' : mission.status === 'running' ? 'secondary' : mission.status === 'failed' ? 'destructive' : 'outline'}>
            {mission.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Plan Timeline */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">الخطة التنفيذية</div>
          <div className="space-y-1.5">
            {mission.steps.map((step, idx) => (
              <div key={step.id} className="flex items-start gap-2.5 text-sm">
                <div className="mt-0.5">{getStatusIcon(step.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] leading-5 ${step.status === 'completed' ? 'text-zinc-300' : step.status === 'running' ? 'text-white' : 'text-zinc-500'}`}>
                    {idx + 1}. {step.task}
                  </div>
                  {step.tool && <div className="text-[11px] text-zinc-500 font-mono">→ {step.tool} {step.durationMs ? `• ${step.durationMs}ms` : ''}</div>}
                  {step.error && <div className="text-[11px] text-red-400 mt-1">{step.error}</div>}
                </div>
                {step.status === 'running' && <Clock className="w-3 h-3 text-zinc-500 mt-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800">
          <div className="text-center">
            <div className="text-[11px] text-zinc-500">Tokens</div>
            <div className="text-sm font-mono">{mission.cost.tokens}</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-zinc-500">Spend</div>
            <div className="text-sm font-mono">${mission.cost.spend.toFixed(4)}</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-zinc-500">Time</div>
            <div className="text-sm font-mono">{Math.round(mission.cost.durationMs / 1000)}s</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlanTimeline({ steps }: { steps: { id: string; task: string; status: string }[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div key={step.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono ${
              step.status === 'completed' ? 'bg-green-600 text-white' : step.status === 'running' ? 'bg-blue-600 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {step.status === 'completed' ? '✓' : idx + 1}
            </div>
            {idx < steps.length - 1 && <div className={`w-0.5 h-6 ${step.status === 'completed' ? 'bg-green-800' : 'bg-zinc-800'}`} />}
          </div>
          <div className="pb-6">
            <div className="text-sm">{step.task}</div>
            <div className="text-[11px] text-zinc-500 capitalize">{step.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
