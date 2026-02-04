# CLAUDE.md

## Project Overview

`kimi-code-mcp` is an MCP (Model Context Protocol) server that wraps the [Kimi Code CLI](https://github.com/MoonshotAI/kimi-cli) (kimi-k2.5). It exposes 14 tools over stdio for filesystem, shell, web, and agent operations.

## Architecture

4 source files, no external runtime dependencies beyond `@modelcontextprotocol/sdk` and `zod`:

```
src/
  index.ts     — MCP server entry point (shebang, stdio transport, zodToJsonSchema, request handlers)
  handlers.ts  — TOOLS array (14 tool definitions with Zod schemas), TOOL_MAP, handleToolCall, buildPrompt
  cli.ts       — findKimiCli, buildKimiArgs, executeKimi (spawns kimi CLI as child process)
  parser.ts    — parseKimiOutput, extractTextParts, extractThinkParts, extractPlainText
```

**Data flow:** MCP request → `index.ts` validates with Zod → `handleToolCall` in `handlers.ts` builds a natural language prompt → `executeKimi` in `cli.ts` spawns `kimi --print -y -p <prompt>` → `parser.ts` extracts TextPart/ThinkPart from CLI output → result returned as MCP text content.

## Key Design Decisions

- **No shell execution in spawn**: `cli.ts` uses `spawn(binary, argsArray)` with no `shell: true` — prevents command injection.
- **Single-pass regex for unescaping**: `parser.ts` uses `str.replace(/\\(\\|n|'|")/g, ...)` instead of chained `.replace()` calls to avoid ordering bugs (e.g., `\\n` must stay as literal backslash-n, not become a newline).
- **Timeout double-reject guard**: `executeKimi` uses a `killed` flag so the `close` event handler no-ops after a timeout kill.
- **`zodToJsonSchema` is inlined**: A minimal Zod-to-JSON-Schema converter lives in `index.ts` — handles string, number, boolean, enum, optional, and `.describe()`. No need for a full library.
- **`KIMI_CLI_PATH` must be absolute**: Uses `path.isAbsolute()` to reject relative paths.

## Build & Test

```bash
npm install
npm run build    # tsc → dist/
npm test         # vitest run (68 tests)
```

Tests live in `src/__tests__/`. Test files are excluded from `tsconfig.json` and the npm tarball.

## Environment Variables

- `KIMI_CLI_PATH` — absolute path to the kimi binary (default: `kimi` from PATH)
- `MCP_KIMI_DEBUG` — set to any value to enable debug logging to stderr

## Contributing

- **Keep it minimal** — this repo intentionally has 4 source files. Don't add files unless strictly necessary. Prefer editing existing files over creating new ones.
- **No over-engineering** — no classes, no decorators, no abstractions for one-time operations. Plain functions and const arrays.
- **Tests required** — every new or changed export must have tests in `src/__tests__/`. Run `npm test` before submitting.
- **No new runtime dependencies** — the only runtime deps are `@modelcontextprotocol/sdk` and `zod`. Think hard before adding another.
- **Security matters** — never use `shell: true` in spawn, never interpolate user input into shell commands, validate all paths.
- **Adding a new tool** — add the tool definition to the `TOOLS` array in `handlers.ts`, add its prompt builder case to `buildPrompt` in the same file, then add tests in `src/__tests__/handlers.test.ts`. Update the tool count in `src/__tests__/schema.test.ts`.

## Conventions

- TypeScript strict mode, ES2022 target, NodeNext module resolution
- ESM only (`"type": "module"` in package.json, `.js` extensions in imports)
- No decorators, no classes — plain functions and const arrays
- Tests use vitest with `vi.mock` for child_process and fs mocking
- Commit messages should not mention AI authorship
