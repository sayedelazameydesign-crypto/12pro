/**
 * @agi-system/api-server - Service Layer
 * Production API server with governance gates
 */
import { GovernanceService } from "@agi-system/governance";
import { ObservabilityService } from "@agi-system/observability";

export async function startApiServer() {
  const gov = new GovernanceService({ enabled: true });
  const obs = new ObservabilityService({ enabled: true });
  await gov.init();
  await obs.init();
  console.log("[api-server] Listening on 0.0.0.0:3000");
  return { port: 3000 };
}
