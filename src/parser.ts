import type { KimiOutput, TokenUsage } from './cli.js';

/**
 * Unescapes Python string literals found in kimi CLI output
 */
function unescapeString(str: string): string {
  return str.replace(/\\(\\|n|'|")/g, (_, ch) => {
    switch (ch) {
      case '\\': return '\\';
      case 'n': return '\n';
      case "'": return "'";
      case '"': return '"';
      default: return ch;
    }
  });
}

/**
 * Extracts text from TextPart(...) blocks in kimi CLI output
 */
export function extractTextParts(raw: string): string[] {
  const textPartRegex = /TextPart\(type='text',\s*text='((?:[^'\\]|\\.)*)'\)/gs;
  const parts: string[] = [];

  let match;
  while ((match = textPartRegex.exec(raw)) !== null) {
    parts.push(unescapeString(match[1]));
  }

  return parts;
}

/**
 * Extracts thinking from ThinkPart(...) blocks in kimi CLI output
 */
export function extractThinkParts(raw: string): string[] {
  const thinkPartRegex = /ThinkPart\(\s*type='think',\s*think='((?:[^'\\]|\\.)*)',\s*encrypted=/gs;
  const parts: string[] = [];

  let match;
  while ((match = thinkPartRegex.exec(raw)) !== null) {
    parts.push(unescapeString(match[1]));
  }

  return parts;
}

/**
 * Extracts plain text by filtering out structured kimi CLI lines
 */
export function extractPlainText(raw: string): string[] {
  const lines = raw.split('\n');
  const filtered: string[] = [];

  const skipPrefixes = [
    'TurnBegin',
    'TurnEnd',
    'StepBegin',
    'StepEnd',
    'StatusUpdate',
    'TokenUsage',
    'ToolUseBegin',
    'ToolUseEnd',
    'ToolResultPart',
    'ErrorPart',
    'ThinkPart',
  ];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip lines starting with known prefixes
    if (skipPrefixes.some(prefix => trimmed.startsWith(prefix))) continue;

    // Skip lines starting with ( or )
    if (trimmed.startsWith('(') || trimmed.startsWith(')')) continue;

    // Skip 4-space-indented key= patterns
    if (line.startsWith('    ') && /^\s+\w+=/.test(line)) continue;

    filtered.push(line);
  }

  return filtered;
}

/**
 * Extracts token usage from TokenUsage(...) blocks in kimi CLI output
 */
export function extractTokenUsage(raw: string): TokenUsage | null {
  const tokenUsageRegex = /TokenUsage\(\s*([^)]*?)\s*\)/gs;
  let lastMatch: string | null = null;

  let match;
  while ((match = tokenUsageRegex.exec(raw)) !== null) {
    lastMatch = match[1];
  }

  if (!lastMatch) return null;

  const result: Partial<TokenUsage> = {};
  const kvRegex = /(\w+)\s*=\s*(\d+)/g;

  let kv;
  while ((kv = kvRegex.exec(lastMatch)) !== null) {
    result[kv[1] as keyof TokenUsage] = parseInt(kv[2], 10);
  }

  return result as TokenUsage;
}

/**
 * Extracts context_tokens from the last StatusUpdate in kimi CLI output
 */
export function extractContextTokens(raw: string): number | null {
  const statusRegex = /StatusUpdate\(\s*([^)]*token_usage[^)]*)\s*\)/gs;
  let lastMatch: string | null = null;

  let match;
  while ((match = statusRegex.exec(raw)) !== null) {
    lastMatch = match[1];
  }

  if (!lastMatch) return null;

  const contextTokensMatch = lastMatch.match(/context_tokens=(\d+)/);
  return contextTokensMatch ? parseInt(contextTokensMatch[1], 10) : null;
}

/**
 * Parses kimi CLI verbose output into structured format
 */
export function parseKimiOutput(raw: string): KimiOutput {
  // Extract text parts
  let textParts = extractTextParts(raw);

  // Fallback to plain text if no TextParts found
  if (textParts.length === 0) {
    textParts = extractPlainText(raw);
  }

  const text = textParts.join('');

  // Extract thinking parts
  const thinkParts = extractThinkParts(raw);
  const thinking = thinkParts.length > 0 ? thinkParts.join('\n\n') : undefined;

  // Extract token usage
  const tokenUsage = extractTokenUsage(raw);
  const contextTokens = extractContextTokens(raw);

  return {
    text,
    thinking,
    raw,
    tokenUsage,
    contextTokens,
  };
}
