import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { findKimiCli, buildKimiArgs, executeKimi } from '../cli.js';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

describe('findKimiCli', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns "kimi" when no env var is set', () => {
    vi.stubEnv('KIMI_CLI_PATH', '');
    expect(findKimiCli()).toBe('kimi');
  });

  it('returns the env var value when KIMI_CLI_PATH is set', () => {
    vi.stubEnv('KIMI_CLI_PATH', '/usr/local/bin/kimi');
    expect(findKimiCli()).toBe('/usr/local/bin/kimi');
  });

  it('throws for relative paths in KIMI_CLI_PATH', () => {
    vi.stubEnv('KIMI_CLI_PATH', './bin/kimi');
    expect(() => findKimiCli()).toThrow('must be an absolute path');
  });

  it('throws for parent-relative paths in KIMI_CLI_PATH', () => {
    vi.stubEnv('KIMI_CLI_PATH', '../bin/kimi');
    expect(() => findKimiCli()).toThrow('must be an absolute path');
  });

  it('throws for bare relative paths like foo/bar in KIMI_CLI_PATH', () => {
    vi.stubEnv('KIMI_CLI_PATH', 'foo/bar');
    expect(() => findKimiCli()).toThrow('must be an absolute path');
  });

  it('throws for bare name without slashes in KIMI_CLI_PATH', () => {
    vi.stubEnv('KIMI_CLI_PATH', 'kimi-custom');
    expect(() => findKimiCli()).toThrow('must be an absolute path');
  });
});

describe('buildKimiArgs', () => {
  it('always includes --print and -y', () => {
    const args = buildKimiArgs({ prompt: 'test' });
    expect(args).toContain('--print');
    expect(args).toContain('-y');
  });

  it('adds --thinking when thinking=true', () => {
    const args = buildKimiArgs({ prompt: 'test', thinking: true });
    expect(args).toContain('--thinking');
    expect(args).not.toContain('--no-thinking');
  });

  it('adds --no-thinking when thinking=false', () => {
    const args = buildKimiArgs({ prompt: 'test', thinking: false });
    expect(args).toContain('--no-thinking');
    expect(args).not.toContain('--thinking');
  });

  it('adds --no-thinking when thinking is undefined', () => {
    const args = buildKimiArgs({ prompt: 'test' });
    expect(args).toContain('--no-thinking');
  });

  it('adds --work-dir when workDir is provided', () => {
    const args = buildKimiArgs({ prompt: 'test', workDir: '/tmp' });
    expect(args).toContain('--work-dir');
    expect(args).toContain('/tmp');
  });

  it('adds --session when session is provided', () => {
    const args = buildKimiArgs({ prompt: 'test', session: 'abc123' });
    expect(args).toContain('--session');
    expect(args).toContain('abc123');
  });

  it('adds --continue when continueSession=true', () => {
    const args = buildKimiArgs({ prompt: 'test', continueSession: true });
    expect(args).toContain('--continue');
  });

  it('does not add --continue when continueSession is undefined', () => {
    const args = buildKimiArgs({ prompt: 'test' });
    expect(args).not.toContain('--continue');
  });

  it('adds --model when model is provided', () => {
    const args = buildKimiArgs({ prompt: 'test', model: 'moonshot-v1' });
    expect(args).toContain('--model');
    expect(args).toContain('moonshot-v1');
  });

  it('always ends with -p and the prompt', () => {
    const args = buildKimiArgs({
      prompt: 'hello world',
      thinking: true,
      workDir: '/tmp',
      session: 'sess1',
      model: 'moonshot-v1',
    });
    const lastTwo = args.slice(-2);
    expect(lastTwo).toEqual(['-p', 'hello world']);
  });
});

// Helper to create a mock child process
function createMockChild(): ChildProcess & { stdout: EventEmitter; stderr: EventEmitter } {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

describe('executeKimi', () => {
  let spawnMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv('KIMI_CLI_PATH', '/usr/bin/kimi');
    const cp = await import('node:child_process');
    spawnMock = cp.spawn as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('resolves with parsed output on success', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = executeKimi({ prompt: 'test' });

    // Simulate kimi CLI output
    child.stdout.emit('data', Buffer.from("TextPart(type='text', text='Hello')"));
    child.emit('close', 0);

    const result = await promise;
    expect(result.text).toBe('Hello');
  });

  it('rejects on non-zero exit code', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = executeKimi({ prompt: 'test' });

    child.stderr.emit('data', Buffer.from('something went wrong'));
    child.emit('close', 1);

    await expect(promise).rejects.toThrow('Kimi CLI exited with code 1');
  });

  it('rejects on spawn error (binary not found)', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = executeKimi({ prompt: 'test' });

    child.emit('error', new Error('spawn ENOENT'));

    await expect(promise).rejects.toThrow('Failed to execute Kimi CLI: spawn ENOENT');
  });

  it('rejects on timeout', async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = executeKimi({ prompt: 'test', timeout: 1 });

    // Advance past the 1-second timeout
    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow('timed out after 1 seconds');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    vi.useRealTimers();
  });

  it('does not double-reject after timeout when close fires', async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = executeKimi({ prompt: 'test', timeout: 1 });

    // Trigger timeout
    vi.advanceTimersByTime(1100);

    // Now close fires after kill — should not cause unhandled rejection
    child.emit('close', null);

    await expect(promise).rejects.toThrow('timed out');

    vi.useRealTimers();
  });
});
