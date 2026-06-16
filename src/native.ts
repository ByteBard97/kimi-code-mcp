import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_LINE_LIMIT = 1000;

export function nativeReadFile(args: Record<string, unknown>): string {
  const path = args.path as string;
  const offset = (args.offset as number | undefined) ?? 0;
  const limit = (args.limit as number | undefined) ?? DEFAULT_LINE_LIMIT;

  const content = readFileSync(path, 'utf8');
  const lines = content.split('\n');
  const slice = lines.slice(offset, offset + limit);

  let result = slice.join('\n');
  if (offset + limit < lines.length) {
    result += `\n[... truncated at line ${offset + limit} of ${lines.length} total]`;
  }
  return result;
}

export function nativeWriteFile(args: Record<string, unknown>): string {
  const path = args.path as string;
  const content = args.content as string;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  return `Written ${content.length} bytes to ${path}`;
}

export function nativeEditFile(args: Record<string, unknown>): string {
  const path = args.path as string;
  const oldString = args.old_string as string;
  const newString = args.new_string as string;

  const content = readFileSync(path, 'utf8');

  let count = 0;
  let idx = content.indexOf(oldString);
  while (idx !== -1) {
    count++;
    idx = content.indexOf(oldString, idx + 1);
  }

  if (count === 0) {
    throw new Error(`String not found in ${path}`);
  }
  if (count > 1) {
    throw new Error(`String not unique in ${path} (${count} occurrences) — add more surrounding context`);
  }

  writeFileSync(path, content.replace(oldString, newString), 'utf8');
  return `Edited ${path}`;
}

interface SubprocessResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function runSubprocess(
  cmd: string,
  cmdArgs: string[],
  opts: { cwd?: string; timeout?: number },
): Promise<SubprocessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: opts.cwd });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeoutSec = opts.timeout ?? 30;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutSec}s: ${cmd}`));
    }, timeoutSec * 1000);

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('error', (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to execute ${cmd}: ${err.message}`));
    });

    child.on('close', (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

export async function nativeGlob(args: Record<string, unknown>): Promise<string> {
  const pattern = args.pattern as string;
  const searchPath = (args.path as string | undefined) || '.';
  const workFolder = args.workFolder as string | undefined;

  // rg exit 1 = no matches (not an error)
  const { stdout, code } = await runSubprocess(
    'rg',
    ['--files', '-g', pattern, searchPath],
    { cwd: workFolder },
  );

  if (code !== 0 && code !== 1) {
    throw new Error(`rg failed (exit ${code})`);
  }
  const files = stdout.trim();
  return files.length > 0 ? files : '(no results)';
}

export async function nativeGrep(args: Record<string, unknown>): Promise<string> {
  const pattern = args.pattern as string;
  const searchPath = (args.path as string | undefined) || '.';
  const include = args.include as string | undefined;
  const workFolder = args.workFolder as string | undefined;

  const rgArgs = ['--line-number', '--with-filename'];
  if (include) {
    rgArgs.push('--glob', include);
  }
  rgArgs.push(pattern, searchPath);

  // rg exit 1 = no matches (not an error)
  const { stdout, code } = await runSubprocess('rg', rgArgs, { cwd: workFolder });

  if (code !== 0 && code !== 1) {
    throw new Error(`rg failed (exit ${code})`);
  }
  const matches = stdout.trim();
  return matches.length > 0 ? matches : '(no matches)';
}

export async function nativeShell(args: Record<string, unknown>): Promise<string> {
  const command = args.command as string;
  const workFolder = (args.workFolder as string | undefined) || process.cwd();
  const timeout = (args.timeout as number | undefined) ?? 120;

  const { stdout, stderr, code } = await runSubprocess(
    'bash',
    ['-c', command],
    { cwd: workFolder, timeout },
  );

  const output = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
  if (code !== 0) {
    return `[exit ${code}]\n${output}`;
  }
  return output || '(no output)';
}

export async function handleNativeTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  switch (toolName) {
    case 'kimi_read_file': return nativeReadFile(args);
    case 'kimi_write_file': return nativeWriteFile(args);
    case 'kimi_edit_file': return nativeEditFile(args);
    case 'kimi_glob': return nativeGlob(args);
    case 'kimi_grep': return nativeGrep(args);
    case 'kimi_shell': return nativeShell(args);
    default: throw new Error(`Not a native tool: ${toolName}`);
  }
}
