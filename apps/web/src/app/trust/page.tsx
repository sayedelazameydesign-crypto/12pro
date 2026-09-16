'use client';
import React from 'react';
import { TrustDashboard } from '@/components/trust/TrustDashboard';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

export default function TrustPage() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Shield className="w-6 h-6" /> Trust & Evidence
        <Badge variant="success" className="text-[11px]">Real Verification</Badge>
      </h1>
      <TrustDashboard />
    </div>
  );
}
