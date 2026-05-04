#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import { TOOLS, TOOL_MAP, handleToolCall } from './handlers.js';
import { VERSION } from './version.js';

const server = new Server(
  { name: 'kimi-code-mcp', version: VERSION },
  { capabilities: { tools: {} } },
);

function zodToJsonSchema(schema: z.ZodObject<any>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodValue = value as z.ZodTypeAny;
    const prop: Record<string, unknown> = {};

    let inner = zodValue;
    let isOptional = false;
    if (inner._def.typeName === 'ZodOptional') {
      isOptional = true;
      inner = inner._def.innerType;
    }

    switch (inner._def.typeName) {
      case 'ZodString':
        prop.type = 'string';
        break;
      case 'ZodNumber':
        prop.type = 'number';
        break;
      case 'ZodBoolean':
        prop.type = 'boolean';
        break;
      case 'ZodEnum':
        prop.type = 'string';
        prop.enum = inner._def.values;
        break;
      default:
        prop.type = 'string';
    }

    if (inner._def.description) {
      prop.description = inner._def.description;
    } else if (zodValue._def.description) {
      prop.description = zodValue._def.description;
    }

    properties[key] = prop;

    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;

  const tool = TOOL_MAP.get(name);
  if (!tool) {
    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const args = tool.inputSchema.parse(rawArgs ?? {});
    const result = await handleToolCall(name, args as Record<string, unknown>);
    return {
      content: [{ type: 'text' as const, text: result }],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`kimi-code-mcp v${VERSION} started`);
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
