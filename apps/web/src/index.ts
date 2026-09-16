/**
 * @agi-system/web - Product Layer: Web UI
 * Next.js-like frontend for AGI-OS monitoring
 */
import { AgentCoreService } from "@agi-system/agent-core";
import { RuntimeService } from "@agi-system/runtime";

console.log("[web] Starting AGI-OS Web...");

export async function startWeb() {
  const agentCore = new AgentCoreService({ enabled: true });
  const runtime = new RuntimeService({ enabled: true });
  await agentCore.init();
  await runtime.init();
  return { status: "ok", port: 3000 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWeb().then(r => console.log(r));
}
