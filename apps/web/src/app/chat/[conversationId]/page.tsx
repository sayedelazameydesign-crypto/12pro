'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChatView } from '@/components/chat/ChatView';
import { MissionCard } from '@/components/agent/MissionCard';
import { ToolActivity, AgentStatus } from '@/components/agent/ToolActivity';
import { useChatStore } from '@/store/chat.store';
import { useMissionStore } from '@/store/mission.store';
import { useUIStore } from '@/store/ui.store';
import { useRuntimeStore } from '@/store/runtime.store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { messages, addMessage, setStreaming, appendStreaming } = useChatStore();
  const { currentMission } = useMissionStore();
  const { language, agentMode, showMissionCockpit, showToolActivity } = useUIStore();
  const { status, autonomyLevel } = useRuntimeStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    useChatStore.getState().setCurrentConversation(conversationId);
    // Load mock messages if none
    if (!messages[conversationId] || messages[conversationId].length === 0) {
      const mockMessages = [
        { id: '1', conversationId, role: 'user' as const, content: language === 'ar' ? 'مرحبا، كيف يمكن للنظام مساعدتي اليوم؟' : 'Hello, how can the system help today?', timestamp: new Date(Date.now() - 60000).toISOString() },
        { id: '2', conversationId, role: 'assistant' as const, content: language === 'ar' ? 'مرحباً! أنا CeliaOS - واجهة Agent OS الكاملة. أستطيع إدارة المهمات، البحث في الذاكرة، تنفيذ الأدوات، وطلب الموافقات. كل شيء متصل مباشرة بالـRuntime.\n\nجرب: "أنشئ مهمة لبناء Skill جديدة" أو "اعرض حالة الـProviders"' : 'Hello! I am CeliaOS - full Agent OS interface. I can manage missions, search memory, execute tools, and request approvals. Everything connected directly to Runtime.\n\nTry: "Create a mission to build a new Skill" or "Show Providers status"', timestamp: new Date().toISOString() }
      ];
      useChatStore.getState().setMessages(conversationId, mockMessages);
    }
  }, [conversationId, language, messages]);

  const handleSend = async (content: string) => {
    const userMsg = {
      id: `msg_${Date.now()}`,
      conversationId,
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString()
    };
    addMessage(userMsg);
    setIsLoading(true);
    setStreaming(true, '');

    // Simulate streaming response from Intelligence Fabric
    const response = `تم استلام: "${content.slice(0, 100)}"\n\nجاري التوجيه عبر Intelligence Fabric:\n- Task Router: ${content.includes('كود') || content.toLowerCase().includes('code') ? 'coding → ollama/codellama' : 'chat → ollama/llama3.2'}\n- Budget Guard: $0.00 / $0.00 PASS\n- Provider: ollama (local) → fallback gemini if needed\n- Memory: searching semantic memory for relevant context...\n\nهذا رد محاكي - في التنفيذ الحقيقي، يأتي من:\nPOST /api/v1/conversations/${conversationId}/messages\nGET /api/v1/events/stream (SSE)\n\nمع streaming حقيقي و mission timeline و tool activity.`;

    // Stream simulation
    for (let i = 0; i < response.length; i += 15) {
      await new Promise(r => setTimeout(r, 30));
      appendStreaming(response.slice(i, i + 15));
    }

    const assistantMsg = {
      id: `msg_${Date.now() + 1}`,
      conversationId,
      role: 'assistant' as const,
      content: response,
      timestamp: new Date().toISOString(),
      toolCalls: [
        { tool: 'memory.search', args: { query: content.slice(0, 50) }, result: '5 records found', timestamp: new Date().toISOString(), durationMs: 45 },
        { tool: 'provider.router', args: { task: 'chat', provider: 'ollama' }, result: 'routed to ollama', timestamp: new Date().toISOString(), durationMs: 12 }
      ]
    };
    addMessage(assistantMsg);
    setStreaming(false, '');
    setIsLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-800">
        <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Chat {conversationId.slice(0, 8)}</span>
            <Badge variant="outline" className="text-[10px]">RTL • Streaming</Badge>
            <Badge variant="secondary" className="text-[10px]">{agentMode}</Badge>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>Autonomy {autonomyLevel}%</span>
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>
        <ChatView conversationId={conversationId} onSendMessage={handleSend} />
      </div>

      {/* Right Cockpit - Mission + Tools */}
      <div className="w-[380px] hidden xl:flex flex-col bg-zinc-950">
        {showMissionCockpit && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3 border-b border-zinc-800">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Mission Cockpit</div>
            {currentMission ? (
              <MissionCard mission={currentMission} />
            ) : (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Agent Mission</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Understand', status: 'completed' },
                      { label: 'Plan', status: 'completed' },
                      { label: 'Act → Browser', status: 'running' },
                      { label: 'Observe', status: 'pending' },
                      { label: 'Reflect', status: 'pending' }
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2 text-[13px]">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${s.status === 'completed' ? 'bg-green-600 text-white' : s.status === 'running' ? 'bg-blue-600 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>{s.status === 'completed' ? '✓' : s.status === 'running' ? '●' : '○'}</span>
                        <span className={s.status === 'running' ? 'text-white' : 'text-zinc-500'}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <AgentStatus mode={agentMode} autonomyLevel={autonomyLevel} runtimeStatus={status} />
          </div>
        )}

        {showToolActivity && (
          <div className="h-[40%] overflow-y-auto p-3">
            <ToolActivity toolCalls={currentMission?.toolCalls || [
              { tool: 'browser.search', args: { query: '12pro architecture' }, result: 'found', timestamp: new Date().toISOString(), durationMs: 120 },
              { tool: 'memory.search', args: { type: 'semantic' }, result: '5 results', timestamp: new Date().toISOString(), durationMs: 45 }
            ]} />
          </div>
        )}
      </div>
    </div>
  );
}
