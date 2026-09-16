/**
 * @agi-system/agent-ui - Product Layer: Agent UI
 * Real-time agent observability UI
 */
export interface AgentView {
  agentId: string;
  status: string;
  currentTask?: string;
  toolCalls: number;
}

export function renderAgentStatus(agents: AgentView[]) {
  return agents.map(a => `[${a.agentId}] ${a.status} - ${a.currentTask || 'idle'}`).join('\n');
}
