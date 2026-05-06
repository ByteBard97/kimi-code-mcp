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
 * Extracts text from TextPart(...) blocks in kimi CLI output.
 * Handles both legacy single-line format and Kimi 1.41.0+ multi-line format.
 */
export function extractTextParts(raw: string): string[] {
  const textPartRegex = /TextPart\(\s*type='text',\s*text='((?:[^'\\]|\\.)*)'\s*\)/gs;
  const parts: string[] = [];

  let match;
  while ((match = textPartRegex.exec(raw)) !== null) {
    parts.push(unescapeString(match[1]));
  }

  return parts;
}

/**
 * Extracts thinking from ThinkPart(...) blocks in kimi CLI output.
 * Handles both single-quote (legacy) and double-quote (Kimi 1.41.0+) think field,
 * and both single-line and multi-line formatting.
 */
export function extractThinkParts(raw: string): string[] {
  // Kimi 1.41.0+ uses double quotes for the think field; older versions used single quotes
  const thinkPartRegex = /ThinkPart\(\s*type='think',\s*think=(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,?\s*encrypted=/gs;
  const parts: string[] = [];

  let match;
  while ((match = thinkPartRegex.exec(raw)) !== null) {
    // match[1] = single-quote capture, match[2] = double-quote capture
    parts.push(unescapeString(match[1] ?? match[2] ?? ''));
  }

  return parts;
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
    'MCPLoadingBegin',
    'MCPLoadingEnd',
    'MCPServerSnapshot',
    'TextPart',
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
 * Parses Kimi CLI output when using --output-format stream-json --final-message-only.
 * The output is one JSON line: {"role":"assistant","content":[...]}
 * content can be a string or an array of {type, text/think} objects.
 */
export function parseKimiJsonOutput(raw: string): { text: string; thinking?: string } | null {
  const lines = raw.trim().split('\n').filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) continue;

    try {
      const parsed = JSON.parse(line);

      if (parsed.role === 'assistant' && parsed.content !== undefined) {
        if (typeof parsed.content === 'string') {
          return { text: parsed.content };
        }
        if (Array.isArray(parsed.content)) {
          let text = '';
          let thinking = '';
          for (const part of parsed.content) {
            if (part.type === 'text' && part.text) text += part.text;
            if (part.type === 'think' && part.think) thinking += part.think;
          }
          return { text, thinking: thinking || undefined };
        }
      }
    } catch {
      // not valid JSON, skip
    }
  }

  return null;
}

/**
 * Parses kimi CLI verbose output into structured format
 */
export function parseKimiOutput(raw: string): KimiOutput {
  // Try JSON format first (when --output-format stream-json is used)
  const jsonResult = parseKimiJsonOutput(raw);
  if (jsonResult) {
    return {
      text: jsonResult.text,
      thinking: jsonResult.thinking,
      raw,
      tokenUsage: extractTokenUsage(raw),
      contextTokens: extractContextTokens(raw),
    };
  }

  // Fallback to Python-style repr parsing
  let textParts = extractTextParts(raw);

  if (textParts.length === 0) {
    textParts = extractPlainText(raw);
  }

  const text = textParts.join('');

  const thinkParts = extractThinkParts(raw);
  const thinking = thinkParts.length > 0 ? thinkParts.join('\n\n') : undefined;

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
