/**
 * Model resolver for Kimi CLI.
 *
 * Reads ~/.kimi/config.toml to discover configured models and builds
 * human-friendly aliases (k2.5, k1.5, small, medium, large, etc.)
 * that map to the actual model IDs the CLI expects.
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const CONFIG_PATH = `${homedir()}/.kimi/config.toml`;

interface KimiModelConfig {
  id: string;               // e.g. "kimi-code/kimi-for-coding"
  model: string;            // e.g. "kimi-for-coding"
  displayName: string;      // e.g. "Kimi-k2.6"
  maxContextSize: number;   // e.g. 262144
}

/** Manual aliases that override or supplement auto-detected ones */
const MANUAL_ALIASES: Record<string, string> = {
  // Common Kimi model nicknames → mapped to whatever model ID is configured
  // These are resolved at runtime against the actual config
  k2: 'kimi-code/kimi-for-coding',
  k25: 'kimi-code/kimi-for-coding',
  'k2.5': 'kimi-code/kimi-for-coding',
  k26: 'kimi-code/kimi-for-coding',
  'k2.6': 'kimi-code/kimi-for-coding',
  k1: 'kimi-code/kimi-for-coding',
  k15: 'kimi-code/kimi-for-coding',
  'k1.5': 'kimi-code/kimi-for-coding',
};

/**
 * Minimal TOML parser that extracts [models."..."] sections and their
 * display_name, model, and max_context_size fields.
 */
function parseConfigModels(): KimiModelConfig[] {
  if (!existsSync(CONFIG_PATH)) return [];

  const content = readFileSync(CONFIG_PATH, 'utf-8');
  const models: KimiModelConfig[] = [];

  const sectionRegex = /^\[models\."([^"]+)"\]\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(content)) !== null) {
    const id = match[1];
    const sectionStart = match.index + match[0].length;
    // Find next section header (line starting with [) — avoid matching [ inside arrays
    const nextSectionMatch = content.slice(sectionStart).match(/^\[[^\]]+\]\s*$/m);
    const sectionBody = nextSectionMatch
      ? content.slice(sectionStart, sectionStart + (nextSectionMatch.index ?? 0))
      : content.slice(sectionStart);

    const displayNameMatch = sectionBody.match(/display_name\s*=\s*"([^"]+)"/);
    const modelMatch = sectionBody.match(/^\s*model\s*=\s*"([^"]+)"/m);
    const contextMatch = sectionBody.match(/max_context_size\s*=\s*(\d+)/);

    models.push({
      id,
      model: modelMatch ? modelMatch[1] : id.split('/').pop() || id,
      displayName: displayNameMatch ? displayNameMatch[1] : id,
      maxContextSize: contextMatch ? parseInt(contextMatch[1], 10) : 0,
    });
  }

  return models;
}

function buildAliasMap(models: KimiModelConfig[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const m of models) {
    // Primary ID is always valid
    map.set(m.id.toLowerCase(), m.id);

    // Model name (after the slash)
    map.set(m.model.toLowerCase(), m.id);

    // Display name and variants
    const dn = m.displayName.toLowerCase();
    map.set(dn, m.id);

    // Strip "kimi-" prefix from display name
    const stripped = dn.replace(/^kimi-/, '');
    if (stripped !== dn) map.set(stripped, m.id);

    // Extract version numbers like k2.6, k2.5, k1.5
    const versionMatch = dn.match(/(k?\d+(?:\.\d+)?)/);
    if (versionMatch) {
      const v = versionMatch[1];
      map.set(v, m.id);
      map.set(`k${v}`, m.id);
      // Also add dotless variant (k25 for k2.5)
      const dotless = v.replace('.', '');
      if (dotless !== v) {
        map.set(dotless, m.id);
        map.set(`k${dotless}`, m.id);
      }
    }
  }

  // Add manual aliases if they resolve to a configured model
  for (const [alias, target] of Object.entries(MANUAL_ALIASES)) {
    const configured = models.find(m => m.id === target);
    if (configured) {
      map.set(alias.toLowerCase(), configured.id);
    }
  }

  // Size-based aliases: sort by context window
  const sorted = [...models].sort((a, b) => a.maxContextSize - b.maxContextSize);
  if (sorted.length >= 1) {
    map.set('small', sorted[0].id);
    map.set('smallest', sorted[0].id);
    map.set('large', sorted[sorted.length - 1].id);
    map.set('largest', sorted[sorted.length - 1].id);
    map.set('default', sorted[sorted.length - 1].id);
  }
  if (sorted.length >= 2) {
    const midIdx = Math.floor(sorted.length / 2);
    map.set('medium', sorted[midIdx].id);
    map.set('mid', sorted[midIdx].id);
  } else if (sorted.length === 1) {
    map.set('medium', sorted[0].id);
    map.set('mid', sorted[0].id);
  }

  return map;
}

let cachedAliasMap: Map<string, string> | null = null;
let cachedModels: KimiModelConfig[] | null = null;

function getAliasMap(): Map<string, string> {
  if (cachedAliasMap) return cachedAliasMap;
  const models = parseConfigModels();
  cachedModels = models;
  cachedAliasMap = buildAliasMap(models);
  return cachedAliasMap;
}

/**
 * Resolves a user-provided model alias to the actual model ID.
 * Falls back to returning the input unchanged if no alias matches.
 */
export function resolveModel(modelInput: string | undefined): string | undefined {
  if (!modelInput) return undefined;

  const key = modelInput.toLowerCase().trim();
  const aliasMap = getAliasMap();

  if (aliasMap.has(key)) {
    const resolved = aliasMap.get(key)!;
    if (resolved !== modelInput) {
      // Only log when we actually resolved something different
      if (process.env.MCP_KIMI_DEBUG) {
        console.error(`[kimi-mcp debug] Resolved model "${modelInput}" → "${resolved}"`);
      }
    }
    return resolved;
  }

  // Passthrough: user provided a raw model ID we don't recognize
  return modelInput;
}

/**
 * Returns the list of configured models (for debugging / introspection).
 */
export function getConfiguredModels(): KimiModelConfig[] {
  if (cachedModels) return cachedModels;
  cachedModels = parseConfigModels();
  return cachedModels;
}

/**
 * Returns available model aliases as a comma-separated string (for help text).
 */
export function getModelAliasHelp(): string {
  const models = getConfiguredModels();
  const aliasMap = getAliasMap();
  const aliases = Array.from(new Set(aliasMap.values()))
    .map(id => {
      const m = models.find(x => x.id === id);
      const names = Array.from(aliasMap.entries())
        .filter(([, v]) => v === id)
        .map(([k]) => k)
        .filter(k => k !== id.toLowerCase() && k !== (m?.model || '').toLowerCase());
      return m
        ? `${id} (aka: ${names.join(', ') || m.displayName})`
        : id;
    });
  return aliases.join('; ');
}
