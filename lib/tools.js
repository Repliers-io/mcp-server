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

export async function discoverTools() {
  const [generated, custom] = await Promise.all([
    loadDir(join(toolsRoot, 'generated')),
    loadDir(join(toolsRoot, 'custom')),
  ]);
  return [...generated, ...custom];
}
