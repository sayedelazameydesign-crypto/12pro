'use client';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';
export default function ArtifactsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> Artifacts</h1>
      <div className="grid gap-2">
        {['report.md', 'changed-files/', 'test-results/', 'build/', 'provenance.json', 'attestation.json'].map(a => (
          <Card key={a} className="bg-zinc-900 border-zinc-800"><CardContent className="p-3 font-mono text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-zinc-500" />{a}</CardContent></Card>
        ))}
      </div>
    </div>
  );
}
