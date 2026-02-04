import { describe, it, expect } from 'vitest';
import { TOOLS, TOOL_MAP } from '../handlers.js';

describe('TOOLS', () => {
  it('has exactly 14 tools', () => {
    expect(TOOLS).toHaveLength(14);
  });

  it('all tools have name, description, and inputSchema', () => {
    for (const tool of TOOLS) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);

      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);

      expect(tool.inputSchema).toBeDefined();
    }
  });
});

describe('TOOL_MAP', () => {
  it('contains all 14 tools', () => {
    expect(TOOL_MAP.size).toBe(14);
  });

  it('maps each tool name to the correct tool', () => {
    for (const tool of TOOLS) {
      expect(TOOL_MAP.has(tool.name)).toBe(true);
      expect(TOOL_MAP.get(tool.name)).toBe(tool);
    }
  });
});
