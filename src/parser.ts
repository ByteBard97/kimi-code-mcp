import type { KimiOutput } from './cli.js';

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

  return {
    text,
    thinking,
    raw,
  };
}
