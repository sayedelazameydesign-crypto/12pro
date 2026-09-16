'use client';
import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '@/store/ui.store';
import { getSSEClient } from '@/lib/sse/client';
import { useMissionStore } from '@/store/mission.store';
import { useChatStore } from '@/store/chat.store';
import { useApprovalStore } from '@/store/approval.store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, language } = useUIStore();

  useEffect(() => {
    // Connect SSE for real-time events
    const sse = getSSEClient();
    sse.connect();

    // Handle mission events
    const unsubMission = sse.onAny((event) => {
      console.log('[AppShell] SSE event', event.type);
      
      if (event.type.startsWith('mission.')) {
        // Update mission store from real events
        const missionStore = useMissionStore.getState();
        if (event.type === 'mission.step.started' && event.missionId && event.stepId) {
          missionStore.updateMissionStep(event.missionId, event.stepId, { status: 'running' });
        }
        if (event.type === 'mission.step.completed' && event.missionId && event.stepId) {
          missionStore.updateMissionStep(event.missionId, event.stepId, { status: 'completed' });
        }
        if (event.type === 'mission.completed' && event.missionId) {
          missionStore.updateMission(event.missionId, { status: 'completed' as any });
        }
      }

      if (event.type === 'approval.requested') {
        const approvalStore = useApprovalStore.getState();
        approvalStore.addApproval(event.data);
      }

      if (event.type === 'message.created') {
        const chatStore = useChatStore.getState();
        chatStore.addMessage(event.data);
      }
    });

    return () => {
      unsubMission();
      sse.disconnect();
    };
  }, []);

  return (
    <div className={`${theme} min-h-screen bg-zinc-950 text-zinc-100`} dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <style>{`
        :root {
          --background: 0 0% 4%;
          --foreground: 0 0% 98%;
          --card: 0 0% 9%;
          --card-foreground: 0 0% 98%;
          --popover: 0 0% 9%;
          --popover-foreground: 0 0% 98%;
          --primary: 0 0% 98%;
          --primary-foreground: 0 0% 9%;
          --secondary: 0 0% 14%;
          --secondary-foreground: 0 0% 98%;
          --muted: 0 0% 14%;
          --muted-foreground: 0 0% 63%;
          --accent: 0 0% 14%;
          --accent-foreground: 0 0% 98%;
          --destructive: 0 84% 60%;
          --destructive-foreground: 0 0% 98%;
          --border: 0 0% 14%;
          --input: 0 0% 14%;
          --ring: 0 0% 98%;
          --radius: 0.5rem;
        }
        * { border-color: hsl(var(--border)); }
        body { background: hsl(var(--background)); color: hsl(var(--foreground)); font-family: Inter, system-ui, sans-serif; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>
      
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 bg-zinc-950">
            {children}
          </main>
        </div>
      </div>

      <CommandPalette />
    </div>
  );
}
