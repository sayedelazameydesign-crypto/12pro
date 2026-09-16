/**
 * @agi-system/worker - Service Layer: Background worker
 * Executes long-horizon missions
 */
export class Worker {
  concurrency: number;
  constructor(concurrency = 4) { this.concurrency = concurrency; }
  async start() { console.log(`[worker] Starting with concurrency ${this.concurrency}`); }
  async stop() { console.log("[worker] Stopping"); }
}
