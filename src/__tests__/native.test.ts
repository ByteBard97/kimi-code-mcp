import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { nativeReadFile, nativeWriteFile, nativeEditFile, nativeGlob, nativeGrep, nativeShell, handleNativeTool } from '../native.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

type MockFn = ReturnType<typeof vi.fn>;

function createMockChild(): ChildProcess & { stdout: EventEmitter; stderr: EventEmitter } {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('nativeReadFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads file and returns content', () => {
    (readFileSync as MockFn).mockReturnValue('line1\nline2\nline3');
    const result = nativeReadFile({ path: '/foo.ts' });
    expect(result).toBe('line1\nline2\nline3');
    expect(readFileSync).toHaveBeenCalledWith('/foo.ts', 'utf8');
  });

  it('applies offset', () => {
    (readFileSync as MockFn).mockReturnValue('a\nb\nc\nd');
    const result = nativeReadFile({ path: '/f.ts', offset: 2 });
    expect(result).toBe('c\nd');
  });

  it('applies limit', () => {
    (readFileSync as MockFn).mockReturnValue('a\nb\nc\nd\ne');
    const result = nativeReadFile({ path: '/f.ts', limit: 2 });
    expect(result).toContain('a\nb');
    expect(result).toContain('truncated');
  });

  it('applies offset and limit together', () => {
    (readFileSync as MockFn).mockReturnValue('a\nb\nc\nd\ne');
    const result = nativeReadFile({ path: '/f.ts', offset: 1, limit: 2 });
    expect(result).toContain('b\nc');
  });

  it('does not add truncation notice when all lines fit', () => {
    (readFileSync as MockFn).mockReturnValue('a\nb');
    const result = nativeReadFile({ path: '/f.ts', limit: 100 });
    expect(result).not.toContain('truncated');
  });
});

describe('nativeWriteFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('writes content to file and returns success message', () => {
    const result = nativeWriteFile({ path: '/out.txt', content: 'hello' });
    expect(writeFileSync).toHaveBeenCalledWith('/out.txt', 'hello', 'utf8');
    expect(result).toContain('/out.txt');
    expect(result).toContain('5');
  });

  it('creates parent directory before writing', () => {
    nativeWriteFile({ path: '/new/dir/file.txt', content: 'x' });
    expect(mkdirSync).toHaveBeenCalledWith('/new/dir', { recursive: true });
  });
});

describe('nativeEditFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('replaces unique string and writes file', () => {
    (readFileSync as MockFn).mockReturnValue('foo bar baz');
    const result = nativeEditFile({ path: '/f.ts', old_string: 'bar', new_string: 'qux' });
    expect(writeFileSync).toHaveBeenCalledWith('/f.ts', 'foo qux baz', 'utf8');
    expect(result).toContain('/f.ts');
  });

  it('throws when string is not found', () => {
    (readFileSync as MockFn).mockReturnValue('foo bar baz');
    expect(() => nativeEditFile({ path: '/f.ts', old_string: 'xyz', new_string: 'abc' }))
      .toThrow('String not found');
  });

  it('throws when string is not unique', () => {
    (readFileSync as MockFn).mockReturnValue('foo foo foo');
    expect(() => nativeEditFile({ path: '/f.ts', old_string: 'foo', new_string: 'bar' }))
      .toThrow('not unique');
    expect(() => nativeEditFile({ path: '/f.ts', old_string: 'foo', new_string: 'bar' }))
      .toThrow('3 occurrences');
  });

  it('does not write file on error', () => {
    (readFileSync as MockFn).mockReturnValue('hello world');
    expect(() => nativeEditFile({ path: '/f.ts', old_string: 'nope', new_string: 'x' })).toThrow();
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});

describe('nativeGlob', () => {
  let spawnMock: MockFn;

  beforeEach(async () => {
    vi.resetAllMocks();
    const cp = await import('node:child_process');
    spawnMock = cp.spawn as unknown as MockFn;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns matching file paths', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeGlob({ pattern: '**/*.ts' });
    child.stdout.emit('data', Buffer.from('/a.ts\n/b.ts\n'));
    child.emit('close', 0);

    const result = await promise;
    expect(result).toBe('/a.ts\n/b.ts');
    expect(spawnMock).toHaveBeenCalledWith('rg', ['--files', '-g', '**/*.ts', '.'], expect.objectContaining({}));
  });

  it('returns (no results) when rg exits 1 (no matches)', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeGlob({ pattern: '**/*.ts' });
    child.emit('close', 1);

    const result = await promise;
    expect(result).toBe('(no results)');
  });

  it('uses provided path as search root', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeGlob({ pattern: '*.js', path: '/src' });
    child.emit('close', 1);
    await promise;

    expect(spawnMock).toHaveBeenCalledWith('rg', ['--files', '-g', '*.js', '/src'], expect.objectContaining({}));
  });

  it('rejects when rg exits with error code 2+', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeGlob({ pattern: '**/*.ts' });
    child.emit('close', 2);

    await expect(promise).rejects.toThrow('rg failed');
  });
});

describe('nativeGrep', () => {
  let spawnMock: MockFn;

  beforeEach(async () => {
    vi.resetAllMocks();
    const cp = await import('node:child_process');
    spawnMock = cp.spawn as unknown as MockFn;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns matching lines', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeGrep({ pattern: 'TODO' });
    child.stdout.emit('data', Buffer.from('foo.ts:12:TODO fix this\n'));
    child.emit('close', 0);

    const result = await promise;
    expect(result).toBe('foo.ts:12:TODO fix this');
  });

  it('returns (no matches) when rg exits 1', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeGrep({ pattern: 'TODO' });
    child.emit('close', 1);

    expect(await promise).toBe('(no matches)');
  });

  it('adds --glob flag when include is provided', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeGrep({ pattern: 'TODO', include: '*.ts' });
    child.emit('close', 1);
    await promise;

    expect(spawnMock).toHaveBeenCalledWith(
      'rg',
      expect.arrayContaining(['--glob', '*.ts']),
      expect.objectContaining({}),
    );
  });
});

describe('nativeShell', () => {
  let spawnMock: MockFn;

  beforeEach(async () => {
    vi.resetAllMocks();
    const cp = await import('node:child_process');
    spawnMock = cp.spawn as unknown as MockFn;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns stdout on success', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeShell({ command: 'echo hello' });
    child.stdout.emit('data', Buffer.from('hello\n'));
    child.emit('close', 0);

    expect(await promise).toBe('hello\n');
    expect(spawnMock).toHaveBeenCalledWith('bash', ['-c', 'echo hello'], expect.objectContaining({}));
  });

  it('returns output with exit code prefix on non-zero exit', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeShell({ command: 'exit 1' });
    child.stdout.emit('data', Buffer.from('some output'));
    child.emit('close', 1);

    const result = await promise;
    expect(result).toContain('[exit 1]');
    expect(result).toContain('some output');
  });

  it('includes stderr in output', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeShell({ command: 'bad cmd' });
    child.stderr.emit('data', Buffer.from('command not found'));
    child.emit('close', 127);

    const result = await promise;
    expect(result).toContain('command not found');
  });

  it('returns (no output) when command produces nothing', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child);

    const promise = nativeShell({ command: 'true' });
    child.emit('close', 0);

    expect(await promise).toBe('(no output)');
  });
});

describe('handleNativeTool', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('dispatches kimi_read_file to nativeReadFile', async () => {
    (readFileSync as MockFn).mockReturnValue('content');
    await expect(handleNativeTool('kimi_read_file', { path: '/f.ts' })).resolves.toBe('content');
  });

  it('throws for unknown native tool name', async () => {
    await expect(handleNativeTool('kimi_nonexistent', {})).rejects.toThrow('Not a native tool');
  });
});
