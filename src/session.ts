/**
 * Session manager for Kimi CLI persistence per workDir.
 *
 * Generates stable session IDs per working directory and tracks them
 * in ~/.kimi-sessions.json so subsequent calls can use --continue.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const SESSION_STORE_PATH = `${homedir()}/.kimi-sessions.json`;

interface SessionStore {
  [workDir: string]: {
    sessionId: string;
    lastUsed: string;
  };
}

function loadStore(): SessionStore {
  try {
    if (existsSync(SESSION_STORE_PATH)) {
      return JSON.parse(readFileSync(SESSION_STORE_PATH, 'utf-8'));
    }
  } catch {
    // ignore corrupt store
  }
  return {};
}

function saveStore(store: SessionStore): void {
  try {
    writeFileSync(SESSION_STORE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // silent fail
  }
}

function hashWorkDir(workDir: string): string {
  return createHash('sha256').update(workDir).digest('hex').slice(0, 16);
}

export function getSessionId(workDir: string | undefined): string | undefined {
  if (!workDir) return undefined;
  const store = loadStore();
  const entry = store[workDir];
  return entry?.sessionId;
}

export function isNewSession(workDir: string | undefined): boolean {
  if (!workDir) return true;
  const store = loadStore();
  return !store[workDir];
}

export function saveSessionId(workDir: string | undefined, sessionId: string | undefined): void {
  if (!workDir || !sessionId) return;
  const store = loadStore();
  store[workDir] = {
    sessionId,
    lastUsed: new Date().toISOString(),
  };
  saveStore(store);
}

export function extractSessionIdFromStderr(stderr: string): string | undefined {
  // Match: "To resume this session: kimi -r <uuid>"
  const match = stderr.match(/kimi\s+-r\s+([a-f0-9-]{36})/i);
  return match ? match[1] : undefined;
}
