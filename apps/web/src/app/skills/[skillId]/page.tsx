'use client';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
export default function SkillDetail() {
  const params = useParams();
  return <div className="p-6"><Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6">Skill {params.skillId as string} • Registry + Tests + Promotion pipeline</CardContent></Card></div>;
}
