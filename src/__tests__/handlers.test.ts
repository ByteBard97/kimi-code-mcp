import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../handlers.js';

describe('buildPrompt', () => {
  it('builds kimi_read_media prompt with default description', () => {
    const prompt = buildPrompt('kimi_read_media', { path: '/img.png' });
    expect(prompt).toContain('/img.png');
    expect(prompt).toContain('Describe this media file');
  });

  it('builds kimi_read_media prompt with custom prompt', () => {
    const prompt = buildPrompt('kimi_read_media', { path: '/img.png', prompt: 'Count the cats' });
    expect(prompt).toContain('Count the cats');
  });

  it('builds kimi_web_search prompt', () => {
    const prompt = buildPrompt('kimi_web_search', { query: 'vitest mocking' });
    expect(prompt).toContain('vitest mocking');
  });

  it('builds kimi_web_search prompt with include_content', () => {
    const prompt = buildPrompt('kimi_web_search', { query: 'test', include_content: true });
    expect(prompt).toContain('Include page content');
  });

  it('builds kimi_fetch_url prompt', () => {
    const prompt = buildPrompt('kimi_fetch_url', { url: 'https://example.com' });
    expect(prompt).toContain('https://example.com');
  });

  it('builds kimi_fetch_url prompt with custom prompt', () => {
    const prompt = buildPrompt('kimi_fetch_url', { url: 'https://example.com', prompt: 'Get title' });
    expect(prompt).toContain('Get title');
  });

  it('builds kimi_agent prompt', () => {
    const prompt = buildPrompt('kimi_agent', { prompt: 'Do the thing' });
    expect(prompt).toContain('Do the thing');
  });

  it('builds kimi_think prompt', () => {
    const prompt = buildPrompt('kimi_think', { problem: 'Why is X slow?' });
    expect(prompt).toContain('Why is X slow?');
    expect(prompt).toContain('Think deeply');
  });

  it('builds kimi_think prompt with context', () => {
    const prompt = buildPrompt('kimi_think', { problem: 'X', context: 'extra info' });
    expect(prompt).toContain('extra info');
  });

  it('builds kimi_review prompt for code snippet', () => {
    const prompt = buildPrompt('kimi_review', { code_or_path: 'const x = 1;' });
    expect(prompt).toContain('const x = 1;');
    expect(prompt).toContain('bugs');
  });

  it('builds kimi_review prompt with focus', () => {
    const prompt = buildPrompt('kimi_review', { code_or_path: 'const x = 1;', focus: 'security' });
    expect(prompt).toContain('security');
    expect(prompt).not.toContain('bugs, security, performance');
  });

  it('builds kimi_research prompt', () => {
    const prompt = buildPrompt('kimi_research', { question: 'How does X work?' });
    expect(prompt).toContain('How does X work?');
  });

  it('builds kimi_research prompt with context', () => {
    const prompt = buildPrompt('kimi_research', { question: 'Q', context: 'background' });
    expect(prompt).toContain('background');
  });

  it('builds kimi_test prompt', () => {
    const prompt = buildPrompt('kimi_test', { target: 'src/cli.ts' });
    expect(prompt).toContain('src/cli.ts');
    expect(prompt).toContain('edge cases');
  });

  it('builds kimi_test prompt with instructions', () => {
    const prompt = buildPrompt('kimi_test', { target: 'src/cli.ts', instructions: 'Use vitest' });
    expect(prompt).toContain('Use vitest');
  });

  it('throws for unknown tool', () => {
    expect(() => buildPrompt('kimi_nonexistent', {})).toThrow('Unknown tool: kimi_nonexistent');
  });
});
