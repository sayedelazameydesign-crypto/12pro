/**
 * @agi-system/web - CeliaOS Web Agent Interface
 * Product Layer: Web UI + Control Plane
 * 
 * This file is the legacy entry point for @agi-system/web package.
 * Next.js app lives in src/app/ directory.
 * 
 * For backward compatibility, we export startWeb that now starts both API and Web.
 */

// Legacy service for backward compat
export async function startWeb() {
  console.log("[web] Starting CeliaOS Web Agent Interface...");
  console.log("[web] - Next.js UI: http://0.0.0.0:3000");
  console.log("[web] - API Server: http://0.0.0.0:3001");
  console.log("[web] - Intelligence Fabric: $0 policy active");
  return { status: "ok", port: 3000, mode: "CeliaOS Control Plane" };
}

// New exports for CeliaOS
export { AppShell } from "./components/shell/AppShell.js";
export * from "./lib/api/client.js";
export * from "./lib/sse/client.js";
export * from "./store/chat.store.js";
export * from "./store/mission.store.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  startWeb().then(r => console.log(r));
}
