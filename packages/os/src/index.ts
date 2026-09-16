/**
 * @agi-system/os - OS Execution Layer: PowerShell, Bash, CMD, Zsh, WSL, Remote SSH, Sandbox, OS abstraction
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface ExecuteOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  shell?: 'auto' | 'powershell' | 'bash' | 'cmd' | 'zsh' | 'wsl' | 'ssh';
}

export interface ShellExecutor {
  execute(command: string, options?: ExecuteOptions): Promise<CommandResult>;
  health(): Promise<{ status: 'ok' | 'degraded' | 'down'; shell: string }>;
}

export class PowerShellExecutor implements ShellExecutor {
  async execute(command: string, options?: ExecuteOptions): Promise<CommandResult> {
    console.log(`[powershell] Executing: ${command} in ${options?.cwd || '.'}`);
    // Simulate PowerShell execution
    return { stdout: `PowerShell output for: ${command}`, stderr: '', exitCode: 0, durationMs: 100 };
  }
  async health(): Promise<{ status: 'ok' | 'degraded' | 'down'; shell: string }> {
    return { status: 'ok', shell: 'powershell' };
  }
}

export class BashExecutor implements ShellExecutor {
  async execute(command: string, options?: ExecuteOptions): Promise<CommandResult> {
    console.log(`[bash] Executing: ${command} in ${options?.cwd || '.'}`);
    return { stdout: `Bash output for: ${command}`, stderr: '', exitCode: 0, durationMs: 80 };
  }
  async health(): Promise<{ status: 'ok' | 'degraded' | 'down'; shell: string }> {
    return { status: 'ok', shell: 'bash' };
  }
}

export class SandboxedExecutor implements ShellExecutor {
  private policy: {
    workspace: string;
    networkPolicy: 'allow' | 'restricted' | 'deny';
    filesystemPolicy: 'read-only' | 'read-write' | 'restricted';
    allowedPaths: string[];
    blockedPaths: string[];
    timeLimitMs: number;
    memoryLimitMB: number;
  };

  constructor(policy?: Partial<SandboxedExecutor['policy']>) {
    this.policy = {
      workspace: '/tmp/sandbox',
      networkPolicy: 'restricted',
      filesystemPolicy: 'restricted',
      allowedPaths: ['src/', 'tests/', 'packages/'],
      blockedPaths: ['secrets/', '.env', 'node_modules/'],
      timeLimitMs: 30000,
      memoryLimitMB: 512,
      ...policy
    };
  }

  async execute(command: string, options?: ExecuteOptions): Promise<CommandResult> {
    // Policy check
    if (this.policy.blockedPaths.some(p => command.includes(p))) {
      return { stdout: '', stderr: `Blocked path in command: ${command}`, exitCode: 1, durationMs: 0 };
    }
    if (command.includes('rm -rf /') || command.includes('drop table')) {
      return { stdout: '', stderr: `Dangerous command blocked: ${command}`, exitCode: 1, durationMs: 0 };
    }

    console.log(`[sandbox] Executing in ${this.policy.workspace}: ${command}`);
    return { stdout: `Sandboxed output for: ${command}`, stderr: '', exitCode: 0, durationMs: 120 };
  }

  async health(): Promise<{ status: 'ok' | 'degraded' | 'down'; shell: string }> {
    return { status: 'ok', shell: 'sandbox' };
  }
}

export class OSAgnosticExecutor implements ShellExecutor {
  private ps = new PowerShellExecutor();
  private bash = new BashExecutor();
  private sandbox = new SandboxedExecutor();

  async execute(command: string, options?: ExecuteOptions): Promise<CommandResult> {
    const shell = options?.shell || 'auto';
    
    if (shell === 'auto') {
      // Auto-detect: Windows -> PowerShell, Linux -> Bash, sandboxed for safety
      const isWindows = process.platform === 'win32';
      if (isWindows) return this.ps.execute(command, options);
      return this.sandbox.execute(command, options);
    }

    if (shell === 'powershell') return this.ps.execute(command, options);
    if (shell === 'bash') return this.bash.execute(command, options);
    return this.sandbox.execute(command, options);
  }

  async health(): Promise<{ status: 'ok' | 'degraded' | 'down'; shell: string }> {
    return { status: 'ok', shell: 'auto' };
  }

  // OS Abstraction Layer - semantic commands, not OS-specific
  async listFiles(path: string): Promise<CommandResult> {
    // Agent sees "list files" not "ls" or "Get-ChildItem"
    return this.execute(`list_files ${path}`, { shell: 'auto' });
  }

  async inspectPackage(): Promise<CommandResult> {
    return this.execute('inspect_package', { shell: 'auto' });
  }

  async runTests(): Promise<CommandResult> {
    return this.execute('npm test', { shell: 'auto' });
  }

  async build(): Promise<CommandResult> {
    return this.execute('npm run build', { shell: 'auto' });
  }
}

export const osExecutor = new OSAgnosticExecutor();
export default OSAgnosticExecutor;
