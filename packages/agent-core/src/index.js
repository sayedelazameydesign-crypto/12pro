/**
 * @agi-system/agent-core
 * Part of AGI-OS 12-layer architecture
 * Responsibility: agent-core layer
 */
export const PACKAGE_NAME = "@agi-system/agent-core";
export const VERSION = "0.1.0";
export class AgentCoreService {
    config;
    constructor(config = { enabled: true, timeoutMs: 30000 }) {
        this.config = config;
    }
    async init() {
        console.log(`[${PACKAGE_NAME}] initializing...`);
        // TODO: implement agent-core initialization with governance checks
    }
    health() {
        return { status: 'ok', package: PACKAGE_NAME, timestamp: new Date().toISOString() };
    }
    async shutdown() {
        console.log(`[${PACKAGE_NAME}] shutting down...`);
    }
}
export * from "./types.js";
export default AgentCoreService;
//# sourceMappingURL=index.js.map