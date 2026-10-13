import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { GitNotInstalledError, GitExecutionError } from './git.errors';

const execFileAsync = promisify(execFile);

export interface GitRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitRunner {
  private gitAvailable: boolean | null = null;
  private readonly defaultTimeoutMs: number;
  private readonly maxBufferBytes: number;

  constructor(timeoutMs = 15000, maxBufferBytes = 10 * 1024 * 1024) {
    this.defaultTimeoutMs = timeoutMs;
    this.maxBufferBytes = maxBufferBytes;
  }

  /**
   * Verifies that the Git executable is installed and reachable on the server PATH.
   */
  async checkGitAvailable(): Promise<boolean> {
    if (this.gitAvailable !== null) {
      return this.gitAvailable;
    }

    try {
      const { stdout } = await execFileAsync('git', ['--version'], {
        timeout: 5000,
      });
      this.gitAvailable = stdout.toLowerCase().includes('git version');
      return this.gitAvailable;
    } catch {
      this.gitAvailable = false;
      return false;
    }
  }

  /**
   * Cleans sensitive local file system paths from git error output to prevent disclosure.
   */
  private sanitizeErrorOutput(output: string, cwd: string): string {
    if (!output) return '';
    let sanitized = output;

    // Redact absolute cwd
    if (cwd) {
      const normalizedCwd = path.normalize(cwd);
      sanitized = sanitized.split(normalizedCwd).join('[workspace]');
      sanitized = sanitized.split(cwd.replace(/\\/g, '/')).join('[workspace]');
    }

    // Redact potential home / windows user paths
    sanitized = sanitized.replace(/[A-Za-z]:\\[^:\n\r]+(\\|\/)/g, '[workspace]/');

    // Redact HTTP Authorization headers, credentials in URLs, and tokens
    sanitized = sanitized.replace(/AUTHORIZATION:\s*[^\s\n\r"']+/gi, 'Authorization: [REDACTED]');
    sanitized = sanitized.replace(/Basic\s+[a-zA-Z0-9+/=]+/gi, 'Basic [REDACTED]');
    sanitized = sanitized.replace(/x-access-token:[^\s\n\r"']+/gi, 'x-access-token:[REDACTED]');
    sanitized = sanitized.replace(/https:\/\/[^@\s]+@/gi, 'https://');
    sanitized = sanitized.replace(/(ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]+/gi, '[REDACTED_TOKEN]');
    sanitized = sanitized.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');

    return sanitized.trim();
  }

  /**
   * Executes a Git command safely using execFile with argument arrays.
   * Never invokes a shell, preventing shell injection vulnerabilities.
   */
  async run(
    args: string[],
    cwd: string,
    options?: {
      timeoutMs?: number;
      allowNonZeroExit?: boolean;
      customEnv?: Record<string, string>;
    }
  ): Promise<GitRunResult> {
    const isAvailable = await this.checkGitAvailable();
    if (!isAvailable) {
      throw new GitNotInstalledError();
    }

    const timeout = options?.timeoutMs ?? this.defaultTimeoutMs;

    // Isolate Git environment; disable prompts so processes never hang
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: '',
      SSH_ASKPASS: '',
      LC_ALL: 'C',
      ...(options?.customEnv || {}),
    };

    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd,
        timeout,
        maxBuffer: this.maxBufferBytes,
        env,
      });

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const error = err as {
        code?: number | string;
        stdout?: string | Buffer;
        stderr?: string | Buffer;
        message?: string;
        killed?: boolean;
      };

      const stdoutStr = error.stdout ? error.stdout.toString() : '';
      const stderrStr = error.stderr ? error.stderr.toString() : '';

      if (options?.allowNonZeroExit && typeof error.code === 'number') {
        return {
          stdout: stdoutStr,
          stderr: stderrStr,
          exitCode: error.code,
        };
      }

      if (error.killed) {
        throw new GitExecutionError(`Git command timed out after ${timeout}ms.`);
      }

      const rawMsg = stderrStr || stdoutStr || error.message || 'Unknown Git error';
      const cleanMsg = this.sanitizeErrorOutput(rawMsg, cwd);

      throw new GitExecutionError(cleanMsg || 'Git command failed to execute successfully.');
    }
  }
}

export const gitRunner = new GitRunner();
