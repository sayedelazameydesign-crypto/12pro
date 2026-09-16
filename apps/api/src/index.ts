/**
 * @agi-system/api - Product Layer: API
 * REST API for agent missions
 */
export interface MissionRequest {
  goal: string;
  constraints?: Record<string, unknown>;
}

export interface MissionResponse {
  missionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
}

export async function createMission(req: MissionRequest): Promise<MissionResponse> {
  const missionId = `mission_${Date.now()}`;
  console.log(`[api] Creating mission ${missionId}: ${req.goal}`);
  return { missionId, status: 'queued' };
}
