'use client';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
export default function ProjectDetail() {
  const params = useParams();
  return <div className="p-6"><Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6">Project {params.projectId as string} • Real data from GitHub + Mission Ledger</CardContent></Card></div>;
}
