import { describe, it, expect } from 'vitest';
import { extractTextParts, extractThinkParts, extractPlainText, parseKimiOutput } from '../parser.js';
import {
  SIMPLE_TEXT_OUTPUT,
  MULTI_TEXT_OUTPUT,
  THINKING_OUTPUT,
  PLAIN_TEXT_OUTPUT,
  EMPTY_OUTPUT,
  ESCAPED_OUTPUT,
} from './mocks.js';

describe('extractTextParts', () => {
  it('extracts text from a single TextPart block', () => {
    const parts = extractTextParts(SIMPLE_TEXT_OUTPUT);
    expect(parts).toEqual(['Hello, world!']);
  });

  it('extracts text from multiple TextPart blocks', () => {
    const parts = extractTextParts(MULTI_TEXT_OUTPUT);
    expect(parts).toEqual(['First part. ', 'Second part. ', 'Third part.']);
  });

  it('handles escaped characters in TextPart', () => {
    const parts = extractTextParts(ESCAPED_OUTPUT);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('\n');
    expect(parts[0]).toContain("'");
    expect(parts[0]).toContain('"');
  });

  it('returns empty array when no TextParts are present', () => {
    const parts = extractTextParts(PLAIN_TEXT_OUTPUT);
    expect(parts).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    const parts = extractTextParts(EMPTY_OUTPUT);
    expect(parts).toEqual([]);
  });

  it('preserves literal backslash-n (\\\\n) as two characters', () => {
    // Input: \\n in the raw CLI output represents a literal backslash followed by 'n'
    const raw = `TextPart(type='text', text='path\\\\nname')`;
    const parts = extractTextParts(raw);
    expect(parts).toEqual(['path\\nname']); // backslash + 'n', not a newline
  });
});

describe('extractThinkParts', () => {
  it('extracts thinking from ThinkPart blocks', () => {
    const parts = extractThinkParts(THINKING_OUTPUT);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe('Let me analyze this step by step...');
  });

  it('returns empty array for non-thinking output', () => {
    const parts = extractThinkParts(SIMPLE_TEXT_OUTPUT);
    expect(parts).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    const parts = extractThinkParts(EMPTY_OUTPUT);
    expect(parts).toEqual([]);
  });
});

describe('extractPlainText', () => {
  it('filters out structured lines and keeps real content', () => {
    const lines = extractPlainText(PLAIN_TEXT_OUTPUT);
    expect(lines).toEqual([
      'This is plain text output',
      'that spans multiple lines.',
    ]);
  });

  it('filters out TurnBegin, StepBegin, StepEnd, TurnEnd lines', () => {
    const lines = extractPlainText(SIMPLE_TEXT_OUTPUT);
    // TextPart line is not in skipPrefixes, so it remains
    // but TurnBegin, StepBegin, StepEnd, TurnEnd are filtered
    for (const line of lines) {
      expect(line).not.toMatch(/^TurnBegin/);
      expect(line).not.toMatch(/^StepBegin/);
      expect(line).not.toMatch(/^StepEnd/);
      expect(line).not.toMatch(/^TurnEnd/);
    }
  });

  it('filters out ThinkPart and indented key= lines', () => {
    const lines = extractPlainText(THINKING_OUTPUT);
    for (const line of lines) {
      expect(line).not.toMatch(/^ThinkPart/);
      expect(line).not.toMatch(/^\s+type='/);
      expect(line).not.toMatch(/^\s+think='/);
      expect(line).not.toMatch(/^\s+encrypted=/);
    }
  });

  it('returns empty array for empty input', () => {
    const lines = extractPlainText(EMPTY_OUTPUT);
    expect(lines).toEqual([]);
  });
});

describe('parseKimiOutput', () => {
  it('parses output with both text and thinking', () => {
    const result = parseKimiOutput(THINKING_OUTPUT);
    expect(result.text).toBe('The answer is 42.');
    expect(result.thinking).toBe('Let me analyze this step by step...');
    expect(result.raw).toBe(THINKING_OUTPUT);
  });

  it('parses text-only output', () => {
    const result = parseKimiOutput(SIMPLE_TEXT_OUTPUT);
    expect(result.text).toBe('Hello, world!');
    expect(result.thinking).toBeUndefined();
    expect(result.raw).toBe(SIMPLE_TEXT_OUTPUT);
  });

  it('concatenates multiple text parts', () => {
    const result = parseKimiOutput(MULTI_TEXT_OUTPUT);
    expect(result.text).toBe('First part. Second part. Third part.');
    expect(result.thinking).toBeUndefined();
  });

  it('falls back to plain text when no TextParts found', () => {
    const result = parseKimiOutput(PLAIN_TEXT_OUTPUT);
    expect(result.text).toContain('This is plain text output');
    expect(result.text).toContain('that spans multiple lines.');
    expect(result.thinking).toBeUndefined();
  });

  it('returns empty text for empty input', () => {
    const result = parseKimiOutput(EMPTY_OUTPUT);
    expect(result.text).toBe('');
    expect(result.thinking).toBeUndefined();
    expect(result.raw).toBe('');
  });
});
