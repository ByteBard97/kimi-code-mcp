import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { parseKimiOutput } from './parser.js';
import { getSessionId, isNewSession, saveSessionId, extractSessionIdFromStderr } from './session.js';
import { resolveModel } from './models.js';

export interface TokenUsage {
  input_other: number;
  output: number;
  input_cache_read: number;
  input_cache_creation: number;
}

export interface KimiOutput {
  text: string;
  thinking?: string;
  raw: string;
  tokenUsage?: TokenUsage | null;
  contextTokens?: number | null;
  sessionId?: string | null;
}

export interface KimiCliOptions {
  prompt: string;
  workDir?: string;
  thinking?: boolean;
  session?: string;
  continueSession?: boolean;
  model?: string;
  timeout?: number;
  useJsonOutput?: boolean;
}

/**
 * Helper function to log debug messages to stderr when MCP_KIMI_DEBUG is set
 */
function debug(...args: unknown[]): void {
  if (process.env.MCP_KIMI_DEBUG) {
    console.error('[kimi-mcp debug]', ...args);
  }
}

/**
 * Finds the Kimi CLI binary path
 * @returns The path to the kimi binary
 * @throws Error if KIMI_CLI_PATH is set to a relative path
 */
export function findKimiCli(): string {
  const envPath = process.env.KIMI_CLI_PATH;

  if (envPath) {
    // Validate it's an absolute path
    if (!isAbsolute(envPath)) {
      throw new Error('KIMI_CLI_PATH must be an absolute path, not a relative path');
    }
    debug('Using Kimi CLI from KIMI_CLI_PATH:', envPath);
    return envPath;
  }

  debug('Using Kimi CLI from PATH: kimi');
  return 'kimi';
}

/**
 * Builds the command-line arguments array for the Kimi CLI
 * @param options - CLI options
 * @returns Array of command-line arguments
 * @throws Error if workDir is specified but doesn't exist
 */
export function buildKimiArgs(options: KimiCliOptions): string[] {
  const args: string[] = ['--print', '-y'];

  // Add thinking flag
  if (options.thinking) {
    args.push('--thinking');
  } else {
    args.push('--no-thinking');
  }

  // Add work directory if specified
  if (options.workDir) {
    if (!existsSync(options.workDir)) {
      throw new Error(`Work directory does not exist: ${options.workDir}`);
    }
    args.push('--work-dir', options.workDir);
  }

  // Add session ID if specified
  if (options.session) {
    args.push('--session', options.session);
  }

  // Add continue flag if specified
  if (options.continueSession) {
    args.push('--continue');
  }

  // Add model if specified (resolve alias first)
  const resolvedModel = resolveModel(options.model);
  if (resolvedModel) {
    args.push('--model', resolvedModel);
  }

  // Add JSON output format if specified
  if (options.useJsonOutput) {
    args.push('--output-format', 'stream-json', '--final-message-only');
  }

  // Add prompt
  args.push('-p', options.prompt);

  return args;
}

/**
 * Resolves session options for a given workDir.
 * If a session exists for the workDir, returns it with continue flag.
 * Otherwise returns undefined (new session will be created by kimi CLI).
 */
function resolveSessionOptions(workDir: string | undefined): { sessionId?: string; continueSession?: boolean } {
  if (!workDir) return {};

  const existingSession = getSessionId(workDir);
  if (existingSession && !isNewSession(workDir)) {
    debug('Resuming existing session:', existingSession.slice(0, 8) + '...');
    return { sessionId: existingSession, continueSession: true };
  }

  debug('No existing session for:', workDir);
  return {};
}

/**
 * Executes the Kimi CLI with the given options
 * @param options - CLI options
 * @returns Promise resolving to parsed Kimi output
 * @throws Error on execution failure or timeout
 */
export function executeKimi(options: KimiCliOptions): Promise<KimiOutput> {
  return new Promise((resolve, reject) => {
    const binaryPath = findKimiCli();

    // Resolve session from store if workDir provided and no explicit session
    let effectiveOptions = options;
    if (options.workDir && !options.session) {
      const sessionOpts = resolveSessionOptions(options.workDir);
      effectiveOptions = {
        ...options,
        ...sessionOpts,
      };
    }

    const args = buildKimiArgs(effectiveOptions);

    debug('Executing Kimi CLI:', binaryPath, args.join(' '));

    const child = spawn(binaryPath, args);

    let stdout = '';
    let stderr = '';
    let killed = false;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Set up timeout (default 300 seconds, override from options)
    const timeoutMs = options.timeout ? options.timeout * 1000 : 300_000;
    const timeoutHandle = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`Kimi CLI execution timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to execute Kimi CLI: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      if (killed) return;

      if (code !== 0) {
        debug('Kimi CLI exited with code:', code);
        debug('stderr:', stderr);
        reject(new Error(`Kimi CLI exited with code ${code}: ${stderr || 'No error message'}`));
        return;
      }

      debug('Kimi CLI output length:', stdout.length);
      debug('Kimi CLI stderr:', stderr);

      try {
        const output = parseKimiOutput(stdout);

        // Extract and save session ID from stderr
        const sessionId = extractSessionIdFromStderr(stderr);
        if (sessionId && options.workDir) {
          saveSessionId(options.workDir, sessionId);
          output.sessionId = sessionId;
        }

        resolve(output);
      } catch (error) {
        reject(new Error(`Failed to parse Kimi output: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  });
}
