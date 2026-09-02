import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const toolsRoot = resolve(__dirname, '../tools/repliers/repliers-api');

async function loadDir(dir) {
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  const results = await Promise.all(
    jsFiles.map(async (file) => {
      const mod = await import(pathToFileURL(join(dir, file)).href);
      const tool = mod.apiTool || mod.repliersListingsSearchTool;
      if (!tool?.definition?.function) return null;
      return { ...tool, path: join(dir, file) };
    })
  );
  return results.filter(Boolean);
}

// MCP tool annotations by name prefix — consumer surfaces (e.g. ChatGPT Plus
// connectors) filter the roster on these hints, exposing read-only tools only.
const annotationRules = [
  [/^(get|list|search|autocomplete|lookup|market|refine)/, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }],
  [/^(delete|remove|update)/, { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }],
  // Sending leaves the dataset — a message reaches a person, feedback opens a ticket on a
  // third-party board — which is what openWorldHint marks. Everything else, reads and CRM writes
  // alike, addresses one fixed MLS deployment: a closed domain, so the hint stays false there.
  [/^send/, { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }],
  [/^create/, { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }],
];

export function toolAnnotations(name) {
  const rule = annotationRules.find(([pattern]) => pattern.test(name.toLowerCase()));
  return rule?.[1];
}

export async function discoverTools() {
  const [generated, custom] = await Promise.all([
    loadDir(join(toolsRoot, 'generated')),
    loadDir(join(toolsRoot, 'custom')),
  ]);
  return [...generated, ...custom];
}
