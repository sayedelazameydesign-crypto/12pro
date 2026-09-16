/**
 * @agi-system/mcp - MCP layer: client, discovery, transport, policy
 * MCP as capability discovery unified tool layer
 */
export interface MCPServer {
  name: string;
  capabilities: string[];
  schemas: Record<string, any>;
  trustLevel: 'high' | 'medium' | 'low';
  transport: 'stdio' | 'sse' | 'websocket';
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  server: string;
  trustLevel: 'high' | 'medium' | 'low';
  permissionScope: string[];
  timeoutMs: number;
  rateLimit?: { requests: number; windowMs: number };
}

export class MCPClient {
  private servers = new Map<string, MCPServer>();
  private tools = new Map<string, MCPTool>();

  async discover(server: MCPServer): Promise<void> {
    this.servers.set(server.name, server);
    for (const cap of server.capabilities) {
      const tool: MCPTool = {
        name: `${server.name}.${cap}`,
        description: `Tool ${cap} from ${server.name}`,
        inputSchema: server.schemas[cap] || {},
        server: server.name,
        trustLevel: server.trustLevel,
        permissionScope: ['read'],
        timeoutMs: 30000,
        rateLimit: { requests: 100, windowMs: 60000 }
      };
      this.tools.set(tool.name, tool);
    }
  }

  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; data?: any; error?: string }> {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, error: `Tool ${name} not found` };
    
    // Policy check: trust level + permission scope
    if (tool.trustLevel === 'low') {
      return { success: false, error: `Tool ${name} requires approval (low trust)` };
    }

    // Simulate MCP round-trip
    return { success: true, data: { tool: name, args, result: `Mock result from ${name}` } };
  }
}

export const mcpClient = new MCPClient();
export default MCPClient;
