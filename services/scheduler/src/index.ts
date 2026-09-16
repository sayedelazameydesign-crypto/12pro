/**
 * @agi-system/scheduler - Service Layer: Mission scheduler
 */
export interface ScheduledMission {
  cron: string;
  goal: string;
  enabled: boolean;
}

export class Scheduler {
  async schedule(m: ScheduledMission) {
    console.log(`[scheduler] Scheduling: ${m.cron} -> ${m.goal}`);
  }
}
