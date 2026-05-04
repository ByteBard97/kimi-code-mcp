import { z } from 'zod';
import { executeKimi } from './cli.js';
import { existsSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';

const USAGE_LOG_PATH = process.env.KIMI_USAGE_LOG || `${homedir()}/.kimi-usage-tracking.jsonl`;

interface UsageEntry {
  timestamp: string;
  project: string;
  tool: string;
  workDir: string;
  input_other: number | null;
  input_cache_read: number | null;
  input_cache_creation: number | null;
  output: number | null;
  context_tokens: number | null;
  total_tokens: number;
}

function logUsage(
  toolName: string,
  args: Record<string, unknown>,
  tokenUsage: import('./cli.js').TokenUsage | null | undefined,
  contextTokens: number | null | undefined
): void {
  if (!tokenUsage) return;

  const workDir = (args.workFolder as string) || process.cwd();

  // Derive project name from workDir (last meaningful dir component)
  const parts = workDir.split('/').filter(Boolean);
  const project = parts.length > 0 ? parts[parts.length - 1] : 'unknown';

  const entry: UsageEntry = {
    timestamp: new Date().toISOString(),
    project,
    tool: toolName,
    workDir,
    input_other: tokenUsage.input_other ?? null,
    input_cache_read: tokenUsage.input_cache_read ?? null,
    input_cache_creation: tokenUsage.input_cache_creation ?? null,
    output: tokenUsage.output ?? null,
    context_tokens: contextTokens ?? null,
    total_tokens:
      contextTokens ??
      ((tokenUsage.input_other || 0) +
        (tokenUsage.input_cache_read || 0) +
        (tokenUsage.output || 0)),
  };

  try {
    appendFileSync(USAGE_LOG_PATH, JSON.stringify(entry) + '\n');
  } catch {
    // Silent fail — don't break tool execution for logging
  }
}

export const TOOLS = [
  {
    name: 'kimi_read_file',
    description: 'Read a text file. Returns file content up to 1000 lines.',
    inputSchema: z.object({
      path: z.string().describe('Absolute file path to read'),
      offset: z.number().optional().describe('Line offset to start from (0-based)'),
      limit: z.number().optional().describe('Max lines to read (default: 1000)'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
  {
    name: 'kimi_read_media',
    description: 'Analyze images and videos using multimodal capabilities.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to image or video file'),
      prompt: z.string().optional().describe('Analysis prompt for the media'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
  {
    name: 'kimi_write_file',
    description: 'Create or overwrite a file with specified content.',
    inputSchema: z.object({
      path: z.string().describe('Absolute file path to write'),
      content: z.string().describe('Content to write to the file'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
  {
    name: 'kimi_edit_file',
    description: 'Edit a file by replacing an exact string with new content.',
    inputSchema: z.object({
      path: z.string().describe('Absolute file path to edit'),
      old_string: z.string().describe('Exact string to find and replace'),
      new_string: z.string().describe('New string to replace with'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
  {
    name: 'kimi_glob',
    description: 'Find files matching a glob pattern.',
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern to match (e.g., "**/*.ts")'),
      path: z.string().optional().describe('Directory to search in (default: current directory)'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
  {
    name: 'kimi_grep',
    description: 'Search for regex patterns in files using ripgrep.',
    inputSchema: z.object({
      pattern: z.string().describe('Regex pattern to search for'),
      path: z.string().optional().describe('Directory or file to search in (default: current directory)'),
      include: z.string().optional().describe('File pattern to include (e.g., "*.ts")'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
  {
    name: 'kimi_shell',
    description: 'Execute shell commands and return output.',
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
      timeout: z.number().optional().describe('Timeout in seconds (default: 120)'),
    }),
  },
  {
    name: 'kimi_web_search',
    description: 'Search the web and return up to 20 results.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      include_content: z.boolean().optional().describe('Include page content in results'),
    }),
  },
  {
    name: 'kimi_fetch_url',
    description: 'Fetch and extract text content from a webpage.',
    inputSchema: z.object({
      url: z.string().describe('URL to fetch'),
      prompt: z.string().optional().describe('Extraction prompt for the webpage'),
    }),
  },
  {
    name: 'kimi_agent',
    description: 'Full autonomous agent for complex multi-step tasks.',
    inputSchema: z.object({
      prompt: z.string().describe('Task description for the agent'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
      timeout: z.number().optional().describe('Timeout in seconds (default: 300)'),
    }),
  },
  {
    name: 'kimi_think',
    description: 'Extended reasoning and analysis without taking actions.',
    inputSchema: z.object({
      problem: z.string().describe('Problem or question to analyze'),
      context: z.string().optional().describe('Additional context for reasoning'),
    }),
  },
  {
    name: 'kimi_review',
    description: 'Code review analyzing bugs, security, performance, and style.',
    inputSchema: z.object({
      code_or_path: z.string().describe('Code snippet or file path to review'),
      focus: z.enum(['bugs', 'security', 'performance', 'style', 'all']).optional().describe('Review focus area (default: all)'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
  {
    name: 'kimi_research',
    description: 'Research and analysis with 256K context window.',
    inputSchema: z.object({
      question: z.string().describe('Research question or topic'),
      context: z.string().optional().describe('Additional context or background'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
  {
    name: 'kimi_test',
    description: 'Generate or fix comprehensive tests with edge cases.',
    inputSchema: z.object({
      target: z.string().describe('Code or file path to generate tests for'),
      instructions: z.string().optional().describe('Specific testing instructions'),
      workFolder: z.string().optional().describe('Working directory (absolute path)'),
    }),
  },
] as const;

export const TOOL_MAP = new Map<string, typeof TOOLS[number]>(TOOLS.map(t => [t.name, t]));

export async function handleToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
  const prompt = buildPrompt(toolName, args);
  const thinking = toolName === 'kimi_think';
  const timeout = (typeof args.timeout === 'number' ? args.timeout : (toolName === 'kimi_agent' ? 300 : 120));

  const output = await executeKimi({
    prompt,
    workDir: args.workFolder as string | undefined,
    thinking,
    timeout,
  });

  logUsage(toolName, args, output.tokenUsage, output.contextTokens);

  if (toolName === 'kimi_think' && output.thinking) {
    return `## Reasoning\n\n${output.thinking}\n\n## Response\n\n${output.text}`;
  }

  return output.text || '(no output)';
}

export function buildPrompt(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'kimi_read_file': {
      const path = args.path as string;
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;
      let prompt = `Read the file at ${path}`;
      if (offset !== undefined) {
        prompt += ` from line ${offset}`;
      }
      if (limit !== undefined) {
        prompt += `, up to ${limit} lines`;
      }
      prompt += '. Output the file content.';
      return prompt;
    }

    case 'kimi_read_media': {
      const path = args.path as string;
      const userPrompt = args.prompt as string | undefined;
      return `Read the media file at ${path}. ${userPrompt || 'Describe this media file in detail.'}`;
    }

    case 'kimi_write_file': {
      const path = args.path as string;
      const content = args.content as string;
      return `Write the following content to the file ${path}:\n\n${content}`;
    }

    case 'kimi_edit_file': {
      const path = args.path as string;
      const oldString = args.old_string as string;
      const newString = args.new_string as string;
      return `In the file ${path}, find the exact string:\n\`\`\`\n${oldString}\n\`\`\`\n\nAnd replace it with:\n\`\`\`\n${newString}\n\`\`\``;
    }

    case 'kimi_glob': {
      const pattern = args.pattern as string;
      const path = args.path as string | undefined;
      return `Find all files matching the glob pattern '${pattern}' under ${path || '.'}. List the matching file paths.`;
    }

    case 'kimi_grep': {
      const pattern = args.pattern as string;
      const path = args.path as string | undefined;
      const include = args.include as string | undefined;
      let prompt = `Search for the regex pattern '${pattern}' in files under ${path || '.'}.`;
      if (include) {
        prompt += ` Only search in files matching '${include}'.`;
      }
      prompt += ' Show matching lines with file paths and line numbers.';
      return prompt;
    }

    case 'kimi_shell': {
      const command = args.command as string;
      return `Execute this shell command and show the output:\n\`\`\`\n${command}\n\`\`\``;
    }

    case 'kimi_web_search': {
      const query = args.query as string;
      const includeContent = args.include_content as boolean | undefined;
      let prompt = `Search the web for: ${query}`;
      if (includeContent) {
        prompt += '\n\nInclude page content in the results.';
      }
      return prompt;
    }

    case 'kimi_fetch_url': {
      const url = args.url as string;
      const userPrompt = args.prompt as string | undefined;
      return `Fetch the webpage at ${url}. ${userPrompt || 'Extract and return the main text content.'}`;
    }

    case 'kimi_agent': {
      return args.prompt as string;
    }

    case 'kimi_think': {
      const problem = args.problem as string;
      const context = args.context as string | undefined;
      let prompt = 'Think deeply about this problem. Do NOT execute any file operations or commands. Only reason and analyze.\n\n';
      prompt += `Problem: ${problem}`;
      if (context) {
        prompt += `\n\nContext: ${context}`;
      }
      return prompt;
    }

    case 'kimi_review': {
      const codeOrPath = args.code_or_path as string;
      const focus = (args.focus as string | undefined) || 'all';
      const isFile = existsSync(codeOrPath);

      let prompt = isFile
        ? `Review the code in file ${codeOrPath}`
        : `Review the following code:\n\n\`\`\`\n${codeOrPath}\n\`\`\``;

      if (focus === 'all') {
        prompt += '\n\nAnalyze for bugs, security issues, performance problems, and style concerns.';
      } else {
        prompt += `\n\nFocus specifically on ${focus}.`;
      }

      return prompt;
    }

    case 'kimi_research': {
      const question = args.question as string;
      const context = args.context as string | undefined;
      let prompt = `Research thoroughly:\n\n${question}`;
      if (context) {
        prompt += `\n\nAdditional context:\n${context}`;
      }
      return prompt;
    }

    case 'kimi_test': {
      const target = args.target as string;
      const instructions = args.instructions as string | undefined;
      let prompt = `Write comprehensive tests for: ${target}`;
      if (instructions) {
        prompt += `\n\nInstructions: ${instructions}`;
      }
      prompt += '\n\nInclude edge cases and error scenarios.';
      return prompt;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
