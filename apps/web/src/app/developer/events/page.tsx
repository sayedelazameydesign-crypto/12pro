'use client';
import { Card, CardContent } from '@/components/ui/card';
export default function EventsPage() {
  return <div className="p-6 max-w-6xl mx-auto"><h1 className="text-xl font-bold mb-4">Events • SSE Stream</h1><Card className="bg-zinc-950 border-zinc-800"><CardContent className="p-4 font-mono text-[11px] space-y-1"><div>mission.step.started • mission_4821 • step_3</div><div>tool.browser.started • search</div><div>tool.browser.completed • 120ms</div><div>memory.written • episodic</div></CardContent></Card></div>;
}
