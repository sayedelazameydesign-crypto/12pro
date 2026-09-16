/**
 * @agi-system/runtime
 * Part of AGI-OS 12-layer architecture
 * Responsibility: runtime layer
 */
export declare const PACKAGE_NAME = "@agi-system/runtime";
export declare const VERSION = "0.1.0";
export interface ServiceConfig {
    enabled: boolean;
    timeoutMs?: number;
    maxRetries?: number;
}
export declare class RuntimeService {
    private config;
    constructor(config?: ServiceConfig);
    init(): Promise<void>;
    health(): {
        status: 'ok' | 'degraded' | 'down';
        package: string;
        timestamp: string;
    };
    shutdown(): Promise<void>;
}
export * from "./types.js";
export default RuntimeService;
//# sourceMappingURL=index.d.ts.map